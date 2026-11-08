import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { registerJobHandler } from "@/lib/queue";
import { PAYSTACK_WEBHOOK_JOB, confirmPayment } from "@/modules/billing/billing.service";

const chargeSchema = z.object({ event: z.literal("charge.success"), data: z.object({ reference: z.string().min(1) }) });

/** Events that change money after the fact and need a person (see PAYSTACK_BILLING_GUIDE). */
const REVIEW_EVENT = /^(refund\.|charge\.dispute\.)/;

/**
 * Only `charge.success` is acted on (subscriptions are prepaid periods, not Paystack plans).
 * Refunds and disputes are flagged for manual review. A provider error or a payment still
 * pending at Paystack throws, so the queue retries with back-off; the daily reconciliation
 * sweep is the final safety net.
 */
registerJobHandler(PAYSTACK_WEBHOOK_JOB, async (payload) => {
  const { eventId } = z.object({ eventId: z.string() }).parse(payload);
  const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === "PROCESSED" || event.status === "IGNORED") return;
  await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: "PROCESSING", attempts: { increment: 1 } } });

  const charge = chargeSchema.safeParse(event.payload);
  if (!charge.success) {
    const needsReview = REVIEW_EVENT.test(event.eventType ?? "");
    if (needsReview) await reportError(new Error(`Paystack ${event.eventType} needs manual review`), { source: "billing.paystack_review", webhookEventId: event.id });
    await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: "IGNORED", processedAt: new Date(), error: needsReview ? "Needs manual review in the Paystack dashboard" : null } });
    return;
  }
  try {
    const outcome = await confirmPayment(charge.data.data.reference);
    const businessId = (await prisma.paymentTransaction.findUnique({ where: { reference: charge.data.data.reference }, select: { businessId: true } }))?.businessId ?? null;
    if (outcome === "unknown") logger.warn("webhook.paystack.unknown_reference", { reference: charge.data.data.reference });
    if (outcome === "pending") throw new Error("Payment still pending at Paystack");
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: outcome === "unknown" ? "IGNORED" : "PROCESSED", businessId, processedAt: new Date(), error: null },
    });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "unknown" } });
    throw error;
  }
});
