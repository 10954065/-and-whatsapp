import { z } from "zod";
import type { MessageType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { registerJobHandler } from "@/lib/queue";
import type { ConversationTurn } from "@/modules/ai/context";
import { runAgent } from "@/modules/ai/orchestrator";
import { parseMetaWebhook } from "@/modules/integrations/meta";
import { handleInboundMessage } from "@/modules/messaging/inbound.service";
import { applyDeliveryStatus, sendConversationMessage } from "@/modules/messaging/outbound.service";

/** Processes a persisted Meta webhook event: routes each message to its business. */
registerJobHandler("webhook.meta", async (payload) => {
  const { eventId } = z.object({ eventId: z.string() }).parse(payload);
  const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === "PROCESSED") return;
  await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  let handled = 0;
  for (const normalized of parseMetaWebhook(event.payload)) {
    if (normalized.kind === "status") {
      await applyDeliveryStatus(normalized);
      handled += 1;
      continue;
    }
    const integration = await prisma.integration.findUnique({
      where: { channel_externalAccountId: { channel: normalized.channel, externalAccountId: normalized.accountId } },
    });
    if (!integration || integration.status === "DISCONNECTED") {
      logger.warn("webhook.meta.unknown_account", { channel: normalized.channel, accountId: normalized.accountId });
      continue;
    }
    await handleInboundMessage({
      integrationId: integration.id,
      businessId: integration.businessId,
      channel: normalized.channel,
      customerExternalId: normalized.customerExternalId,
      customerName: normalized.customerName,
      providerMessageId: normalized.providerMessageId,
      type: normalized.type as MessageType,
      text: normalized.text,
      attachments: normalized.attachments,
      timestamp: normalized.timestamp,
    });
    handled += 1;
  }
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { status: handled ? "PROCESSED" : "IGNORED", processedAt: new Date() },
  });
});

/** Generates and sends the AI reply to one inbound message. */
registerJobHandler("ai.reply", async (payload) => {
  const { messageId } = z.object({ messageId: z.string() }).parse(payload);
  const inbound = await prisma.message.findUnique({ where: { id: messageId } });
  if (!inbound || inbound.processingStatus === "PROCESSED") return;
  const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: inbound.conversationId } });

  // If newer customer messages exist, only the latest one triggers a reply (bursts are merged).
  const newer = await prisma.message.count({ where: { conversationId: conversation.id, direction: "INBOUND", createdAt: { gt: inbound.createdAt } } });
  if (newer > 0) {
    await prisma.message.update({ where: { id: messageId }, data: { processingStatus: "SKIPPED" } });
    return;
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id, createdAt: { lt: inbound.createdAt }, text: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const unanswered = await prisma.message.findMany({
    where: { conversationId: conversation.id, direction: "INBOUND", processingStatus: "PENDING", createdAt: { lte: inbound.createdAt } },
    orderBy: { createdAt: "asc" },
  });
  const turns: ConversationTurn[] = history
    .reverse()
    .filter((message) => !unanswered.some((pending) => pending.id === message.id))
    .map((message) => ({ role: message.direction === "INBOUND" ? "customer" : "assistant", text: message.text ?? "" }));
  const inboundText = unanswered.map((message) => message.text ?? `[${message.type.toLowerCase()}]`).join("\n") || (inbound.text ?? "");

  const result = await runAgent({
    businessId: inbound.businessId,
    conversationId: conversation.id,
    customerId: inbound.customerId,
    channel: conversation.channel,
    trigger: "INBOUND_MESSAGE",
    history: turns,
    inboundText,
    mode: "live",
  });

  if (result.reply) {
    await sendConversationMessage({
      businessId: inbound.businessId,
      conversationId: conversation.id,
      sender: result.isAutoReply ? "SYSTEM" : "AI",
      text: result.reply,
      aiRunId: result.runId,
      idempotencyKey: `ai.reply:${messageId}`,
    });
  }
  await prisma.message.updateMany({
    where: { id: { in: unanswered.map((message) => message.id) } },
    data: { processingStatus: result.status === "SKIPPED" && !result.reply ? "SKIPPED" : "PROCESSED", aiRunId: result.runId },
  });
});
