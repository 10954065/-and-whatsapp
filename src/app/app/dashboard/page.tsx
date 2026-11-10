import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, ChevronRight, MessagesSquare, ShoppingBag, Target, Users, type LucideIcon } from "lucide-react";
import { Metric, MetricStrip } from "@/components/app/page-primitives";
import { DailyColumnChart } from "@/components/analytics/daily-column-chart";
import { Button } from "@/components/ui/button";
import type { PaymentStatus } from "@/generated/prisma/enums";
import { getAnalytics } from "@/modules/analytics/analytics.service";
import { getSetupProgress } from "@/modules/onboarding/setup.service";
import { industryLabel } from "@/config/industries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/auth/tenant";
import { formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const CHANNEL = {
  WHATSAPP: { dot: "bg-whatsapp", label: "WhatsApp" },
  INSTAGRAM: { dot: "bg-instagram", label: "Instagram" },
  SANDBOX: { dot: "bg-foreground/30", label: "Test channel" },
} as const;

/** A dot carries the state; the label always says it, so colour is never the only signal. */
const PAYMENT: Record<PaymentStatus, { dot: string; label: string }> = {
  PAID: { dot: "bg-success", label: "Paid" },
  UNPAID: { dot: "bg-warning", label: "Unpaid" },
  PENDING: { dot: "bg-warning", label: "Pending" },
  PARTIALLY_REFUNDED: { dot: "bg-foreground/30", label: "Partly refunded" },
  REFUNDED: { dot: "bg-foreground/30", label: "Refunded" },
  FAILED: { dot: "bg-destructive", label: "Failed" },
};

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function greetingFor(now: Date, timezone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  if (hour < 12) return "Good morning";
  return hour < 17 ? "Good afternoon" : "Good evening";
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? value / total : 0;
  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center" role="img" aria-label={`${value} of ${total} steps complete`}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="4.5" className="stroke-foreground/8" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          strokeWidth="4.5"
          strokeLinecap="round"
          className="stroke-sun"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <span className="text-[12px] font-semibold tabular-nums" aria-hidden="true">
        {value}/{total}
      </span>
    </span>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="surface flex h-full flex-col overflow-hidden rounded-[1.25rem]">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="-mr-1.5 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {linkLabel ?? "See all"} <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function PanelEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2.5 px-6 pt-1 pb-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-foreground/5 text-foreground/45">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-[12px] font-semibold text-foreground/75">{letters || "?"}</span>;
}

function StatusLabel({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  const params = await searchParams;
  const businessId = context.businessId;
  const timezone = context.business.timezone;
  const now = new Date();
  const canAnalytics = context.can("analytics.read");

  const [customers, openConversations, newLeads, ordersThisMonth, upcomingBookings, conversations, bookings, orders, setup, analytics] = await Promise.all([
    prisma.customer.count({ where: { businessId, deletedAt: null } }),
    prisma.conversation.count({ where: { businessId, status: { in: ["OPEN", "PENDING"] } } }),
    prisma.lead.count({ where: { businessId, status: "NEW" } }),
    prisma.order.count({ where: { businessId, createdAt: { gte: startOfMonthUtc(now) } } }),
    prisma.booking.count({ where: { businessId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    context.can("inbox.read")
      ? prisma.conversation.findMany({
          where: { businessId },
          orderBy: { lastMessageAt: "desc" },
          take: 5,
          select: { id: true, channel: true, control: true, unreadCount: true, lastMessageAt: true, lastMessagePreview: true, customer: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
    context.can("bookings.read")
      ? prisma.booking.findMany({
          where: { businessId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } },
          orderBy: { startsAt: "asc" },
          take: 4,
          select: { id: true, startsAt: true, service: { select: { name: true } }, customer: { select: { displayName: true } }, staff: { select: { name: true } } },
        })
      : Promise.resolve([]),
    context.can("orders.read")
      ? prisma.order.findMany({
          where: { businessId },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { id: true, number: true, totalMinor: true, currency: true, paymentStatus: true, createdAt: true, customer: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
    getSetupProgress(businessId),
    canAnalytics ? getAnalytics(businessId, 7, now) : Promise.resolve(null),
  ]);

  const firstName = context.user.name.split(" ")[0];
  const greeting = params.welcome === "1" ? `Welcome to Sunleon, ${firstName}.` : `${greetingFor(now, timezone)}, ${firstName}.`;
  const dateLine = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: timezone }).format(now);
  const nextStep = setup.steps.find((step) => step.status === "todo");
  const bookingDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: timezone });
  const bookingDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: timezone });
  const bookingTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const weekTotal = analytics ? analytics.daily.reduce((sum, point) => sum + point.conversations, 0) : 0;

  return (
    <>
      <header className="mb-8">
        <p className="text-[13px] text-muted-foreground">
          {dateLine} · {context.business.name} · {industryLabel(context.business.industry)}
        </p>
        <h1 className="mt-2 font-display text-5xl leading-none font-normal tracking-[-0.02em] sm:text-6xl">{greeting}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">Here&apos;s what&apos;s happening at {context.business.name} today.</p>
      </header>

      {!setup.isComplete ? (
        <section className="surface mb-6 flex flex-col gap-5 rounded-[1.25rem] p-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ProgressRing value={setup.finished} total={setup.total} />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-[-0.01em]">Finish setting up your assistant</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{nextStep ? `Next: ${nextStep.title}` : "You're almost there."}</p>
            </div>
          </div>
          <Button asChild className="sm:shrink-0">
            <Link href="/app/setup">
              Continue setup <ArrowRight />
            </Link>
          </Button>
        </section>
      ) : null}

      <MetricStrip label="Key numbers">
        <Metric label="Open conversations" value={openConversations} icon={MessagesSquare} href={context.can("inbox.read") ? "/app/inbox" : undefined} />
        <Metric label="Customers" value={customers} icon={Users} href={context.can("customers.read") ? "/app/customers" : undefined} />
        <Metric label="New leads" value={newLeads} icon={Target} href={context.can("leads.read") ? "/app/leads" : undefined} />
        <Metric label="Orders this month" value={ordersThisMonth} icon={ShoppingBag} href={context.can("orders.read") ? "/app/orders" : undefined} />
        <Metric label="Upcoming bookings" value={upcomingBookings} icon={CalendarClock} href={context.can("bookings.read") ? "/app/bookings" : undefined} />
      </MetricStrip>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {context.can("inbox.read") ? (
          <Panel title="Latest conversations" href="/app/inbox" linkLabel="Inbox">
            {conversations.length === 0 ? (
              <PanelEmpty icon={MessagesSquare}>
                No conversations yet. Connect WhatsApp or Instagram, or try the test channel in{" "}
                <Link href="/app/integrations" className="link-underline text-foreground">
                  Integrations
                </Link>
                .
              </PanelEmpty>
            ) : (
              <ul className="px-2 pb-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/app/inbox?conversation=${conversation.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none hover:bg-foreground/3.5 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="relative">
                        <Initials name={conversation.customer.displayName} />
                        <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card", CHANNEL[conversation.channel].dot)} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={cn("truncate text-[14px]", conversation.unreadCount > 0 ? "font-semibold" : "font-medium")}>
                            {conversation.customer.displayName}
                            <span className="sr-only"> on {CHANNEL[conversation.channel].label}</span>
                          </span>
                          <span className="shrink-0 text-[12px] text-muted-foreground">{formatRelative(conversation.lastMessageAt, now)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-[13px] text-muted-foreground">{conversation.lastMessagePreview ?? "No messages yet"}</span>
                          {conversation.control === "HUMAN" ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/6 px-1.5 text-[11px] leading-4.5 font-medium text-foreground/70">
                              <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                              You&apos;re replying
                            </span>
                          ) : null}
                          {conversation.unreadCount > 0 ? (
                            <span className="ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-full bg-sun px-1.5 text-[11px] leading-5 font-semibold text-sun-foreground">
                              {conversation.unreadCount}
                              <span className="sr-only"> unread</span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {analytics ? (
          <DailyColumnChart
            title="New conversations"
            valueLabel="conversations"
            emptyMessage="No new conversations in the last 7 days."
            summary={
              <>
                <span className="text-[2rem] leading-none font-semibold tracking-[-0.035em]">{weekTotal}</span>
                <span className="ml-2 text-sm text-muted-foreground">this week</span>
              </>
            }
            data={analytics.daily.map((point) => ({ date: point.date, value: point.conversations, display: String(point.conversations) }))}
          />
        ) : null}

        {context.can("orders.read") ? (
          <Panel title="Recent orders" href="/app/orders" linkLabel="Orders">
            {orders.length === 0 ? (
              <PanelEmpty icon={ShoppingBag}>No orders yet. Orders your assistant or team take appear here.</PanelEmpty>
            ) : (
              <ul className="divide-y px-5 pb-2">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link href="/app/orders" className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors outline-none hover:bg-foreground/3.5 focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="w-10 shrink-0 text-[13px] text-muted-foreground tabular-nums">#{order.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{order.customer.displayName}</span>
                        <span className="block text-[12.5px] text-muted-foreground">{formatRelative(order.createdAt, now)}</span>
                      </span>
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="text-[14px] font-semibold tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
                        <StatusLabel {...PAYMENT[order.paymentStatus]} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {context.can("bookings.read") ? (
          <Panel title="Coming up" href="/app/bookings" linkLabel="Bookings">
            {bookings.length === 0 ? (
              <PanelEmpty icon={CalendarClock}>No upcoming bookings. New bookings show here with the time and who is serving.</PanelEmpty>
            ) : (
              <ul className="divide-y px-5 pb-2">
                {bookings.map((booking) => (
                  <li key={booking.id} className="flex items-center gap-4 py-3">
                    <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-foreground/4.5 py-1.5 leading-none">
                      <span className="text-[10.5px] font-medium text-muted-foreground uppercase">{bookingDay.format(booking.startsAt)}</span>
                      <span className="mt-1 text-[16px] font-semibold tabular-nums">{bookingDate.format(booking.startsAt)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{booking.service.name}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {bookingTime.format(booking.startsAt)} · {booking.customer.displayName} · {booking.staff.name}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </>
  );
}
