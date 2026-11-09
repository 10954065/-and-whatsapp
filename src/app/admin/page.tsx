import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CreditCard, Inbox, Wallet, Webhook } from "lucide-react";
import { PageHeader, StatCard } from "@/components/app/page-primitives";
import { formatMoney, formatNumber } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { getPlatformOverview } from "@/modules/administration/admin.service";
import { isAiGloballyEnabled } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  if (!(await requireAdminConsole())) return null;
  const [overview, aiEnabled] = await Promise.all([getPlatformOverview(), isAiGloballyEnabled()]);
  const subscriptions = overview.subscriptions;

  return (
    <>
      <PageHeader eyebrow="Platform" title="Overview" description="Live figures from the platform database. Revenue counts verified Paystack payments in the last 30 days." />
      {!aiEnabled ? (
        <p className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          AI is switched off for every workspace. <Link href="/admin/settings" className="font-medium text-foreground link-underline">Change in Settings</Link>
        </p>
      ) : null}
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active businesses" value={formatNumber(overview.businesses.active)} hint={`${formatNumber(overview.businesses.suspended)} suspended · ${formatNumber(overview.businesses.total)} total`} icon={Building2} tone="violet" />
        <StatCard
          label="Paying subscriptions"
          value={formatNumber(subscriptions.ACTIVE ?? 0)}
          hint={`${formatNumber(subscriptions.TRIALING ?? 0)} trialing · ${formatNumber(subscriptions.GRACE ?? 0)} in grace · ${formatNumber(subscriptions.EXPIRED ?? 0)} expired`}
          icon={CreditCard}
          tone="success"
        />
        <StatCard label="Revenue (30 days)" value={formatMoney(overview.revenue30d.amountMinor, "GHS")} hint={`${formatNumber(overview.revenue30d.payments)} payments`} icon={Wallet} />
        <StatCard label="AI cost (30 days, estimate)" value={formatMoney(Math.round(overview.aiCost30dMicros / 10_000), "USD")} hint="Token usage at list prices" icon={Wallet} tone="azure" />
        <StatCard label="Failed jobs & webhooks" value={formatNumber(overview.failedJobs + overview.failedWebhooks)} hint={`${formatNumber(overview.errors24h)} errors in the last 24 hours`} icon={overview.failedJobs + overview.failedWebhooks ? AlertTriangle : Webhook} tone={overview.failedJobs + overview.failedWebhooks ? "warning" : "default"} />
        <StatCard label="New inquiries" value={formatNumber(overview.newInquiries)} hint={<Link href="/admin/inquiries" className="text-primary hover:underline">Open inquiries</Link>} icon={Inbox} />
      </section>
    </>
  );
}
