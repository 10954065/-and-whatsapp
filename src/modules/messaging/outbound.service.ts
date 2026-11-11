import type { MessageSender } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { outboundMessagingMode } from "@/lib/env";
import { fail } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";
import { incrementUsage } from "@/modules/billing/usage";
import { credentialsFor } from "@/modules/integrations/integration.service";
import { sendInstagramText, sendWhatsAppTemplate, sendWhatsAppText } from "@/modules/integrations/meta";

export const SERVICE_WINDOW_MS = 24 * 3_600_000;

export function isWithinServiceWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  return Boolean(lastInboundAt && now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_MS);
}

export interface SendInput {
  businessId: string;
  conversationId: string;
  sender: MessageSender;
  senderUserId?: string | null;
  text?: string;
  template?: { name: string; language: string; components?: unknown[] };
  aiRunId?: string | null;
  /** Same key → same message; retries never send twice. */
  idempotencyKey: string;
}

/**
 * Sends a message through the conversation's channel. Enforces opt-outs and the 24-hour
 * customer-service window (outside it WhatsApp requires an approved template; Instagram
 * refuses). In sandbox mode (previews, development) messages are recorded but not sent.
 */
export async function sendConversationMessage(input: SendInput) {
  const existing = await prisma.message.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, businessId: input.businessId },
    include: { integration: true, customer: { include: { identities: true } } },
  });
  if (!conversation) throw fail.notFound("Conversation");
  const identity = conversation.customer.identities.find((entry) => entry.channel === conversation.channel);
  if (!identity) throw fail.precondition("This customer has no address on this channel.");
  if (identity.consentStatus === "OPTED_OUT") throw fail.precondition("This customer has opted out of messages on this channel.");
  if (!input.text && !input.template) throw fail.validation("Write a message.");

  const inWindow = isWithinServiceWindow(conversation.lastInboundAt);
  if (!inWindow && !input.template) {
    throw fail.precondition(
      conversation.channel === "WHATSAPP"
        ? "More than 24 hours have passed since the customer's last message. Send an approved WhatsApp template instead."
        : "Instagram only allows replies within 24 hours of the customer's last message.",
    );
  }
  if (input.template && conversation.channel !== "WHATSAPP") throw fail.validation("Templates are only available on WhatsApp.");

  const message = await prisma.message.create({
    data: {
      businessId: input.businessId,
      conversationId: conversation.id,
      customerId: conversation.customerId,
      channel: conversation.channel,
      direction: "OUTBOUND",
      sender: input.sender,
      senderUserId: input.senderUserId ?? null,
      type: input.template ? "TEMPLATE" : "TEXT",
      text: input.text ?? `[template: ${input.template?.name}]`,
      templateName: input.template?.name ?? null,
      deliveryStatus: "PENDING",
      processingStatus: "PROCESSED",
      idempotencyKey: input.idempotencyKey,
      aiRunId: input.aiRunId ?? null,
    },
  });

  const sandboxed = conversation.channel === "SANDBOX" || outboundMessagingMode() === "sandbox";
  try {
    let providerMessageId: string | null = null;
    if (!sandboxed) {
      const integration = conversation.integration;
      if (!integration || integration.status !== "CONNECTED") throw fail.precondition("The channel for this conversation is not connected.");
      const credentials = credentialsFor(integration);
      if (conversation.channel === "WHATSAPP") {
        providerMessageId = input.template
          ? (await sendWhatsAppTemplate(integration.externalAccountId, identity.externalId, input.template, credentials)).providerMessageId
          : (await sendWhatsAppText(integration.externalAccountId, identity.externalId, input.text!, credentials)).providerMessageId;
      } else if (conversation.channel === "INSTAGRAM") {
        providerMessageId = (await sendInstagramText(integration.externalAccountId, identity.externalId, input.text!, credentials)).providerMessageId;
      }
    }
    const now = new Date();
    const sent = await prisma.message.update({
      where: { id: message.id },
      data: { deliveryStatus: sandboxed ? "SANDBOXED" : "SENT", providerMessageId, sentAt: now },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, lastMessagePreview: (sent.text ?? "").slice(0, 140) },
    });
    await prisma.customer.update({ where: { id: conversation.customerId }, data: { lastContactedAt: now } });
    await incrementUsage(input.businessId, "OUTBOUND_MESSAGE", 1, now);
    return sent;
  } catch (error) {
    await prisma.message.update({
      where: { id: message.id },
      data: { deliveryStatus: "FAILED", failedAt: new Date(), errorMessage: (error as Error).message.slice(0, 500) },
    });
    logger.warn("messaging.send_failed", { messageId: message.id, error });
    throw error;
  }
}

/** Applies a delivery receipt from a provider webhook (never moves status backwards). */
export async function applyDeliveryStatus(input: { channel: "WHATSAPP" | "INSTAGRAM"; providerMessageId: string; status: "SENT" | "DELIVERED" | "READ" | "FAILED"; timestamp: Date; errorCode?: string; errorMessage?: string }) {
  const message = await prisma.message.findUnique({
    where: { channel_providerMessageId: { channel: input.channel, providerMessageId: input.providerMessageId } },
  });
  if (!message) return;
  const rank = { PENDING: 0, SANDBOXED: 0, RECEIVED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 } as const;
  if (input.status !== "FAILED" && rank[input.status] <= rank[message.deliveryStatus]) return;
  await prisma.message.update({
    where: { id: message.id },
    data: {
      deliveryStatus: input.status,
      deliveredAt: input.status === "DELIVERED" ? input.timestamp : message.deliveredAt,
      readAt: input.status === "READ" ? input.timestamp : message.readAt,
      failedAt: input.status === "FAILED" ? input.timestamp : message.failedAt,
      errorCode: input.errorCode ?? message.errorCode,
      errorMessage: input.errorMessage ?? message.errorMessage,
    },
  });
}
