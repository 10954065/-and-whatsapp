import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fail } from "@/lib/monitoring/errors";
import { retryJob } from "@/lib/queue";
import type { AdminActor } from "@/modules/administration/admin.service";
import { recordAudit } from "@/modules/administration/audit.service";
import { getPlatformSetting, PLATFORM_FLAGS, setPlatformSetting } from "@/modules/administration/platform-settings";

const LIST_LIMIT = 50;
const DAY_MS = 86_400_000;

/** Failed background work, webhook problems, recent errors and email failures (no message bodies or payloads). */
export async function getMonitoringSnapshot(now: Date = new Date()) {
  const [jobs, webhooks, errors, errorGroups, emails] = await Promise.all([
    prisma.job.findMany({
      where: { status: { in: ["FAILED", "DEAD"] } },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
      select: { id: true, type: true, status: true, attempts: true, maxAttempts: true, lastError: true, businessId: true, runAt: true, updatedAt: true },
    }),
    prisma.webhookEvent.findMany({
      where: { OR: [{ status: "FAILED" }, { status: "IGNORED", error: { not: null } }] },
      orderBy: { receivedAt: "desc" },
      take: LIST_LIMIT,
      select: { id: true, provider: true, eventType: true, status: true, attempts: true, error: true, businessId: true, receivedAt: true },
    }),
    prisma.errorEvent.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT, select: { id: true, source: true, message: true, businessId: true, createdAt: true } }),
    prisma.errorEvent.groupBy({ by: ["source"], where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } }, _count: { _all: true }, orderBy: { _count: { source: "desc" } }, take: 10 }),
    prisma.emailLog.findMany({ where: { status: "failed" }, orderBy: { createdAt: "desc" }, take: LIST_LIMIT, select: { id: true, to: true, template: true, error: true, createdAt: true } }),
  ]);
  return { jobs, webhooks, errors, errorGroups: errorGroups.map((group) => ({ source: group.source, count: group._count._all })), emails };
}

export async function retryFailedJob(admin: AdminActor, jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, type: true, status: true, businessId: true } });
  if (!job) throw fail.notFound("Job");
  if (job.status !== "FAILED" && job.status !== "DEAD") throw fail.validation("Only failed or dead jobs can be retried.");
  await retryJob(job.id);
  await recordAudit({ businessId: job.businessId, actorType: "ADMIN", actorId: admin.userId, action: "admin.job_retried", entityType: "Job", entityId: job.id, metadata: { type: job.type }, ipAddress: admin.ipAddress });
}

export const INQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;

export async function listInquiries(status?: (typeof INQUIRY_STATUSES)[number]) {
  return prisma.contactInquiry.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 });
}

export const inquiryStatusSchema = z.object({ inquiryId: z.string().min(1), status: z.enum(INQUIRY_STATUSES) });

export async function setInquiryStatus(admin: AdminActor, input: z.infer<typeof inquiryStatusSchema>) {
  const result = await prisma.contactInquiry.updateMany({ where: { id: input.inquiryId }, data: { status: input.status } });
  if (!result.count) throw fail.notFound("Inquiry");
  await recordAudit({ actorType: "ADMIN", actorId: admin.userId, action: "admin.inquiry_status", entityType: "ContactInquiry", entityId: input.inquiryId, metadata: { status: input.status }, ipAddress: admin.ipAddress });
}

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(1_000),
  level: z.enum(["INFO", "WARNING", "CRITICAL"]),
  endsAt: z
    .string()
    .optional()
    .transform((value, context) => {
      if (!value) return null;
      // datetime-local has no zone; the form labels it GMT (Ghana time), so parse it as UTC.
      const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00Z` : value);
      if (Number.isNaN(date.getTime())) {
        context.addIssue({ code: "custom", message: "Enter a valid date and time." });
        return z.NEVER;
      }
      return date;
    }),
});

export async function createAnnouncement(admin: AdminActor, input: z.infer<typeof announcementSchema>) {
  const announcement = await prisma.announcement.create({ data: { title: input.title, body: input.body, level: input.level, endsAt: input.endsAt, createdById: admin.userId } });
  await recordAudit({ actorType: "ADMIN", actorId: admin.userId, action: "admin.announcement_created", entityType: "Announcement", entityId: announcement.id, metadata: { level: input.level }, ipAddress: admin.ipAddress });
  return announcement;
}

export async function setAnnouncementActive(admin: AdminActor, announcementId: string, isActive: boolean) {
  const result = await prisma.announcement.updateMany({ where: { id: announcementId }, data: { isActive } });
  if (!result.count) throw fail.notFound("Announcement");
  await recordAudit({ actorType: "ADMIN", actorId: admin.userId, action: isActive ? "admin.announcement_shown" : "admin.announcement_hidden", entityType: "Announcement", entityId: announcementId, ipAddress: admin.ipAddress });
}

export async function listAnnouncements() {
  return prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
}

/** Announcements every workspace sees right now (shown as a banner in the app). */
export async function getActiveAnnouncements(now: Date = new Date()) {
  return prisma.announcement.findMany({
    where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, body: true, level: true },
  });
}

export async function isAiGloballyEnabled(): Promise<boolean> {
  return getPlatformSetting<boolean>(PLATFORM_FLAGS.aiEnabled, true);
}

export const aiSwitchSchema = z.object({
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  reason: z.string().trim().min(5, "Give a reason (it is recorded).").max(500),
});

/** Platform-wide AI kill switch: when off, every AI run is blocked in the policy preflight. */
export async function setAiGloballyEnabled(admin: AdminActor, input: z.infer<typeof aiSwitchSchema>) {
  await setPlatformSetting(PLATFORM_FLAGS.aiEnabled, input.enabled, admin.userId);
  await recordAudit({ actorType: "ADMIN", actorId: admin.userId, action: input.enabled ? "admin.ai_enabled" : "admin.ai_disabled", entityType: "PlatformSetting", entityId: PLATFORM_FLAGS.aiEnabled, metadata: { reason: input.reason }, ipAddress: admin.ipAddress });
}

export async function listAuditLog(input: { businessId?: string; action?: string; page?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(input.businessId ? { businessId: input.businessId } : {}),
    ...(input.action ? { action: { startsWith: input.action } } : {}),
  };
  const rows = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 101, include: { business: { select: { name: true } } } });
  return { rows: rows.slice(0, 100), page, hasMore: rows.length > 100 };
}
