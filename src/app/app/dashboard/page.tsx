import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MessagesSquare, ShoppingBag, Target, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/app/page-primitives";
import { Button } from "@/components/ui/button";
import { getSetupProgress } from "@/modules/onboarding/setup.service";
import { industryLabel } from "@/config/industries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  const params = await searchParams;
  const businessId = context.businessId;
  const now = new Date();

  const [customers, openConversations, newLeads, ordersThisMonth, upcomingBookings] = await Promise.all([
    prisma.customer.count({ where: { businessId, deletedAt: null } }),
    prisma.conversation.count({ where: { businessId, status: { in: ["OPEN", "PENDING"] } } }),
    prisma.lead.count({ where: { businessId, status: "NEW" } }),
    prisma.order.count({ where: { businessId, createdAt: { gte: startOfMonthUtc(now) } } }),
    prisma.booking.count({ where: { businessId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } } }),
  ]);

  const setup = await getSetupProgress(businessId);
  const firstName = context.user.name.split(" ")[0];
  const greeting = params.welcome === "1" ? `Welcome to SUNLEON AI, ${firstName}` : `Good to see you, ${firstName}`;

  return (
    <>
      <PageHeader
        eyebrow={industryLabel(context.business.industry)}
        title={greeting}
        description={`Here's what's happening at ${context.business.name} today.`}
      />
      {!setup.isComplete ? (
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-linear-to-r from-violet/10 via-card to-card p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-semibold">Finish setting up your AI employee</p>
            <p className="text-sm text-muted-foreground">
              {setup.finished} of {setup.total} steps complete. Next: {setup.steps.find((step) => step.status === "todo")?.title}.
            </p>
          </div>
          <Button asChild>
            <Link href="/app/setup">Continue setup</Link>
          </Button>
        </section>
      ) : null}
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Open conversations" value={openConversations} icon={MessagesSquare} tone="violet" />
        <StatCard label="Customers" value={customers} icon={Users} tone="azure" />
        <StatCard label="New leads" value={newLeads} icon={Target} tone="success" />
        <StatCard label="Orders this month" value={ordersThisMonth} icon={ShoppingBag} />
        <StatCard label="Upcoming bookings" value={upcomingBookings} icon={CalendarClock} tone="warning" />
      </section>
    </>
  );
}
