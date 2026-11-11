import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, Coins, CreditCard, Inbox, Wallet, Webhook } from "lucide-react";
import { BUSINESS_STATUS, SUBSCRIPTION_STATUS } from "@/components/admin/admin-status";
import { Metric, MetricStrip, PageHeader, Panel, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { industryLabel } from "@/config/industries";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { getPlatformOverview, listBusinesses } from "@/modules/administration/admin.service";
import { isAiGloballyEnabled } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Overview" };

const SUBSCRIPTION_ORDER: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE", "GRACE", "EXPIRED", "CANCELLED"];

function Row({ children, href }: { children: React.ReactNode; href?: string }) {
  const className = "flex min-w-0 items-center gap-3 border-t px-5 py-3 first:border-t-0";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-foreground/3`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** A count that needs a look: amber dot beside it when non-zero, green when clear. */
function AttentionRow({ label, count, href, clear = "None" }: { label: string; count: number; href: string; clear?: string }) {
  return (
    <Row href={href}>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <StatusLabel dot={count ? "bg-warning" : "bg-success"} label={count ? formatNumber(count) : clear} />
    </Row>
  );
}

export default async function AdminOverviewPage() {
  if (!(await requireAdminConsole())) return null;
  const [overview, aiEnabled, newest] = await Promise.all([getPlatformOverview(), isAiGloballyEnabled(), listBusinesses({ page: 1 })]);
  const subscriptions = overview.subscriptions;
  const failed = overview.failedJobs + overview.failedWebhooks;
  const now = new Date();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Overview" description="Live figures from the platform database. Revenue counts verified Paystack payments in the last 30 days." />
      {!aiEnabled ? (
        <p className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          AI is switched off for every workspace. <Link href="/admin/settings" className="font-medium text-foreground link-underline">Change in Settings</Link>
        </p>
      ) : null}

      <MetricStrip label="Key numbers">
        <Metric
          label="Active businesses"
          value={formatNumber(overview.businesses.active)}
          hint={`${formatNumber(overview.businesses.suspended)} suspended · ${formatNumber(overview.businesses.total)} total`}
          icon={Building2}
          href="/admin/businesses"
        />
        <Metric label="Paying subscriptions" value={formatNumber(subscriptions.ACTIVE ?? 0)} hint={`${formatNumber(subscriptions.TRIALING ?? 0)} on a free trial`} icon={CreditCard} />
        <Metric label="Revenue, 30 days" value={formatMoney(overview.revenue30d.amountMinor, "GHS")} hint={`${formatNumber(overview.revenue30d.payments)} payments`} icon={Wallet} />
        <Metric label="AI cost, 30 days" value={formatMoney(Math.round(overview.aiCost30dMicros / 10_000), "USD")} hint="Estimate at list prices" icon={Coins} />
        <Metric label="Failures" value={formatNumber(failed)} hint="Failed jobs and webhooks" icon={Webhook} href="/admin/monitoring" />
        <Metric label="New inquiries" value={formatNumber(overview.newInquiries)} hint="From the contact page" icon={Inbox} href="/admin/inquiries" />
      </MetricStrip>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Newest businesses" href="/admin/businesses">
          {newest.rows.length === 0 ? (
            <PanelEmpty icon={Building2}>No businesses yet. New workspaces show here as owners sign up.</PanelEmpty>
          ) : (
            <div className="flex flex-1 flex-col">
              {newest.rows.slice(0, 8).map((business) => (
                <Row key={business.id} href={`/admin/businesses/${business.id}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{business.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {industryLabel(business.industry)} · {formatRelative(business.createdAt, now)}
                    </span>
                  </span>
                  <span className="grid shrink-0 justify-items-end gap-0.5">
                    <StatusLabel {...BUSINESS_STATUS[business.status]} />
                    {business.subscription ? (
                      <span className="text-xs text-muted-foreground">
                        {business.subscription.plan.name} · {SUBSCRIPTION_STATUS[business.subscription.status].label.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No plan</span>
                    )}
                  </span>
                </Row>
              ))}
              <Link
                href="/admin/businesses"
                className="mt-auto flex items-center justify-center gap-1 border-t px-5 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                All {formatNumber(newest.total)} businesses <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </Panel>

        <div className="grid content-start gap-6">
          <Panel title="Needs attention">
            <div className="pb-1">
              <AttentionRow label="Failed jobs" count={overview.failedJobs} href="/admin/monitoring" />
              <AttentionRow label="Webhook problems" count={overview.failedWebhooks} href="/admin/monitoring" />
              <AttentionRow label="Errors in the last 24 hours" count={overview.errors24h} href="/admin/monitoring" />
              <AttentionRow label="New contact inquiries" count={overview.newInquiries} href="/admin/inquiries" />
              <Row href="/admin/settings">
                <span className="min-w-0 flex-1 truncate text-sm">AI replies</span>
                <StatusLabel dot={aiEnabled ? "bg-success" : "bg-destructive"} label={aiEnabled ? "On for everyone" : "Off for everyone"} />
              </Row>
            </div>
          </Panel>

          <Panel title="Subscriptions">
            <div className="pb-1">
              {SUBSCRIPTION_ORDER.map((status) => (
                <Row key={status}>
                  <StatusLabel {...SUBSCRIPTION_STATUS[status]} className="flex-1 text-sm text-foreground" />
                  <span className="text-sm font-medium">{formatNumber(subscriptions[status] ?? 0)}</span>
                </Row>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
