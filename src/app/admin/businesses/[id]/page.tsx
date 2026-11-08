import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/config/permissions";
import { industryLabel } from "@/config/industries";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { isAppError } from "@/lib/monitoring/errors";
import { addSupportNoteAction, grantSubscriptionAction, setBusinessStatusAction } from "@/modules/administration/admin.actions";
import { getBusinessDetail } from "@/modules/administration/admin.service";

export const metadata: Metadata = { title: "Business" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminConsole())) return null;
  const { id } = await params;
  const detail = await getBusinessDetail(id).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const { business, limits, usage, payments, audit, plans } = detail;
  const tz = business.timezone;

  return (
    <>
      <PageHeader
        eyebrow={industryLabel(business.industry)}
        title={business.name}
        description={`${business.slug} · ${business.city ?? business.country} · created ${formatDate(business.createdAt, tz)}`}
        actions={<Badge variant={business.status === "ACTIVE" ? "secondary" : "destructive"}>{business.status.toLowerCase()}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Subscription">
          {business.subscription ? (
            <p className="text-sm">
              <span className="font-medium">{business.subscription.plan.name}</span> · {business.subscription.status.toLowerCase()} · until {formatDate(business.subscription.trialEndsAt ?? business.subscription.currentPeriodEnd, tz)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription.</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            AI replies this month: {formatNumber(usage.aiMessages)} of {formatNumber(limits.aiMessagesPerMonth)}
          </p>
          <h3 className="mt-4 text-sm font-semibold">Activate or extend manually</h3>
          <p className="mb-3 text-xs text-muted-foreground">For payments received outside Paystack or goodwill extensions. Recorded in the audit log.</p>
          <QuickForm
            action={grantSubscriptionAction}
            submitLabel="Activate plan"
            hidden={{ businessId: business.id }}
            columns={2}
            fields={[
              { name: "planId", label: "Plan", type: "select", options: plans.map((plan) => ({ value: plan.id, label: plan.name })) },
              { name: "months", label: "Months", type: "number", defaultValue: "1" },
              { name: "reason", label: "Reason", placeholder: "Bank transfer ref. 2026-11-08 / goodwill" },
            ]}
          />
        </Card>

        <Card title="Workspace status">
          <p className="mb-3 text-sm text-muted-foreground">Suspending keeps all data, blocks the workspace and stops AI replies. Restoring re-enables everything.</p>
          <QuickForm
            action={setBusinessStatusAction}
            submitLabel={business.status === "ACTIVE" ? "Suspend workspace" : "Restore workspace"}
            hidden={{ businessId: business.id, status: business.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }}
            fields={[{ name: "reason", label: "Reason", placeholder: business.status === "ACTIVE" ? "Policy violation reported on 8 Nov" : "Issue resolved with owner" }]}
          />
        </Card>

        <Card title={`Members (${business.memberships.length})`}>
          <ul className="divide-y text-sm">
            {business.memberships.map((membership) => (
              <li key={membership.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1">
                  {membership.user.name} <span className="text-muted-foreground">· {membership.user.email}</span>
                </span>
                <Badge variant="outline">{ROLE_LABELS[membership.role]}</Badge>
                {membership.status !== "ACTIVE" ? <Badge variant="secondary">{membership.status.toLowerCase()}</Badge> : null}
                {membership.user.mfaEnabled ? <Badge variant="secondary">2FA</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Channels">
          {business.integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels connected.</p>
          ) : (
            <ul className="divide-y text-sm">
              {business.integrations.map((integration) => (
                <li key={integration.id} className="py-2">
                  <span className="font-medium">{integration.channel.toLowerCase()}</span> · {integration.status.toLowerCase()} {integration.displayHandle ?? integration.externalAccountName ?? ""}
                  {integration.lastError ? <span className="block text-xs text-destructive">{integration.lastError}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Payments">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments.</p>
          ) : (
            <ul className="divide-y text-sm">
              {payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap gap-2 py-2">
                  <span className="flex-1 font-mono text-xs">{payment.reference}</span>
                  <span className="tabular-nums">{formatMoney(payment.amountMinor, payment.currency)}</span>
                  <Badge variant={payment.status === "SUCCESS" ? "default" : "outline"}>{payment.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Support notes">
          <QuickForm action={addSupportNoteAction} submitLabel="Add note" hidden={{ businessId: business.id }} fields={[{ name: "body", label: "Note (internal, never shown to the business)", type: "textarea" }]} />
          <ul className="mt-4 grid gap-2 text-sm">
            {business.supportNotes.map((note) => (
              <li key={note.id} className="rounded-lg bg-muted/50 p-3">
                <p className="whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(note.createdAt, tz)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        <ul className="divide-y text-sm">
          {audit.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-2 py-2">
              <span className="font-mono text-xs">{entry.action}</span>
              <span className="text-muted-foreground">by {entry.actorType.toLowerCase()}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(entry.createdAt, tz)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
