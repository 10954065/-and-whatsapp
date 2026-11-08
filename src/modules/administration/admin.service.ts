import { z } from "zod";
import type { BusinessStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fail } from "@/lib/monitoring/errors";
import { recordAudit } from "@/modules/administration/audit.service";
import { addMonths } from "@/modules/billing/billing.service";
import { getPlanLimits, getUsage, monthPeriod } from "@/modules/billing/usage";

/**
 * Platform administration. Runs on the owner connection (cross-tenant by design) and is only
 * reachable through requireSuperAdmin*; every change is audited with actorType ADMIN.
 */
export interface AdminActor {
  userId: string;
  ipAddress: string | null;
}

const PAGE_SIZE = 50;
const DAY_MS = 86_400_000;

export async function getPlatformOverview(now: Date = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [businesses, subscriptions, revenue, aiCost, failedJobs, failedWebhooks, errors, newInquiries] = await Promise.all([
    prisma.business.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "SUCCESS", purpose: "SUBSCRIPTION", paidAt: { gte: since } }, _sum: { amountMinor: true }, _count: { _all: true } }),
    prisma.aiUsageRecord.aggregate({ where: { createdAt: { gte: since } }, _sum: { costMicros: true } }),
    prisma.job.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
    prisma.errorEvent.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
    prisma.contactInquiry.count({ where: { status: "NEW" } }),
  ]);
  const total = <T extends { _count: { _all: number } }>(rows: T[], match: (row: T) => boolean) => rows.filter(match).reduce((sum, row) => sum + row._count._all, 0);
  return {
    businesses: { active: total(businesses, (row) => row.status === "ACTIVE"), suspended: total(businesses, (row) => row.status === "SUSPENDED"), total: total(businesses, () => true) },
    subscriptions: Object.fromEntries(subscriptions.map((row) => [row.status, row._count._all])) as Record<string, number>,
    revenue30d: { amountMinor: revenue._sum.amountMinor ?? 0, payments: revenue._count._all },
    aiCost30dMicros: aiCost._sum.costMicros ?? 0,
    failedJobs,
    failedWebhooks,
    errors24h: errors,
    newInquiries,
  };
}

export async function listBusinesses(input: { query?: string; status?: BusinessStatus; page?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const query = input.query?.trim();
  const where: Prisma.BusinessWhereInput = {
    deletedAt: null,
    ...(input.status ? { status: input.status } : {}),
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const [rows, count] = await Promise.all([
    prisma.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, slug: true, industry: true, status: true, createdAt: true, subscription: { select: { status: true, plan: { select: { name: true } } } }, _count: { select: { memberships: true } } },
    }),
    prisma.business.count({ where }),
  ]);
  return { rows, total: count, page, pages: Math.max(1, Math.ceil(count / PAGE_SIZE)) };
}

export async function getBusinessDetail(businessId: string, now: Date = new Date()) {
  const business = await prisma.business.findFirst({
    where: { id: businessId },
    include: {
      subscription: { include: { plan: true } },
      memberships: { include: { user: { select: { name: true, email: true, emailVerifiedAt: true, mfaEnabled: true } } }, orderBy: { createdAt: "asc" } },
      // Credentials are never selected: only channel, status and public account details.
      integrations: { select: { id: true, channel: true, status: true, externalAccountName: true, displayHandle: true, lastHealthCheckAt: true, lastError: true } },
      supportNotes: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!business) throw fail.notFound("Business");
  const [limits, aiMessages, payments, audit, plans] = await Promise.all([
    getPlanLimits(businessId),
    getUsage(businessId, "AI_MESSAGE", monthPeriod(now)),
    prisma.paymentTransaction.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.auditLog.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return { business, limits, usage: { aiMessages }, payments, audit, plans };
}

const reason = z.string().trim().min(5, "Give a reason (it is recorded).").max(500);

export const businessStatusSchema = z.object({ businessId: z.string().min(1), status: z.enum(["ACTIVE", "SUSPENDED"]), reason });

/** Suspension keeps all data, blocks the workspace UI and stops AI replies (policy preflight). */
export async function setBusinessStatus(admin: AdminActor, input: z.infer<typeof businessStatusSchema>) {
  const result = await prisma.business.updateMany({ where: { id: input.businessId, deletedAt: null, status: { not: input.status } }, data: { status: input.status } });
  if (!result.count) throw fail.validation(`The business is already ${input.status.toLowerCase()} or does not exist.`);
  await recordAudit({
    businessId: input.businessId,
    actorType: "ADMIN",
    actorId: admin.userId,
    action: input.status === "SUSPENDED" ? "admin.business_suspended" : "admin.business_restored",
    entityType: "Business",
    entityId: input.businessId,
    metadata: { reason: input.reason },
    ipAddress: admin.ipAddress,
  });
}

export const supportNoteSchema = z.object({ businessId: z.string().min(1), body: z.string().trim().min(2).max(2_000) });

export async function addSupportNote(admin: AdminActor, input: z.infer<typeof supportNoteSchema>) {
  const business = await prisma.business.findUnique({ where: { id: input.businessId }, select: { id: true } });
  if (!business) throw fail.notFound("Business");
  await prisma.supportNote.create({ data: { businessId: input.businessId, authorId: admin.userId, body: input.body } });
}

export const grantSubscriptionSchema = z.object({ businessId: z.string().min(1), planId: z.string().min(1), months: z.coerce.number().int().min(1).max(36), reason });

/** Manual activation (e.g. a bank transfer received offline, or a goodwill extension). */
export async function grantSubscription(admin: AdminActor, input: z.infer<typeof grantSubscriptionSchema>, now: Date = new Date()) {
  const [plan, business] = await Promise.all([
    prisma.subscriptionPlan.findUnique({ where: { id: input.planId } }),
    prisma.business.findUnique({ where: { id: input.businessId }, select: { id: true } }),
  ]);
  if (!plan) throw fail.notFound("Plan");
  if (!business) throw fail.notFound("Business");
  const current = await prisma.subscription.findUnique({ where: { businessId: input.businessId } });
  const start = current && current.status === "ACTIVE" && current.planId === plan.id && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
  const end = addMonths(start, input.months);
  const values = { planId: plan.id, status: "ACTIVE" as const, trialEndsAt: null, currentPeriodStart: start, currentPeriodEnd: end, graceUntil: null, cancelAtPeriodEnd: false, cancelledAt: null };
  if (current) await prisma.subscription.update({ where: { id: current.id }, data: values });
  else await prisma.subscription.create({ data: { businessId: input.businessId, ...values } });
  await recordAudit({
    businessId: input.businessId,
    actorType: "ADMIN",
    actorId: admin.userId,
    action: "admin.subscription_granted",
    entityType: "Subscription",
    metadata: { plan: plan.code, months: input.months, until: end.toISOString(), reason: input.reason },
    ipAddress: admin.ipAddress,
  });
  return end;
}

const cedis = z.coerce.number().min(0).max(1_000_000).transform((value) => Math.round(value * 100));
const whole = (max: number) => z.coerce.number().int().min(0).max(max);
const checkbox = z.preprocess((value) => value === "on" || value === true, z.boolean());

export const planUpdateSchema = z.object({
  planId: z.string().min(1),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().transform((value) => value || null),
  priceMonthly: cedis,
  priceYearly: cedis,
  trialDays: whole(90),
  aiMessagesPerMonth: whole(10_000_000),
  channels: whole(100),
  staffSeats: whole(10_000),
  knowledgeStorageMb: whole(1_000_000),
  workflowExecutionsPerMonth: whole(10_000_000),
  features: z.string().max(2_000).transform((value) => value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12)),
  isActive: checkbox,
  isPublic: checkbox,
});

/** Plans are never deleted (subscriptions reference them); deactivating hides them from sale. */
export async function updatePlan(admin: AdminActor, input: z.infer<typeof planUpdateSchema>) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw fail.notFound("Plan");
  const limits = {
    ...(plan.limits as Record<string, unknown>),
    aiMessagesPerMonth: input.aiMessagesPerMonth,
    channels: input.channels,
    staffSeats: input.staffSeats,
    knowledgeStorageMb: input.knowledgeStorageMb,
    workflowExecutionsPerMonth: input.workflowExecutionsPerMonth,
  };
  await prisma.subscriptionPlan.update({
    where: { id: plan.id },
    data: { name: input.name, description: input.description, priceMonthlyMinor: input.priceMonthly, priceYearlyMinor: input.priceYearly, trialDays: input.trialDays, limits, features: input.features, isActive: input.isActive, isPublic: input.isPublic },
  });
  await recordAudit({
    actorType: "ADMIN",
    actorId: admin.userId,
    action: "admin.plan_updated",
    entityType: "SubscriptionPlan",
    entityId: plan.id,
    metadata: { code: plan.code, before: { priceMonthlyMinor: plan.priceMonthlyMinor, priceYearlyMinor: plan.priceYearlyMinor, limits: plan.limits }, after: { priceMonthlyMinor: input.priceMonthly, priceYearlyMinor: input.priceYearly, limits } },
    ipAddress: admin.ipAddress,
  });
}

export async function listPlans() {
  return prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: true } } } });
}
