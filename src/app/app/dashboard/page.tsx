import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, ChevronRight, MessagesSquare, ShoppingBag, Target, Users } from "lucide-react";
import { StatCard } from "@/components/app/page-primitives";
import { DailyColumnChart } from "@/components/analytics/daily-column-chart";
import { Button } from "@/components/ui/button";
import { getAnalytics } from "@/modules/analytics/analytics.service";
import { getSetupProgress } from "@/modules/onboarding/setup.service";
import { industryLabel } from "@/config/industries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/auth/tenant";
import { formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const CHANNEL_DOT = { WHATSAPP: "bg-[#25d366]", INSTAGRAM: "bg-[#e1306c]", SANDBOX: "bg-foreground/30" } as const;

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
    <svg viewBox="0 0 52 52" className="size-14 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="5" className="stroke-white/15" />
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-sun"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />
    </svg>
  );
}

function Panel({ title, href, linkLabel, children, className }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface overflow-hidden rounded-[1.25rem]", className)}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {href ? (
          <Link href={href} className="flex items-center gap-0.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            {linkLabel ?? "See all"} <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-[12px] font-semibold text-foreground/75">{letters || "?"}</span>;
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
  const timeFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone });

  return (
    <>
      <header className="mb-10">
        <p className="text-[13px] text-muted-foreground">
          {dateLine} · {context.business.name} · {industryLabel(context.business.industry)}
        </p>
        <h1 className="mt-2 font-display text-5xl leading-none font-normal tracking-[-0.02em] sm:text-6xl">{greeting}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">Here&apos;s what&apos;s happening at {context.business.name} today.</p>
      </header>

      {!setup.isComplete ? (
        <section className="grain mb-8 flex flex-col gap-5 rounded-[1.5rem] bg-[#1d1a16] p-5 ring-1 ring-white/8 text-[#f3efe7] sm:flex-row sm:items-center sm:p-6">
          <div className="flex flex-1 items-center gap-4">
            <ProgressRing value={setup.finished} total={setup.total} />
            <div>
              <p className="font-semibold">Finish setting up your assistant</p>
              <p className="text-sm text-white/60">
                {setup.finished} of {setup.total} steps complete{nextStep ? `. Next: ${nextStep.title}.` : "."}
              </p>
            </div>
          </div>
          <Button asChild className="bg-sun text-[#1d1a16] hover:bg-sun/90 dark:bg-sun dark:text-[#1d1a16]">
            <Link href="/app/setup">
              Continue setup <ArrowRight />
            </Link>
          </Button>
        </section>
      ) : null}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Open conversations" value={openConversations} icon={MessagesSquare} tone="violet" href={context.can("inbox.read") ? "/app/inbox" : undefined} />
        <StatCard label="Customers" value={customers} icon={Users} tone="azure" href={context.can("customers.read") ? "/app/customers" : undefined} />
        <StatCard label="New leads" value={newLeads} icon={Target} tone="success" href={context.can("leads.read") ? "/app/leads" : undefined} />
        <StatCard label="Orders this month" value={ordersThisMonth} icon={ShoppingBag} href={context.can("orders.read") ? "/app/orders" : undefined} />
        <StatCard label="Upcoming bookings" value={upcomingBookings} icon={CalendarClock} tone="warning" href={context.can("bookings.read") ? "/app/bookings" : undefined} />
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {context.can("inbox.read") ? (
          <Panel title="Latest conversations" href="/app/inbox" linkLabel="Inbox">
            {conversations.length === 0 ? (
              <p className="px-5 pt-2 pb-6 text-sm text-muted-foreground">
                No conversations yet. Connect WhatsApp or Instagram, or try the sandbox in{" "}
                <Link href="/app/integrations" className="link-underline text-foreground">Integrations</Link>.
              </p>
            ) : (
              <ul className="pb-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/app/inbox?conversation=${conversation.id}`}
                      className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/4.5"
                    >
                      <span className="relative">
                        <Initials name={conversation.customer.displayName} />
                        <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card", CHANNEL_DOT[conversation.channel])} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={cn("truncate text-[14px]", conversation.unreadCount > 0 ? "font-semibold" : "font-medium")}>{conversation.customer.displayName}</span>
                          <span className="shrink-0 text-[12px] text-muted-foreground">{formatRelative(conversation.lastMessageAt, now)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] text-muted-foreground">{conversation.lastMessagePreview ?? "No messages yet"}</span>
                          {conversation.control === "HUMAN" ? <span className="shrink-0 rounded-full bg-warning/15 px-1.5 text-[10.5px] font-medium text-warning">You</span> : null}
                          {conversation.unreadCount > 0 ? (
                            <span className="ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-full bg-sun px-1.5 text-[11px] leading-5 font-semibold text-[#1d1a16]">
                              {conversation.unreadCount}
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
            title="Conversations this week"
            valueLabel="conversations"
            emptyMessage="No conversations in the last 7 days."
            data={analytics.daily.map((point) => ({ date: point.date, value: point.conversations, display: String(point.conversations) }))}
          />
        ) : null}

        {context.can("bookings.read") ? (
          <Panel title="Coming up" href="/app/bookings" linkLabel="Bookings">
            {bookings.length === 0 ? (
              <p className="px-5 pt-2 pb-6 text-sm text-muted-foreground">No upcoming bookings.</p>
            ) : (
              <ul className="divide-y px-5 pb-2">
                {bookings.map((booking) => (
                  <li key={booking.id} className="flex items-center gap-4 py-3">
                    <span className="w-24 shrink-0 text-[13px] font-medium tabular-nums">{timeFormat.format(booking.startsAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{booking.service.name}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {booking.customer.displayName} · {booking.staff.name}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {context.can("orders.read") ? (
          <Panel title="Recent orders" href="/app/orders" linkLabel="Orders">
            {orders.length === 0 ? (
              <p className="px-5 pt-2 pb-6 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="divide-y px-5 pb-2">
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center gap-4 py-3">
                    <span className="w-14 shrink-0 font-mono text-[13px] text-muted-foreground">#{order.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{order.customer.displayName}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{formatRelative(order.createdAt, now)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-semibold tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
                      <span className={cn("block text-[12px]", order.paymentStatus === "PAID" ? "text-success" : "text-muted-foreground")}>
                        {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus.charAt(0) + order.paymentStatus.slice(1).toLowerCase()}
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
