import type { Channel, MessageType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { enqueueJob } from "@/lib/queue";
import { incrementUsage } from "@/modules/billing/usage";
import { emitWorkflowEvent } from "@/modules/workflows/workflow.engine";

const OPT_OUT = /^\s*(stop|unsubscribe|stop all|opt out|optout)\s*$/i;
const OPT_IN = /^\s*(start|unstop|subscribe)\s*$/i;

export interface InboundMessage {
  integrationId: string;
  businessId: string;
  channel: Channel;
  customerExternalId: string;
  customerName: string | null;
  providerMessageId: string;
  type: MessageType;
  text: string | null;
  attachments: Prisma.InputJsonValue[];
  timestamp: Date;
}

/**
 * Stores one inbound customer message exactly once. Customers are matched only by their
 * channel identity (wa_id / IGSID) — never merged by name. Opt-out keywords are recorded
 * as consent changes. Returns null for duplicates.
 */
export async function recordInboundMessage(input: InboundMessage): Promise<{ messageId: string; conversationId: string; customerId: string; isNewCustomer: boolean; optedOut: boolean } | null> {
  const duplicate = await prisma.message.findUnique({
    where: { channel_providerMessageId: { channel: input.channel, providerMessageId: input.providerMessageId } },
    select: { id: true },
  });
  if (duplicate) return null;

  return withTenantTx(input.businessId, async (tx) => {
    let identity = await tx.customerIdentity.findUnique({
      where: { businessId_channel_externalId: { businessId: input.businessId, channel: input.channel, externalId: input.customerExternalId } },
    });
    let isNewCustomer = false;
    if (!identity) {
      isNewCustomer = true;
      const customer = await tx.customer.create({
        data: {
          businessId: input.businessId,
          displayName: input.customerName ?? (input.channel === "WHATSAPP" ? `+${input.customerExternalId}` : "Instagram customer"),
          phone: input.channel === "WHATSAPP" ? `+${input.customerExternalId}` : null,
          source: input.channel.toLowerCase(),
        },
      });
      identity = await tx.customerIdentity.create({
        data: {
          businessId: input.businessId,
          customerId: customer.id,
          channel: input.channel,
          externalId: input.customerExternalId,
          profileName: input.customerName,
          consentStatus: "OPTED_IN",
          consentUpdatedAt: input.timestamp,
        },
      });
      await tx.consentRecord.create({
        data: { businessId: input.businessId, customerId: customer.id, channel: input.channel, status: "OPTED_IN", source: "inbound_message" },
      });
    }

    const text = input.text?.trim() ?? "";
    const optedOut = OPT_OUT.test(text);
    if (optedOut || OPT_IN.test(text)) {
      const status = optedOut ? "OPTED_OUT" : "OPTED_IN";
      await tx.customerIdentity.update({ where: { id: identity.id }, data: { consentStatus: status, consentUpdatedAt: input.timestamp } });
      await tx.consentRecord.create({
        data: { businessId: input.businessId, customerId: identity.customerId, channel: input.channel, status, source: `keyword:${text.toUpperCase()}` },
      });
    }

    const open = await tx.conversation.findFirst({
      where: { businessId: input.businessId, customerId: identity.customerId, channel: input.channel, status: { in: ["OPEN", "PENDING"] } },
      orderBy: { lastMessageAt: "desc" },
    });
    const conversation =
      open ??
      (await tx.conversation.create({
        data: { businessId: input.businessId, customerId: identity.customerId, channel: input.channel, integrationId: input.integrationId },
      }));

    const message = await tx.message.create({
      data: {
        businessId: input.businessId,
        conversationId: conversation.id,
        customerId: identity.customerId,
        channel: input.channel,
        direction: "INBOUND",
        sender: "CUSTOMER",
        type: input.type,
        text: input.text,
        attachments: input.attachments.length ? input.attachments : undefined,
        providerMessageId: input.providerMessageId,
        deliveryStatus: "RECEIVED",
        createdAt: input.timestamp,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: input.timestamp,
        lastInboundAt: input.timestamp,
        lastMessagePreview: (input.text ?? `[${input.type.toLowerCase()}]`).slice(0, 140),
        unreadCount: { increment: 1 },
        status: "OPEN",
      },
    });
    await tx.customer.update({ where: { id: identity.customerId }, data: { lastInboundAt: input.timestamp } });
    await incrementUsage(input.businessId, "INBOUND_MESSAGE", 1, input.timestamp, tx);
    return { messageId: message.id, conversationId: conversation.id, customerId: identity.customerId, isNewCustomer, optedOut };
  });
}

/** Records the inbound message and schedules the AI reply (unless the customer opted out). */
export async function handleInboundMessage(input: InboundMessage): Promise<{ messageId: string; conversationId: string } | null> {
  const result = await recordInboundMessage(input);
  if (!result) return null;
  if (!result.optedOut) {
    await enqueueJob("ai.reply", { messageId: result.messageId }, { businessId: input.businessId, idempotencyKey: `ai.reply:${result.messageId}`, priority: 10 });
  }
  // The sandbox channel behaves like WhatsApp so owners can test message workflows.
  const event = {
    businessId: input.businessId,
    depth: 0,
    customerId: result.customerId,
    conversationId: result.conversationId,
    channel: input.channel.toLowerCase(),
    messageText: input.text,
  };
  await emitWorkflowEvent({ ...event, trigger: input.channel === "INSTAGRAM" ? "INSTAGRAM_MESSAGE" : "WHATSAPP_MESSAGE", eventId: `message:${result.messageId}` });
  if (result.isNewCustomer) await emitWorkflowEvent({ ...event, trigger: "NEW_CUSTOMER", eventId: `customer:${result.customerId}` });
  return { messageId: result.messageId, conversationId: result.conversationId };
}
