import type { Metadata } from "next";
import Link from "next/link";
import { Bot, CalendarClock, MessagesSquare, ShoppingBag, Target, Wallet } from "lucide-react";
import { DailyColumnChart } from "@/components/analytics/daily-column-chart";
import { AccessDenied, PageHeader, StatCard } from "@/components/app/page-primitives";
import { formatMoney, formatNumber } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { cn } from "@/lib/utils";
import { ANALYTICS_RANGES, getAnalytics, parseRange } from "@/modules/analytics/analytics.service";

export const metadata: Metadata = { title: "Analytics" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const percent = (value: number | null) => (value === null ? "n/a" : new Intl.NumberFormat("en-GH", { style: "percent", maximumFractionDigits: 0 }).format(value));
/** AI cost is stored in micro-USD. */
const usd = (micros: number) => formatMoney(Math.round(micros / 10_000), "USD");

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  if (!context.can("analytics.read")) return <AccessDenied what="analytics" />;
  const days = parseRange((await searchParams).days);
  const data = await getAnalytics(context.businessId, days);
  const money = (minor: number) => formatMoney(minor, data.currency);

  return (
    <>
      <PageHeader title="Analytics" description={`Counted from your own conversations, orders, bookings and leads, by day in ${data.timezone}.`} />

      <nav aria-label="Date range" className="mb-6 flex flex-wrap gap-2">
        {ANALYTICS_RANGES.map((range) => (
          <Link
            key={range}
            href={`/app/analytics?days=${range}`}
            aria-current={range === days ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", range === days ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            Last {range} days
          </Link>
        ))}
      </nav>

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="New conversations" value={formatNumber(data.conversations.started)} hint={`${formatNumber(data.conversations.inbound)} customer messages`} icon={MessagesSquare} tone="violet" />
        <StatCard
          label="AI replies"
          value={formatNumber(data.conversations.aiReplies)}
          hint={`${formatNumber(data.conversations.staffReplies)} by your team · ${percent(data.ai.escalationRate)} of AI runs escalated`}
          icon={Bot}
          tone="azure"
        />
        <StatCard label="AI cost (estimate)" value={usd(data.ai.costMicros)} hint={`${formatNumber(data.ai.runs)} AI runs, excluding the test console`} icon={Wallet} />
        <StatCard label="Orders" value={formatNumber(data.sales.orders)} hint={`${money(data.sales.revenueMinor)} total · ${formatNumber(data.sales.aiOrders)} taken by AI`} icon={ShoppingBag} tone="success" />
        <StatCard
          label="Bookings made"
          value={formatNumber(data.bookings.created)}
          hint={`${formatNumber(data.bookings.upcoming)} in the next 7 days · ${formatNumber(data.bookings.cancelled)} cancelled or no-show`}
          icon={CalendarClock}
          tone="warning"
        />
        <StatCard label="New leads" value={formatNumber(data.leads.created)} hint={`${formatNumber(data.leads.won)} won · ${formatNumber(data.leads.open)} open · win rate ${percent(data.leads.winRate)}`} icon={Target} />
      </section>

      <section aria-label="Daily trends" className="mt-6 grid gap-4 lg:grid-cols-2">
        <DailyColumnChart
          title="New conversations per day"
          valueLabel="conversations"
          emptyMessage="No new conversations in this period."
          data={data.daily.map((point) => ({ date: point.date, value: point.conversations, display: formatNumber(point.conversations) }))}
        />
        <DailyColumnChart
          title="Order value per day"
          valueLabel="in orders"
          emptyMessage="No orders in this period."
          data={data.daily.map((point) => ({ date: point.date, value: point.revenueMinor, display: money(point.revenueMinor) }))}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Sales</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Figure label="Order value" value={money(data.sales.revenueMinor)} />
            <Figure label="Recorded as paid" value={money(data.sales.paidMinor)} />
            <Figure label="Average order" value={data.sales.averageOrderMinor === null ? "n/a" : money(data.sales.averageOrderMinor)} />
            <Figure label="Orders taken by AI" value={formatNumber(data.sales.aiOrders)} />
          </dl>
          <h3 className="mt-5 text-sm font-semibold">Top products</h3>
          {data.sales.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No products sold in this period.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 text-right font-medium">Units</th>
                  <th className="py-1 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.sales.topProducts.map((product) => (
                  <tr key={product.name} className="border-t">
                    <td className="py-1.5">{product.name}</td>
                    <td className="py-1.5 text-right">{formatNumber(product.quantity)}</td>
                    <td className="py-1.5 text-right">{money(product.revenueMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Assistant</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Figure label="Answered" value={formatNumber(data.ai.succeeded)} />
            <Figure label="Escalated to your team" value={formatNumber(data.ai.escalated)} />
            <Figure label="Held back by your rules" value={formatNumber(data.ai.blocked)} />
            <Figure label="Failed" value={formatNumber(data.ai.failed)} />
            <Figure label="Automation messages" value={formatNumber(data.conversations.automationMessages)} />
            <Figure label="Cost per AI run" value={data.ai.runs ? usd(data.ai.costMicros / data.ai.runs) : "n/a"} />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">AI cost is estimated from model token usage at list prices and shown in US dollars.</p>
        </div>
      </section>
    </>
  );
}
