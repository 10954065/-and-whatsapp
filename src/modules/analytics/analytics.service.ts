import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { localToUtc } from "@/modules/bookings/bookings.service";

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function parseRange(value: unknown): AnalyticsRange {
  const days = Number(value);
  return (ANALYTICS_RANGES as readonly number[]).includes(days) ? (days as AnalyticsRange) : 30;
}

/** "YYYY-MM-DD" for an instant in an IANA timezone. */
export function localDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The `days` local calendar dates ending today, oldest first. */
export function localDateRange(now: Date, timezone: string, days: number): string[] {
  const [year, month, day] = localDate(now, timezone).split("-").map(Number);
  return Array.from({ length: days }, (_, index) => new Date(Date.UTC(year, month - 1, day - (days - 1 - index))).toISOString().slice(0, 10));
}

export interface DailyPoint {
  date: string;
  conversations: number;
  orders: number;
  revenueMinor: number;
}

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/**
 * Business analytics computed only from stored rows, grouped by the business's local days.
 * Test-console AI runs and cancelled orders are excluded. Reads run under RLS.
 */
export async function getAnalytics(businessId: string, days: AnalyticsRange, now: Date = new Date()) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { timezone: true, currency: true } });
  const dates = localDateRange(now, business.timezone, days);
  const since = localToUtc(dates[0], 0, business.timezone);
  const tz = business.timezone;
  const createdSince = { businessId, createdAt: { gte: since } };

  return withTenantTx(businessId, async (tx) => {
    const conversationsStarted = await tx.conversation.count({ where: createdSince });
    const inbound = await tx.message.count({ where: { ...createdSince, direction: "INBOUND" } });
    const outbound = await tx.message.groupBy({ by: ["sender"], where: { ...createdSince, direction: "OUTBOUND" }, _count: { _all: true } });
    const runs = await tx.aiRun.groupBy({ by: ["status"], where: { ...createdSince, trigger: { not: "TEST_CONSOLE" } }, _count: { _all: true } });
    const aiCost = await tx.aiUsageRecord.aggregate({ where: createdSince, _sum: { costMicros: true } });

    const orderWhere = { ...createdSince, status: { not: "CANCELLED" as const } };
    const orders = await tx.order.aggregate({ where: orderWhere, _count: { _all: true }, _sum: { totalMinor: true } });
    const paid = await tx.order.aggregate({ where: { ...orderWhere, paymentStatus: "PAID" }, _sum: { totalMinor: true } });
    const aiOrders = await tx.order.count({ where: { ...orderWhere, createdByType: "AI" } });
    const topProducts = await tx.orderItem.groupBy({
      by: ["productName"],
      where: { businessId, order: { createdAt: { gte: since }, status: { not: "CANCELLED" } } },
      _sum: { quantity: true, lineTotalMinor: true },
      orderBy: { _sum: { lineTotalMinor: "desc" } },
      take: 5,
    });

    const bookings = await tx.booking.groupBy({ by: ["status"], where: createdSince, _count: { _all: true } });
    const upcomingBookings = await tx.booking.count({ where: { businessId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) } } });
    const leads = await tx.lead.groupBy({ by: ["status"], where: createdSince, _count: { _all: true } });

    const conversationDays = await tx.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "Conversation" WHERE "businessId" = ${businessId} AND "createdAt" >= ${since} GROUP BY 1`;
    const orderDays = await tx.$queryRaw<{ day: string; count: number; revenue: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, count(*)::int AS count, coalesce(sum("totalMinor"), 0)::int AS revenue
      FROM "Order" WHERE "businessId" = ${businessId} AND "createdAt" >= ${since} AND "status" <> 'CANCELLED' GROUP BY 1`;

    const runCount = (status: string) => runs.find((entry) => entry.status === status)?._count._all ?? 0;
    const totalRuns = runs.reduce((sum, entry) => sum + entry._count._all, 0);
    const sent = (sender: string) => outbound.find((entry) => entry.sender === sender)?._count._all ?? 0;
    const leadCount = (status: string) => leads.find((entry) => entry.status === status)?._count._all ?? 0;
    const leadsCreated = leads.reduce((sum, entry) => sum + entry._count._all, 0);
    const orderCount = orders._count._all;
    const revenueMinor = orders._sum.totalMinor ?? 0;
    const conversationsByDay = new Map(conversationDays.map((row) => [row.day, row.count]));
    const ordersByDay = new Map(orderDays.map((row) => [row.day, row]));

    return {
      days,
      since,
      timezone: tz,
      currency: business.currency,
      conversations: { started: conversationsStarted, inbound, aiReplies: sent("AI"), staffReplies: sent("STAFF"), automationMessages: sent("AUTOMATION") },
      ai: {
        runs: totalRuns,
        succeeded: runCount("SUCCEEDED"),
        escalated: runCount("ESCALATED"),
        blocked: runCount("BLOCKED"),
        failed: runCount("FAILED"),
        escalationRate: rate(runCount("ESCALATED"), totalRuns),
        costMicros: aiCost._sum.costMicros ?? 0,
      },
      sales: {
        orders: orderCount,
        revenueMinor,
        paidMinor: paid._sum.totalMinor ?? 0,
        aiOrders,
        averageOrderMinor: orderCount ? Math.round(revenueMinor / orderCount) : null,
        topProducts: topProducts.map((row) => ({ name: row.productName, quantity: row._sum.quantity ?? 0, revenueMinor: row._sum.lineTotalMinor ?? 0 })),
      },
      bookings: {
        created: bookings.reduce((sum, entry) => sum + entry._count._all, 0),
        completed: bookings.find((entry) => entry.status === "COMPLETED")?._count._all ?? 0,
        cancelled: bookings.filter((entry) => entry.status === "CANCELLED" || entry.status === "NO_SHOW").reduce((sum, entry) => sum + entry._count._all, 0),
        upcoming: upcomingBookings,
      },
      leads: { created: leadsCreated, won: leadCount("WON"), lost: leadCount("LOST"), open: leadsCreated - leadCount("WON") - leadCount("LOST"), winRate: rate(leadCount("WON"), leadsCreated) },
      daily: dates.map(
        (date): DailyPoint => ({ date, conversations: conversationsByDay.get(date) ?? 0, orders: ordersByDay.get(date)?.count ?? 0, revenueMinor: ordersByDay.get(date)?.revenue ?? 0 }),
      ),
    };
  });
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
