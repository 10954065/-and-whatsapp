import { z } from "zod";
import type { ConversationStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { randomToken } from "@/lib/security/crypto";
import { recordAudit } from "@/modules/administration/audit.service";
import { handleInboundMessage } from "@/modules/messaging/inbound.service";
import { sendConversationMessage } from "@/modules/messaging/outbound.service";

export interface InboxFilters {
  channel?: "WHATSAPP" | "INSTAGRAM" | "SANDBOX";
  status?: ConversationStatus;
  unread?: boolean;
  mine?: boolean;
  search?: string;
}

export async function listConversations(businessId: string, userId: string, filters: InboxFilters, take = 50) {
  const where: Prisma.ConversationWhereInput = {
    businessId,
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.status ? { status: filters.status } : { status: { in: ["OPEN", "PENDING"] } }),
    ...(filters.unread ? { unreadCount: { gt: 0 } } : {}),
    ...(filters.mine ? { assignedToId: userId } : {}),
    ...(filters.search
      ? {
          OR: [
            { customer: { displayName: { contains: filters.search, mode: "insensitive" } } },
            { customer: { phone: { contains: filters.search } } },
            { lastMessagePreview: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return prisma.conversation.findMany({
    where,
    include: { customer: { select: { id: true, displayName: true, phone: true } }, assignedTo: { select: { id: true, name: true } } },
    orderBy: { lastMessageAt: "desc" },
    take,
  });
}

export async function getConversationDetail(businessId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    include: {
      customer: {
        include: {
          identities: true,
          orders: { orderBy: { createdAt: "desc" }, take: 5 },
          bookings: { orderBy: { startsAt: "desc" }, take: 5, include: { service: { select: { name: true } } } },
          leads: { orderBy: { createdAt: "desc" }, take: 3 },
        },
      },
      assignedTo: { select: { id: true, name: true } },
      integration: { select: { status: true, displayHandle: true } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!conversation) return null;
  const messages = await prisma.message.findMany({ where: { conversationId, businessId }, orderBy: { createdAt: "asc" }, take: 200 });
  const aiRuns = await prisma.aiRun.findMany({ where: { conversationId, businessId }, orderBy: { createdAt: "desc" }, take: 5, include: { actions: true } });
  return { conversation, messages, aiRuns };
}

async function audit(actor: TenantActor, action: string, conversationId: string, metadata?: Record<string, unknown>, tx?: Prisma.TransactionClient) {
  await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action, entityType: "Conversation", entityId: conversationId, metadata }, tx);
}

export const replySchema = z.object({ conversationId: z.string().min(1), text: z.string().trim().min(1, "Write a reply.").max(4_000) });

/** Staff reply. Sending as a person also takes the conversation over from the AI. */
export async function replyAsStaff(actor: TenantActor, input: z.infer<typeof replySchema>) {
  await takeOver(actor, input.conversationId);
  return sendConversationMessage({
    businessId: actor.businessId,
    conversationId: input.conversationId,
    sender: "STAFF",
    senderUserId: actor.userId,
    text: input.text,
    idempotencyKey: `staff:${input.conversationId}:${randomToken(12)}`,
  });
}

/** Pauses AI replies in this conversation until control is explicitly returned. */
export async function takeOver(actor: TenantActor, conversationId: string): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: conversationId, businessId: actor.businessId, control: "AI" },
      data: { control: "HUMAN", takenOverById: actor.userId, takenOverAt: new Date(), assignedToId: actor.userId },
    });
    if (updated.count) await audit(actor, "inbox.takeover", conversationId, undefined, tx);
  });
}

export async function returnToAi(actor: TenantActor, conversationId: string): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: conversationId, businessId: actor.businessId },
      data: { control: "AI", takenOverById: null, takenOverAt: null },
    });
    if (!updated.count) throw fail.notFound("Conversation");
    await audit(actor, "inbox.returned_to_ai", conversationId, undefined, tx);
  });
}

export async function markRead(actor: TenantActor, conversationId: string): Promise<void> {
  await prisma.conversation.updateMany({ where: { id: conversationId, businessId: actor.businessId }, data: { unreadCount: 0 } });
}

export const updateConversationSchema = z.object({
  conversationId: z.string().min(1),
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]).optional(),
  assignedToId: z.string().max(64).optional(),
  tags: z.string().max(300).optional(),
});

export async function updateConversation(actor: TenantActor, input: z.infer<typeof updateConversationSchema>): Promise<void> {
  let assignedToId: string | null | undefined;
  if (input.assignedToId !== undefined) {
    if (input.assignedToId === "") assignedToId = null;
    else {
      const member = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId: actor.businessId, userId: input.assignedToId } } });
      if (!member) throw fail.validation("Choose a member of this workspace.");
      assignedToId = input.assignedToId;
    }
  }
  const tags = input.tags?.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  await withTenantTx(actor.businessId, async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: input.conversationId, businessId: actor.businessId },
      data: { ...(input.status ? { status: input.status } : {}), ...(assignedToId !== undefined ? { assignedToId } : {}), ...(tags ? { tags } : {}) },
    });
    if (!updated.count) throw fail.notFound("Conversation");
    await audit(actor, "inbox.updated", input.conversationId, { status: input.status, assignedToId, tags }, tx);
  });
}

export const noteSchema = z.object({ conversationId: z.string().min(1), body: z.string().trim().min(1).max(2_000) });

export async function addConversationNote(actor: TenantActor, input: z.infer<typeof noteSchema>): Promise<void> {
  const conversation = await prisma.conversation.findFirst({ where: { id: input.conversationId, businessId: actor.businessId }, select: { id: true } });
  if (!conversation) throw fail.notFound("Conversation");
  await withTenantTx(actor.businessId, (tx) =>
    tx.conversationNote.create({ data: { businessId: actor.businessId, conversationId: conversation.id, authorId: actor.userId, body: input.body } }),
  );
}

export const simulateSchema = z.object({ customerName: z.string().trim().min(1).max(60), text: z.string().trim().min(1).max(2_000) });

/**
 * Sandbox channel only: injects a customer message through the real inbound pipeline so
 * the whole flow (customer → conversation → AI reply) can be tested without Meta.
 */
export async function simulateSandboxMessage(actor: TenantActor, input: z.infer<typeof simulateSchema>) {
  const integration = await prisma.integration.findFirst({ where: { businessId: actor.businessId, channel: "SANDBOX", status: "CONNECTED" } });
  if (!integration) throw fail.precondition("Turn on the test channel in Integrations first.");
  const externalId = `sandbox-${input.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return handleInboundMessage({
    integrationId: integration.id,
    businessId: actor.businessId,
    channel: "SANDBOX",
    customerExternalId: externalId,
    customerName: input.customerName,
    providerMessageId: `sandbox-${randomToken(12)}`,
    type: "TEXT",
    text: input.text,
    attachments: [],
    timestamp: new Date(),
  });
}
