import type { Metadata } from "next";
import { Check, CreditCard } from "lucide-react";
import { AccessDenied, PageHeader, Panel, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { PlanCard, PlanDeck, type BillingInterval, type DeckPlan } from "@/components/billing/plan-card";
import { allowanceLine, cardFinish, freeMonthsLabel, validThru, yearlySavingMinor } from "@/components/billing/plan-card-format";
import { ActionButton } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { cn } from "@/lib/utils";
import { startCheckoutAction } from "@/modules/billing/billing.actions";
import { GRACE_DAYS, RENEWAL_REMINDER_DAYS, getBillingOverview, isSubscriptionLapsed } from "@/modules/billing/billing.service";

export const metadata: Metadata = { title: "Billing" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Overview = Awaited<ReturnType<typeof getBillingOverview>>;
type Subscription = NonNullable<Overview["subscription"]>;

const PAYMENT_MESSAGES: Record<string, { tone: "success" | "warning" | "destructive"; text: string }> = {
  success: { tone: "success", text: "Payment confirmed with Paystack. Your plan is active." },
  pending: { tone: "warning", text: "Paystack hasn't confirmed this payment yet. We'll activate your plan as soon as it does, so there's no need to pay again." },
  failed: { tone: "destructive", text: "The payment didn't go through. You have not been charged for this attempt." },
  unknown: { tone: "warning", text: "We couldn't match that payment to this workspace. If you were charged, contact support with your Paystack receipt." },
};

const STATUS: Record<string, { dot: string; label: string }> = {
  TRIALING: { dot: "bg-info", label: "Free trial" },
  ACTIVE: { dot: "bg-success", label: "Active" },
  PAST_DUE: { dot: "bg-warning", label: "Payment due" },
  GRACE: { dot: "bg-warning", label: "Grace period" },
  CANCELLED: { dot: "bg-foreground/30", label: "Cancelled" },
  EXPIRED: { dot: "bg-destructive", label: "Expired" },
};

const TX_STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { SUCCESS: "default", PENDING: "outline", FAILED: "destructive", ABANDONED: "secondary", REVERSED: "destructive" };

function Meter({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {formatNumber(used)}
          {unit} of {formatNumber(limit)}
          {unit}
        </span>
      </div>
      <Progress value={ratio * 100} aria-label={`${label}: ${used} of ${limit}`} className={cn(ratio >= 1 && "**:data-[slot=progress-indicator]:bg-destructive", ratio >= 0.8 && ratio < 1 && "**:data-[slot=progress-indicator]:bg-warning")} />
    </div>
  );
}

/** When the current card stops being valid: the trial end, the grace end or the paid period end. */
function cardEndsAt(subscription: Subscription): Date {
  if (subscription.status === "TRIALING") return subscription.trialEndsAt ?? subscription.currentPeriodEnd;
  if (subscription.status === "GRACE") return subscription.graceUntil ?? subscription.currentPeriodEnd;
  return subscription.currentPeriodEnd;
}

function CurrentPlan({ overview, businessName, tz }: { overview: Overview; businessName: string; tz: string }) {
  const { subscription, limits } = overview;
  if (!subscription) return <PanelEmpty icon={CreditCard}>No plan yet. Choose one below.</PanelEmpty>;
  const lapsed = isSubscriptionLapsed(subscription);
  const plan = subscription.plan;
  const isYearly = subscription.interval === "YEARLY";
  const planIndex = Math.max(0, overview.plans.findIndex((candidate) => candidate.id === plan.id));
  return (
    <div className="grid gap-5 px-5 pb-5">
      <PlanCard
        className={cn("w-full max-w-sm", lapsed && "grayscale")}
        front={{
          finish: cardFinish(planIndex),
          headline: plan.name,
          headlineNote: isYearly ? `${formatMoney(plan.priceYearlyMinor, plan.currency)} a year` : `${formatMoney(plan.priceMonthlyMinor, plan.currency)} a month`,
          allowance: allowanceLine(limits),
          holderLabel: "Workspace",
          holder: businessName,
          dateLabel: "Valid thru",
          date: validThru(cardEndsAt(subscription), tz),
        }}
      />
      <div className="grid gap-1 text-sm">
        {subscription.status === "TRIALING" && subscription.trialEndsAt ? (
          <p className="text-muted-foreground">Free trial {lapsed ? "ended" : "ends"} on {formatDate(subscription.trialEndsAt, tz)}.</p>
        ) : null}
        {subscription.status === "ACTIVE" ? (
          <p className="text-muted-foreground">
            Paid {isYearly ? "yearly" : "monthly"} until {formatDate(subscription.currentPeriodEnd, tz)}. We&apos;ll remind you {RENEWAL_REMINDER_DAYS} days before it ends.
          </p>
        ) : null}
        {subscription.status === "GRACE" && subscription.graceUntil ? (
          <p className="text-warning">Your paid period ended. Everything keeps working until {formatDate(subscription.graceUntil, tz)}. Renew to avoid interruption.</p>
        ) : null}
        {lapsed ? <p className="text-destructive">AI replies and automations are paused. Your data is safe; choose a plan below to resume.</p> : null}
      </div>
    </div>
  );
}

function payLabel(interval: BillingInterval, isRenewal: boolean, price: string): string {
  if (interval === "MONTHLY") return isRenewal ? "Pay next month" : `Pay ${price} for a month`;
  return isRenewal ? "Pay next year" : `Pay ${price} for a year`;
}

function toDeckPlan(plan: Overview["plans"][number], index: number, subscription: Overview["subscription"], canPay: boolean): DeckPlan {
  const isCurrent = subscription?.planId === plan.id && subscription.status === "ACTIVE";
  const saving = yearlySavingMinor(plan.priceMonthlyMinor, plan.priceYearlyMinor);
  const payButton = (interval: BillingInterval, priceMinor: number) => (
    <ActionButton
      action={startCheckoutAction}
      values={{ planCode: plan.code, interval }}
      label={payLabel(interval, isCurrent && subscription?.interval === interval, formatMoney(priceMinor, plan.currency))}
      variant="default"
    />
  );
  return {
    id: plan.id,
    front: {
      finish: cardFinish(index),
      headline: formatMoney(plan.priceMonthlyMinor, plan.currency),
      headlineNote: "a month",
      allowance: allowanceLine(plan.limits),
      holderLabel: "Plan",
      holder: plan.name,
      headingLevel: 3,
      tag: isCurrent ? "Current" : undefined,
    },
    back: {
      headline: formatMoney(plan.priceYearlyMinor, plan.currency),
      headlineNote: "a year",
      note: saving ? `Saves ${formatMoney(saving, plan.currency)} against monthly` : undefined,
      signature: plan.name,
      headingLevel: 3,
      finePrint: "One payment covers a full year. Nothing renews automatically.",
    },
    details: (
      <>
        {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
        {plan.features.length ? (
          <ul className="mt-4 grid gap-1.5 border-t pt-4 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-sun" aria-hidden="true" /> {feature}
              </li>
            ))}
          </ul>
        ) : null}
      </>
    ),
    actions: canPay ? { MONTHLY: payButton("MONTHLY", plan.priceMonthlyMinor), YEARLY: payButton("YEARLY", plan.priceYearlyMinor) } : undefined,
  };
}

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  if (!context.can("billing.manage")) return <AccessDenied what="billing" />;
  const payment = (await searchParams).payment;
  const overview = await getBillingOverview(context.businessId);
  const { subscription, limits, usage } = overview;
  const tz = context.business.timezone;
  const lapsed = isSubscriptionLapsed(subscription);
  const canPay = overview.paymentsConfigured && Boolean(context.user.emailVerifiedAt);
  // The query string only picks the wording; "confirmed" is shown only when the latest payment really succeeded.
  const latest = overview.payments[0];
  const outcome = typeof payment === "string" && Object.hasOwn(PAYMENT_MESSAGES, payment) ? payment : null;
  const notice = outcome === "success" && latest?.status !== "SUCCESS" ? undefined : outcome ? PAYMENT_MESSAGES[outcome] : undefined;
  const status = subscription ? (lapsed && subscription.status === "TRIALING" ? { dot: "bg-destructive", label: "Trial ended" } : STATUS[subscription.status]) : null;

  return (
    <>
      <PageHeader title="Billing" description="Prices are in Ghana cedis. Paystack handles card and mobile money payments; we never see your card or MoMo details." />

      {notice ? (
        <div
          role="status"
          className={cn(
            "mb-6 rounded-xl border p-4 text-sm",
            notice.tone === "success" && "border-success/30 bg-success/10",
            notice.tone === "warning" && "border-warning/30 bg-warning/10",
            notice.tone === "destructive" && "border-destructive/30 bg-destructive/10",
          )}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Current plan" aside={status ? <StatusLabel {...status} /> : null}>
          <CurrentPlan overview={overview} businessName={context.business.name} tz={tz} />
        </Panel>

        <Panel title="Usage this month">
          <div className="grid gap-4 px-5 pt-1 pb-5">
            <Meter label="AI replies" used={usage.aiMessages} limit={limits.aiMessagesPerMonth} />
            <Meter label="Automation runs" used={usage.workflowExecutions} limit={limits.workflowExecutionsPerMonth} />
            <Meter label="Connected channels" used={usage.channels} limit={limits.channels} />
            <Meter label="Team seats (incl. invitations)" used={usage.seats} limit={limits.staffSeats} />
            <Meter label="Knowledge storage" used={usage.storageMb} limit={limits.knowledgeStorageMb} unit=" MB" />
          </div>
        </Panel>
      </div>

      <section className="mt-10" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-[15px] font-semibold tracking-[-0.01em]">
          Plans
        </h2>
        <p className="mt-1 mb-5 max-w-3xl text-sm text-muted-foreground">
          Each payment covers one month or one year, and nothing renews automatically. Paying early for your current plan extends it; switching plans starts the new one today and credits your unused time. If a period ends, you have {GRACE_DAYS} days of grace.
        </p>
        {!overview.paymentsConfigured ? (
          <p className="mb-5 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">Online payments are not configured on this platform yet. Contact SUNLEON AI support to activate a plan.</p>
        ) : !context.user.emailVerifiedAt ? (
          <p className="mb-5 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">Confirm your email address before paying. Paystack sends your receipt there.</p>
        ) : null}
        <PlanDeck
          plans={overview.plans.map((plan, index) => toDeckPlan(plan, index, subscription, canPay))}
          bonusLabel={freeMonthsLabel(overview.plans)}
          gridClassName="sm:grid-cols-2 xl:grid-cols-3"
        />
      </section>

      <section className="mt-12 surface rounded-[1.25rem] p-6">
        <h2 className="mb-3 font-semibold">Payment history</h2>
        {overview.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Plan</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {overview.payments.map((transaction) => {
                  const metadata = (transaction.metadata ?? {}) as { planCode?: string; interval?: string };
                  return (
                    <tr key={transaction.id} className="border-t">
                      <td className="py-2">{formatDate(transaction.paidAt ?? transaction.createdAt, tz)}</td>
                      <td className="py-2">
                        {metadata.planCode ?? "Unknown"} {metadata.interval ? <span className="text-muted-foreground">· {metadata.interval.toLowerCase()}</span> : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(transaction.amountMinor, transaction.currency)}</td>
                      <td className="py-2">
                        <Badge variant={TX_STATUS[transaction.status] ?? "outline"}>{transaction.status.toLowerCase()}</Badge>
                        {transaction.failureReason ? <span className="ml-2 text-xs text-muted-foreground">{transaction.failureReason}</span> : null}
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{transaction.reference}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
