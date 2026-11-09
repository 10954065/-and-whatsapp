import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BillingInterval, PaymentTxStatus, Subscription, SubscriptionPlan } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { recordAudit } from "@/modules/administration/audit.service";
import { initializeTransaction, isPaystackConfigured, verifyTransaction } from "@/modules/billing/paystack";
import { getPlanLimits, getUsage, monthPeriod } from "@/modules/billing/usage";
import { getKnowledgeStorageBytes } from "@/modules/knowledge/knowledge.service";
import { notifyTeam } from "@/modules/notifications/notification.service";

export const PAYSTACK_WEBHOOK_JOB = "webhook.paystack";

export const INTERVAL_MONTHS: Record<BillingInterval, number> = { MONTHLY: 1, YEARLY: 12 };
/** Days a lapsed paid plan keeps working while the owner renews. */
export const GRACE_DAYS = 3;
/** Owners are reminded this many days before a paid period ends. */
export const RENEWAL_REMINDER_DAYS = 3;

export const checkoutSchema = z.object({
  planCode: z.string().trim().min(1).max(40),
  interval: z.enum(["MONTHLY", "YEARLY"]),
});

/** Adds calendar months in UTC, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

/** Price per day of a plan on a billing interval (minor units). */
function dailyRate(plan: Pick<SubscriptionPlan, "priceMonthlyMinor" | "priceYearlyMinor">, interval: BillingInterval): number {
  return interval === "MONTHLY" ? plan.priceMonthlyMinor / 30 : plan.priceYearlyMinor / 365;
}

/** Converts unused paid time on the old plan into time on the new one, at the two plans' daily rates. */
export function unusedTimeCredit(
  current: Pick<Subscription, "status" | "currentPeriodEnd" | "interval"> & { plan: Pick<SubscriptionPlan, "priceMonthlyMinor" | "priceYearlyMinor"> },
  newPlan: Pick<SubscriptionPlan, "priceMonthlyMinor" | "priceYearlyMinor">,
  newInterval: BillingInterval,
  now: Date,
): number {
  if (current.status !== "ACTIVE" || current.currentPeriodEnd <= now) return 0;
  const newRate = dailyRate(newPlan, newInterval);
  if (newRate <= 0) return 0;
  const remainingMs = current.currentPeriodEnd.getTime() - now.getTime();
  return Math.round((remainingMs * dailyRate(current.plan, current.interval)) / newRate);
}

/**
 * The period a successful payment buys. Paying again for the same plan and interval while it
 * is still running extends it from the current end; switching starts now and adds the credit
 * for unused time on the old plan.
 */
export function nextPeriod(
  current: Pick<Subscription, "planId" | "interval" | "status" | "currentPeriodEnd"> | null,
  planId: string,
  interval: BillingInterval,
  now: Date,
  creditMs = 0,
): { start: Date; end: Date } {
  const extendsCurrent = current !== null && current.status === "ACTIVE" && current.planId === planId && current.interval === interval && current.currentPeriodEnd > now;
  if (extendsCurrent) return { start: current.currentPeriodEnd, end: addMonths(current.currentPeriodEnd, INTERVAL_MONTHS[interval]) };
  return { start: now, end: new Date(addMonths(now, INTERVAL_MONTHS[interval]).getTime() + creditMs) };
}

/** Creates a pending payment and returns Paystack's hosted checkout URL for the owner. */
export async function startSubscriptionCheckout(actor: TenantActor & { email: string }, input: z.infer<typeof checkoutSchema>): Promise<string> {
  if (!isPaystackConfigured()) throw fail.precondition("Online payments are not configured on this platform yet.");
  await enforceRateLimit(RATE_LIMITS.checkout, actor.businessId);
  const plan = await prisma.subscriptionPlan.findFirst({ where: { code: input.planCode, isActive: true, isPublic: true } });
  if (!plan) throw fail.notFound("Plan");
  const amountMinor = input.interval === "MONTHLY" ? plan.priceMonthlyMinor : plan.priceYearlyMinor;
  if (amountMinor <= 0) throw fail.precondition("This plan has no price for that billing period.");

  const subscription = await prisma.subscription.findUnique({ where: { businessId: actor.businessId }, select: { id: true } });
  const reference = `sl-${randomUUID()}`;
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        businessId: actor.businessId,
        subscriptionId: subscription?.id ?? null,
        provider: "PAYSTACK",
        purpose: "SUBSCRIPTION",
        reference,
        amountMinor,
        currency: plan.currency,
        metadata: { planId: plan.id, planCode: plan.code, interval: input.interval, initiatedBy: actor.userId },
      },
    });
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "billing.checkout_started", entityType: "PaymentTransaction", metadata: { reference, plan: plan.code, interval: input.interval }, ipAddress: actor.ipAddress }, tx);
  });

  try {
    const checkout = await initializeTransaction({
      email: actor.email,
      amountMinor,
      currency: plan.currency,
      reference,
      callbackUrl: `${env().APP_URL}/api/billing/paystack/callback`,
      metadata: { businessId: actor.businessId, purpose: "SUBSCRIPTION", plan: plan.code, interval: input.interval },
    });
    return checkout.authorizationUrl;
  } catch (error) {
    await withTenantTx(actor.businessId, (tx) =>
      tx.paymentTransaction.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED", failureReason: "Checkout could not be started" } }),
    );
    throw error;
  }
}

export type PaymentOutcome = "success" | "failed" | "pending" | "unknown";

const FINAL_FAILURE: Record<string, PaymentTxStatus> = { failed: "FAILED", abandoned: "ABANDONED", reversed: "REVERSED" };

interface SubscriptionPaymentMetadata {
  planId: string;
  interval: BillingInterval;
}

/**
 * Confirms a payment with Paystack's verify API (never with the browser redirect or webhook
 * body alone), checks amount and currency, and applies it exactly once.
 */
export async function confirmPayment(reference: string, now: Date = new Date()): Promise<PaymentOutcome> {
  const payment = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!payment) return "unknown";
  if (payment.status === "SUCCESS") return "success";

  const verified = await verifyTransaction(reference);
  if (verified.status !== "success") {
    const failure = FINAL_FAILURE[verified.status];
    if (!failure) return "pending";
    await withTenantTx(payment.businessId, (tx) =>
      tx.paymentTransaction.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: failure, failureReason: verified.gateway_response?.slice(0, 300) ?? verified.status } }),
    );
    return "failed";
  }

  if (verified.reference !== reference || verified.amount !== payment.amountMinor || verified.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    await withTenantTx(payment.businessId, (tx) =>
      tx.paymentTransaction.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "Amount or currency did not match the checkout" } }),
    );
    await reportError(new Error("Paystack payment did not match its checkout"), { source: "billing.verify_mismatch", businessId: payment.businessId, reference, amount: verified.amount, currency: verified.currency });
    return "failed";
  }

  const applied = await withTenantTx(payment.businessId, async (tx) => {
    // Serialises every payment for this business, so two different references can't both
    // compute their period from the same subscription state.
    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${payment.businessId} FOR UPDATE`;
    const claimed = await tx.paymentTransaction.updateMany({
      where: { id: payment.id, status: { not: "SUCCESS" } },
      data: {
        status: "SUCCESS",
        paidAt: verified.paid_at ? new Date(verified.paid_at) : now,
        verifiedAt: now,
        providerTransactionId: String(verified.id),
        channel: verified.channel ?? null,
        failureReason: null,
      },
    });
    if (claimed.count === 0) return null;
    if (payment.purpose !== "SUBSCRIPTION") return null;

    const metadata = payment.metadata as unknown as SubscriptionPaymentMetadata;
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: metadata.planId } });
    const current = await tx.subscription.findUnique({ where: { businessId: payment.businessId }, include: { plan: true } });
    const switching = current !== null && (current.planId !== plan.id || current.interval !== metadata.interval);
    const credit = current && switching ? unusedTimeCredit(current, plan, metadata.interval, now) : 0;
    const period = nextPeriod(current, plan.id, metadata.interval, now, credit);
    const values = {
      planId: plan.id,
      interval: metadata.interval,
      status: "ACTIVE" as const,
      trialEndsAt: null,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      graceUntil: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      providerCustomerCode: verified.customer?.customer_code ?? current?.providerCustomerCode ?? null,
    };
    const subscription = current
      ? await tx.subscription.update({ where: { id: current.id }, data: values })
      : await tx.subscription.create({ data: { businessId: payment.businessId, ...values } });
    await tx.paymentTransaction.update({ where: { id: payment.id }, data: { subscriptionId: subscription.id } });
    await recordAudit(
      { businessId: payment.businessId, actorType: "WEBHOOK", action: "billing.payment_succeeded", entityType: "PaymentTransaction", entityId: payment.id, metadata: { reference, plan: plan.code, interval: metadata.interval, amount: payment.amountMinor } },
      tx,
    );
    return { planName: plan.name, periodEnd: period.end };
  });

  if (applied) {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: payment.businessId }, select: { timezone: true } });
    await notifyTeam({
      businessId: payment.businessId,
      kind: "billing",
      title: `Payment received: ${applied.planName} plan active`,
      body: `Your plan is paid until ${formatDate(applied.periodEnd, business.timezone)}.`,
      link: "/app/billing",
    });
  }
  logger.info("billing.payment_confirmed", { businessId: payment.businessId, reference });
  return "success";
}

/**
 * Daily lifecycle sweep: ends expired trials, moves lapsed paid plans into a short grace
 * period and then to expired (data is kept; metered features pause), and reminds owners
 * before a paid period ends.
 */
export async function runBillingLifecycle(now: Date = new Date()) {
  const reconciled = await reconcilePendingPayments(now);
  const trials = await prisma.$queryRaw<{ businessId: string }[]>`
    UPDATE "Subscription" SET "status" = 'EXPIRED', "updatedAt" = now()
    WHERE "status" = 'TRIALING' AND "trialEndsAt" < ${now} RETURNING "businessId"`;
  const grace = await prisma.$queryRaw<{ businessId: string }[]>`
    UPDATE "Subscription" SET "status" = 'GRACE', "graceUntil" = "currentPeriodEnd" + make_interval(days => ${GRACE_DAYS}::int), "updatedAt" = now()
    WHERE "status" IN ('ACTIVE', 'PAST_DUE') AND "currentPeriodEnd" < ${now} RETURNING "businessId"`;
  const expired = await prisma.$queryRaw<{ businessId: string }[]>`
    UPDATE "Subscription" SET "status" = 'EXPIRED', "updatedAt" = now()
    WHERE "status" = 'GRACE' AND "graceUntil" < ${now} RETURNING "businessId"`;

  for (const { businessId } of trials) {
    await notifyTeam({ businessId, kind: "billing", title: "Your free trial has ended", body: "Choose a plan in Billing to turn your AI employee and automations back on. Your data is safe.", link: "/app/billing" });
  }
  for (const { businessId } of grace) {
    await notifyTeam({ businessId, kind: "billing", title: `Your plan has ended. Renew within ${GRACE_DAYS} days`, body: "Everything keeps working during the grace period. Pay for the next period in Billing to avoid interruption.", link: "/app/billing" });
  }
  for (const { businessId } of expired) {
    await notifyTeam({ businessId, kind: "billing", title: "Your plan has expired", body: "AI replies and automations are paused. Your data is safe. Renew in Billing to resume.", link: "/app/billing" });
  }

  const reminderHorizon = new Date(now.getTime() + RENEWAL_REMINDER_DAYS * 86_400_000);
  const ending = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { gt: now, lte: reminderHorizon } },
    include: { plan: { select: { name: true } }, business: { select: { timezone: true } } },
  });
  let reminders = 0;
  for (const subscription of ending) {
    const windowStart = new Date(subscription.currentPeriodEnd.getTime() - (RENEWAL_REMINDER_DAYS + 1) * 86_400_000);
    const alreadyReminded = await prisma.notification.count({ where: { businessId: subscription.businessId, type: "billing", title: { startsWith: "Your plan ends" }, createdAt: { gte: windowStart } } });
    if (alreadyReminded) continue;
    await notifyTeam({
      businessId: subscription.businessId,
      kind: "billing",
      title: `Your plan ends on ${formatDate(subscription.currentPeriodEnd, subscription.business.timezone)}`,
      body: `Pay for the next ${subscription.interval === "YEARLY" ? "year" : "month"} of ${subscription.plan.name} in Billing to keep everything running.`,
      link: "/app/billing",
    });
    reminders += 1;
  }
  return { ...reconciled, trialsEnded: trials.length, enteredGrace: grace.length, expired: expired.length, reminders };
}

/** Checkouts older than this with no confirmation are re-verified by the daily sweep. */
const RECONCILE_AFTER_MS = 5 * 60_000;
/** Checkouts never paid within this window are closed as abandoned. */
const ABANDON_AFTER_MS = 48 * 3_600_000;

/**
 * Safety net for missed callbacks and webhooks: re-verifies recent PENDING checkouts with
 * Paystack and closes very old ones, so a paid customer is never left unactivated.
 */
export async function reconcilePendingPayments(now: Date = new Date()) {
  if (!isPaystackConfigured()) return { reconciled: 0, abandoned: 0 };
  const abandoned = await prisma.paymentTransaction.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - ABANDON_AFTER_MS) } },
    data: { status: "ABANDONED", failureReason: "Checkout was not completed" },
  });
  const pending = await prisma.paymentTransaction.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - RECONCILE_AFTER_MS) } },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { reference: true, businessId: true },
  });
  let reconciled = 0;
  for (const payment of pending) {
    try {
      if ((await confirmPayment(payment.reference, now)) === "success") reconciled += 1;
    } catch (error) {
      await reportError(error, { source: "billing.reconcile", businessId: payment.businessId, reference: payment.reference });
    }
  }
  return { reconciled, abandoned: abandoned.count };
}

export async function getBillingOverview(businessId: string, now: Date = new Date()) {
  const [subscription, plans, payments, limits, aiMessages, workflowExecutions, channels, members, invitations, storageBytes] = await Promise.all([
    prisma.subscription.findUnique({ where: { businessId }, include: { plan: true } }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }),
    prisma.paymentTransaction.findMany({ where: { businessId, purpose: "SUBSCRIPTION" }, orderBy: { createdAt: "desc" }, take: 20 }),
    getPlanLimits(businessId),
    getUsage(businessId, "AI_MESSAGE", monthPeriod(now)),
    getUsage(businessId, "WORKFLOW_EXECUTION", monthPeriod(now)),
    prisma.integration.count({ where: { businessId, status: "CONNECTED", channel: { not: "SANDBOX" } } }),
    prisma.businessMembership.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.invitation.count({ where: { businessId, status: "PENDING", expiresAt: { gt: now } } }),
    getKnowledgeStorageBytes(businessId),
  ]);
  return {
    subscription,
    plans,
    payments,
    limits,
    usage: { aiMessages, workflowExecutions, channels, seats: members + invitations, storageMb: Math.ceil(storageBytes / (1024 * 1024)) },
    paymentsConfigured: isPaystackConfigured(),
  };
}

/** Whether metered features are paused because the trial or paid plan has lapsed. */
export function isSubscriptionLapsed(subscription: Pick<Subscription, "status" | "trialEndsAt"> | null, now: Date = new Date()): boolean {
  if (!subscription) return false;
  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") return true;
  return subscription.status === "TRIALING" && Boolean(subscription.trialEndsAt && subscription.trialEndsAt < now);
}
