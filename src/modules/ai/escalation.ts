import { withTenantTx } from "@/lib/db/tenant";
import { logger } from "@/lib/monitoring/logger";
import { notifyTeam } from "@/modules/notifications/notification.service";

/**
 * Hands a conversation to people: pauses AI replies on it (control = HUMAN) and notifies
 * the team. Used by the escalate tool, policy violations, refusals and provider failures.
 */
export async function escalateConversation(input: {
  businessId: string;
  conversationId: string | null;
  reason: string;
  summary: string;
}): Promise<void> {
  if (input.conversationId) {
    await withTenantTx(input.businessId, (tx) =>
      tx.conversation.updateMany({
        where: { id: input.conversationId!, businessId: input.businessId },
        data: { control: "HUMAN", status: "PENDING" },
      }),
    );
  }
  await notifyTeam({
    businessId: input.businessId,
    kind: "ai.escalation",
    title: "A customer needs a person",
    body: `${input.reason}: ${input.summary}`,
    link: input.conversationId ? `/app/inbox?conversation=${input.conversationId}` : null,
  });
  logger.info("ai.escalated", { businessId: input.businessId, conversationId: input.conversationId, reason: input.reason });
}
