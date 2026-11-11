import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditCard, Headset, MessageCircle, Plug, ScrollText, UsersRound } from "lucide-react";
import { BUSINESS_STATUS, CHANNEL_LABEL, INTEGRATION_STATUS, PAYMENT_STATUS, SUBSCRIPTION_STATUS } from "@/components/admin/admin-status";
import { Metric, MetricStrip, PageHeader, Panel, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { ROLE_LABELS } from "@/config/permissions";
import { industryLabel } from "@/config/industries";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { isAppError } from "@/lib/monitoring/errors";
import { addSupportNoteAction, grantSubscriptionAction, setBusinessStatusAction } from "@/modules/administration/admin.actions";
import { getBusinessDetail } from "@/modules/administration/admin.service";

export const metadata: Metadata = { title: "Business" };

const ROW = "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t px-5 py-3 text-sm first:border-t-0";

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminConsole())) return null;
  const { id } = await params;
  const detail = await getBusinessDetail(id).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const { business, limits, usage, payments, audit, plans } = detail;
  const tz = business.timezone;
  const subscription = business.subscription;
  const connected = business.integrations.filter((integration) => integration.status === "CONNECTED" && integration.channel !== "SANDBOX").length;
  const withTwoFactor = business.memberships.filter((membership) => membership.user.mfaEnabled).length;

  return (
    <>
      <PageHeader
        eyebrow={industryLabel(business.industry)}
        title={business.name}
        description={`${business.slug} · ${business.city ?? business.country} · created ${formatDate(business.createdAt, tz)}`}
        actions={<StatusLabel {...BUSINESS_STATUS[business.status]} className="text-sm" />}
      />

      <MetricStrip label="Workspace at a glance">
        <Metric
          label="Plan"
          value={subscription?.plan.name ?? "None"}
          hint={subscription ? `${SUBSCRIPTION_STATUS[subscription.status].label} until ${formatDate(subscription.trialEndsAt ?? subscription.currentPeriodEnd, tz)}` : "No subscription"}
          icon={CreditCard}
        />
        <Metric label="AI replies this month" value={formatNumber(usage.aiMessages)} hint={`of ${formatNumber(limits.aiMessagesPerMonth)} on the plan`} icon={Headset} />
        <Metric label="Members" value={formatNumber(business.memberships.length)} hint={`${formatNumber(withTwoFactor)} with two-factor on`} icon={UsersRound} />
        <Metric label="Channels connected" value={formatNumber(connected)} hint={`of ${formatNumber(limits.channels)} allowed`} icon={Plug} />
      </MetricStrip>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Activate or extend the plan">
          <div className="grid gap-3 px-5 pb-5">
            <p className="text-sm text-muted-foreground">For payments received outside Paystack or goodwill extensions. Recorded in the audit log.</p>
            <QuickForm
              action={grantSubscriptionAction}
              submitLabel="Activate plan"
              hidden={{ businessId: business.id }}
              columns={2}
              fields={[
                { name: "planId", label: "Plan", type: "select", options: plans.map((plan) => ({ value: plan.id, label: plan.name })) },
                { name: "months", label: "Months", type: "number", defaultValue: "1" },
                { name: "reason", label: "Reason", placeholder: "Bank transfer ref. 2026-11-08 / goodwill", span: "full" },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Workspace status" aside={<StatusLabel {...BUSINESS_STATUS[business.status]} />}>
          <div className="grid gap-3 px-5 pb-5">
            <p className="text-sm text-muted-foreground">Suspending keeps all data, blocks the workspace and stops AI replies. Restoring re-enables everything.</p>
            <QuickForm
              action={setBusinessStatusAction}
              variant={business.status === "ACTIVE" ? "destructive" : "default"}
              submitLabel={business.status === "ACTIVE" ? "Suspend workspace" : "Restore workspace"}
              hidden={{ businessId: business.id, status: business.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }}
              fields={[{ name: "reason", label: "Reason", placeholder: business.status === "ACTIVE" ? "Policy violation reported on 8 Nov" : "Issue resolved with owner" }]}
            />
          </div>
        </Panel>

        <Panel title={`Members (${business.memberships.length})`}>
          <div className="pb-1">
            {business.memberships.map((membership) => (
              <div key={membership.id} className={ROW}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{membership.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{membership.user.email}</span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {ROLE_LABELS[membership.role]}
                  {membership.status !== "ACTIVE" ? <StatusLabel dot="bg-destructive" label="Suspended" /> : null}
                  {membership.user.mfaEnabled ? <StatusLabel dot="bg-success" label="2FA on" /> : null}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Channels">
          {business.integrations.length === 0 ? (
            <PanelEmpty icon={MessageCircle}>No channels connected yet.</PanelEmpty>
          ) : (
            <div className="pb-1">
              {business.integrations.map((integration) => (
                <div key={integration.id} className={ROW}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{CHANNEL_LABEL[integration.channel]}</span>
                    <span className="block truncate text-xs text-muted-foreground">{integration.displayHandle ?? integration.externalAccountName ?? "No handle"}</span>
                    {integration.lastError ? <span className="block text-xs wrap-break-word text-destructive">{integration.lastError}</span> : null}
                  </span>
                  <StatusLabel {...INTEGRATION_STATUS[integration.status]} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Payments">
          {payments.length === 0 ? (
            <PanelEmpty icon={CreditCard}>No payments yet.</PanelEmpty>
          ) : (
            <div className="pb-1">
              {payments.map((payment) => (
                <div key={payment.id} className={ROW}>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{payment.reference}</span>
                  <span className="font-medium whitespace-nowrap">{formatMoney(payment.amountMinor, payment.currency)}</span>
                  <StatusLabel {...PAYMENT_STATUS[payment.status]} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Support notes">
          <div className="grid gap-4 px-5 pb-5">
            <QuickForm action={addSupportNoteAction} submitLabel="Add note" hidden={{ businessId: business.id }} fields={[{ name: "body", label: "Note (internal, never shown to the business)", type: "textarea" }]} />
            {business.supportNotes.length ? (
              <ul className="grid gap-2 text-sm">
                {business.supportNotes.map((note) => (
                  <li key={note.id} className="rounded-xl bg-foreground/4 p-3">
                    <p className="whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(note.createdAt, tz)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Recent activity" className="mt-6 h-auto">
        {audit.length === 0 ? (
          <PanelEmpty icon={ScrollText}>No recorded activity yet.</PanelEmpty>
        ) : (
          <div className="pb-1">
            {audit.map((entry) => (
              <div key={entry.id} className={ROW}>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.action}</span>
                <span className="text-xs text-muted-foreground">by {entry.actorType.toLowerCase()}</span>
                <span className="w-full text-xs text-muted-foreground sm:w-auto">{formatDateTime(entry.createdAt, tz)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
