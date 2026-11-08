import { withTenantTx } from "@/lib/db/tenant";
import { logger } from "@/lib/monitoring/logger";

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
  await withTenantTx(input.businessId, async (tx) => {
    if (input.conversationId) {
      await tx.conversation.updateMany({
        where: { id: input.conversationId, businessId: input.businessId },
        data: { control: "HUMAN", status: "PENDING" },
      });
    }
    await tx.notification.create({
      data: {
        businessId: input.businessId,
        type: "ai.escalation",
        title: "A customer needs a person",
        body: `${input.reason}: ${input.summary}`.slice(0, 500),
        link: input.conversationId ? `/app/inbox?conversation=${input.conversationId}` : null,
      },
    });
  });
  logger.info("ai.escalated", { businessId: input.businessId, conversationId: input.conversationId, reason: input.reason });
}
