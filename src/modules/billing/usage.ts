import type { Prisma, UsageMetric } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface PlanLimits {
  aiMessagesPerMonth: number;
  aiConversationsPerMonth: number;
  channels: number;
  staffSeats: number;
  knowledgeStorageMb: number;
  workflowExecutionsPerMonth: number;
}

/** Applies while no plan is attached (e.g. plans not yet configured). */
export const DEFAULT_LIMITS: PlanLimits = {
  aiMessagesPerMonth: 200,
  aiConversationsPerMonth: 50,
  channels: 1,
  staffSeats: 2,
  knowledgeStorageMb: 20,
  workflowExecutionsPerMonth: 100,
};

/** Lapsed subscriptions keep all data but pause metered features. */
export const LAPSED_LIMITS: PlanLimits = {
  aiMessagesPerMonth: 0,
  aiConversationsPerMonth: 0,
  channels: 0,
  staffSeats: 1,
  knowledgeStorageMb: 0,
  workflowExecutionsPerMonth: 0,
};

export function monthPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function dayPeriod(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type UsageWriter = Pick<Prisma.TransactionClient, "usageCounter">;

/** Increments both the monthly and the daily counter for a metric. */
export async function incrementUsage(
  businessId: string,
  metric: UsageMetric,
  amount = 1,
  now: Date = new Date(),
  db: UsageWriter = prisma,
): Promise<void> {
  for (const period of [monthPeriod(now), dayPeriod(now)]) {
    await db.usageCounter.upsert({
      where: { businessId_metric_period: { businessId, metric, period } },
      update: { value: { increment: amount } },
      create: { businessId, metric, period, value: amount },
    });
  }
}

export async function getUsage(businessId: string, metric: UsageMetric, period: string): Promise<number> {
  const counter = await prisma.usageCounter.findUnique({
    where: { businessId_metric_period: { businessId, metric, period } },
    select: { value: true },
  });
  return counter?.value ?? 0;
}

/** Estimated AI spend (micro-USD) for the current UTC day and month. */
export async function getAiSpend(businessId: string, now: Date = new Date()): Promise<{ todayMicros: number; monthMicros: number }> {
  const dayStart = new Date(`${dayPeriod(now)}T00:00:00.000Z`);
  const monthStart = new Date(`${monthPeriod(now)}-01T00:00:00.000Z`);
  const [today, month] = await Promise.all([
    prisma.aiUsageRecord.aggregate({ where: { businessId, createdAt: { gte: dayStart } }, _sum: { costMicros: true } }),
    prisma.aiUsageRecord.aggregate({ where: { businessId, createdAt: { gte: monthStart } }, _sum: { costMicros: true } }),
  ]);
  return { todayMicros: today._sum.costMicros ?? 0, monthMicros: month._sum.costMicros ?? 0 };
}

export async function getPlanLimits(businessId: string): Promise<PlanLimits> {
  const subscription = await prisma.subscription.findUnique({ where: { businessId }, include: { plan: true } });
  if (!subscription) return DEFAULT_LIMITS;
  if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") return LAPSED_LIMITS;
  if (subscription.status === "TRIALING" && subscription.trialEndsAt && subscription.trialEndsAt < new Date()) {
    return LAPSED_LIMITS;
  }
  return { ...DEFAULT_LIMITS, ...(subscription.plan.limits as Partial<PlanLimits>) };
}
