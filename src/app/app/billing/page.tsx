import type { Metadata } from "next";
import { AccessDenied, PageHeader } from "@/components/app/page-primitives";
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

const PAYMENT_MESSAGES: Record<string, { tone: "success" | "warning" | "destructive"; text: string }> = {
  success: { tone: "success", text: "Payment confirmed with Paystack. Your plan is active." },
  pending: { tone: "warning", text: "Paystack hasn't confirmed this payment yet. We'll activate your plan as soon as it does, so there's no need to pay again." },
  failed: { tone: "destructive", text: "The payment didn't go through. You have not been charged for this attempt." },
  unknown: { tone: "warning", text: "We couldn't match that payment to this workspace. If you were charged, contact support with your Paystack receipt." },
};

const STATUS_LABEL: Record<string, string> = { TRIALING: "Free trial", ACTIVE: "Active", PAST_DUE: "Payment due", GRACE: "Grace period", CANCELLED: "Cancelled", EXPIRED: "Expired" };

const TX_STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { SUCCESS: "default", PENDING: "outline", FAILED: "destructive", ABANDONED: "secondary", REVERSED: "destructive" };

function Meter({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm">
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
        <section className="surface rounded-[1.25rem] p-6">
          <h2 className="font-semibold">Current plan</h2>
          {subscription ? (
            <div className="mt-3 grid gap-1 text-sm">
              <p className="flex items-center gap-2 text-lg font-semibold">
                {subscription.plan.name} <Badge variant={lapsed ? "destructive" : "secondary"}>{lapsed && subscription.status === "TRIALING" ? "Trial ended" : STATUS_LABEL[subscription.status]}</Badge>
              </p>
              {subscription.status === "TRIALING" && subscription.trialEndsAt ? (
                <p className="text-muted-foreground">Free trial {lapsed ? "ended" : "ends"} on {formatDate(subscription.trialEndsAt, tz)}.</p>
              ) : null}
              {subscription.status === "ACTIVE" ? (
                <p className="text-muted-foreground">
                  Paid {subscription.interval === "YEARLY" ? "yearly" : "monthly"} until {formatDate(subscription.currentPeriodEnd, tz)}. We&apos;ll remind you {RENEWAL_REMINDER_DAYS} days before it ends.
                </p>
              ) : null}
              {subscription.status === "GRACE" && subscription.graceUntil ? (
                <p className="text-warning">Your paid period ended. Everything keeps working until {formatDate(subscription.graceUntil, tz)}. Renew to avoid interruption.</p>
              ) : null}
              {lapsed ? <p className="text-destructive">AI replies and automations are paused. Your data is safe; choose a plan below to resume.</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No plan yet. Choose one below.</p>
          )}
        </section>

        <section className="surface rounded-[1.25rem] p-6">
          <h2 className="mb-4 font-semibold">Usage this month</h2>
          <div className="grid gap-4">
            <Meter label="AI replies" used={usage.aiMessages} limit={limits.aiMessagesPerMonth} />
            <Meter label="Automation runs" used={usage.workflowExecutions} limit={limits.workflowExecutionsPerMonth} />
            <Meter label="Connected channels" used={usage.channels} limit={limits.channels} />
            <Meter label="Team seats (incl. invitations)" used={usage.seats} limit={limits.staffSeats} />
            <Meter label="Knowledge storage" used={usage.storageMb} limit={limits.knowledgeStorageMb} unit=" MB" />
          </div>
        </section>
      </div>

      <section className="mt-6" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="mb-1 font-semibold">
          Plans
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Each payment covers one month or one year, and nothing renews automatically. Paying early for your current plan extends it; switching plans starts the new one today and credits your unused time. If a period ends, you have {GRACE_DAYS} days of grace.
        </p>
        {!overview.paymentsConfigured ? (
          <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">Online payments are not configured on this platform yet. Contact SUNLEON AI support to activate a plan.</p>
        ) : !context.user.emailVerifiedAt ? (
          <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">Confirm your email address before paying. Paystack sends your receipt there.</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          {overview.plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id && subscription.status === "ACTIVE";
            return (
              <article key={plan.id} className={cn("flex flex-col surface rounded-[1.25rem] p-6", isCurrent && "border-primary")}>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {plan.name} {isCurrent ? <Badge>Current</Badge> : null}
                </h3>
                {plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}
                <p className="mt-4 text-2xl font-bold tabular-nums">
                  {formatMoney(plan.priceMonthlyMinor, plan.currency)}
                  <span className="text-sm font-normal text-muted-foreground"> / month</span>
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">or {formatMoney(plan.priceYearlyMinor, plan.currency)} / year</p>
                <ul className="mt-4 grid flex-1 content-start gap-1.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature}>✓ {feature}</li>
                  ))}
                </ul>
                {canPay ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <ActionButton action={startCheckoutAction} values={{ planCode: plan.code, interval: "MONTHLY" }} label={isCurrent && subscription.interval === "MONTHLY" ? "Pay next month" : "Pay monthly"} variant="default" />
                    <ActionButton action={startCheckoutAction} values={{ planCode: plan.code, interval: "YEARLY" }} label={isCurrent && subscription.interval === "YEARLY" ? "Pay next year" : "Pay yearly"} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 surface rounded-[1.25rem] p-6">
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
