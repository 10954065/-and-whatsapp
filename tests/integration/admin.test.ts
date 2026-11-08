import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { randomToken } from "@/lib/security/crypto";
import { addSupportNote, getBusinessDetail, getPlatformOverview, grantSubscription, listBusinesses, setBusinessStatus, updatePlan, type AdminActor } from "@/modules/administration/admin.service";
import {
  announcementSchema,
  createAnnouncement,
  getActiveAnnouncements,
  isAiGloballyEnabled,
  listAuditLog,
  retryFailedJob,
  setAiGloballyEnabled,
  setAnnouncementActive,
  setInquiryStatus,
} from "@/modules/administration/monitoring.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const adminUser = await createUser();
  const admin: AdminActor = { userId: adminUser.id, ipAddress: "10.0.0.1" };
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, `Admin Target ${randomToken(4)}`);
  const plan = await prisma.subscriptionPlan.create({
    data: { code: `ADM_${randomToken(6).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`, name: "Business", priceMonthlyMinor: 79_900, priceYearlyMinor: 799_000, limits: { aiMessagesPerMonth: 6_000, staffSeats: 10 }, features: ["Inbox"] },
  });
  return { admin, business, plan };
}

const auditCount = (action: string, entityId?: string) => prisma.auditLog.count({ where: { action, actorType: "ADMIN", ...(entityId ? { entityId } : {}) } });

describe("platform administration", () => {
  it("lists and finds businesses, suspends and restores them with audited reasons", async () => {
    const { admin, business } = await setup();
    const found = await listBusinesses({ query: business.name.slice(-4) });
    expect(found.rows.map((row) => row.id)).toContain(business.id);

    await setBusinessStatus(admin, { businessId: business.id, status: "SUSPENDED", reason: "Reported spam campaign" });
    expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).status).toBe("SUSPENDED");
    await expect(setBusinessStatus(admin, { businessId: business.id, status: "SUSPENDED", reason: "Again please" })).rejects.toThrow(/already suspended/);
    expect((await listBusinesses({ status: "SUSPENDED" })).rows.map((row) => row.id)).toContain(business.id);
    await setBusinessStatus(admin, { businessId: business.id, status: "ACTIVE", reason: "Owner resolved it" });

    expect(await auditCount("admin.business_suspended", business.id)).toBe(1);
    expect(await auditCount("admin.business_restored", business.id)).toBe(1);
    const suspension = await prisma.auditLog.findFirstOrThrow({ where: { action: "admin.business_suspended", entityId: business.id } });
    expect(suspension).toMatchObject({ actorId: admin.userId, ipAddress: "10.0.0.1", metadata: { reason: "Reported spam campaign" } });

    const overview = await getPlatformOverview();
    expect(overview.businesses.total).toBeGreaterThanOrEqual(1);
  });

  it("grants subscriptions manually, extending a running period of the same plan", async () => {
    const { admin, business, plan } = await setup();
    const now = new Date("2026-11-08T12:00:00Z");
    const first = await grantSubscription(admin, { businessId: business.id, planId: plan.id, months: 1, reason: "Bank transfer received" }, now);
    expect(first.toISOString()).toBe("2026-12-08T12:00:00.000Z");
    const second = await grantSubscription(admin, { businessId: business.id, planId: plan.id, months: 2, reason: "Goodwill extension" }, new Date("2026-11-10T12:00:00Z"));
    expect(second.toISOString()).toBe("2027-02-08T12:00:00.000Z");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("ACTIVE");
    expect(await prisma.auditLog.count({ where: { businessId: business.id, action: "admin.subscription_granted" } })).toBe(2);

    await addSupportNote(admin, { businessId: business.id, body: "Called owner about onboarding" });
    const detail = await getBusinessDetail(business.id);
    expect(detail.business.supportNotes.map((note) => note.body)).toEqual(["Called owner about onboarding"]);
    expect(detail.limits.aiMessagesPerMonth).toBe(6_000);
    await expect(getBusinessDetail("does-not-exist")).rejects.toThrow(/not found/i);
  });

  it("updates plan prices and limits while keeping other limit keys", async () => {
    const { admin, plan } = await setup();
    await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { limits: { aiMessagesPerMonth: 6_000, aiConversationsPerMonth: 1_500 } } });
    await updatePlan(admin, {
      planId: plan.id,
      name: "Business Plus",
      description: null,
      priceMonthly: 89_900,
      priceYearly: 899_000,
      trialDays: 7,
      aiMessagesPerMonth: 8_000,
      channels: 3,
      staffSeats: 12,
      knowledgeStorageMb: 800,
      workflowExecutionsPerMonth: 6_000,
      features: ["Inbox", "Automation"],
      isActive: true,
      isPublic: false,
    });
    const saved = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved).toMatchObject({ name: "Business Plus", priceMonthlyMinor: 89_900, trialDays: 7, isPublic: false, features: ["Inbox", "Automation"] });
    expect(saved.limits).toMatchObject({ aiMessagesPerMonth: 8_000, aiConversationsPerMonth: 1_500, staffSeats: 12 });
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "admin.plan_updated", entityId: plan.id } });
    expect(entry.metadata).toMatchObject({ before: { priceMonthlyMinor: 79_900 }, after: { priceMonthlyMinor: 89_900 } });
  });

  it("retries only failed jobs and records inquiries, announcements and the AI switch", async () => {
    const { admin } = await setup();
    const dead = await prisma.job.create({ data: { type: "test.noop", payload: {}, status: "DEAD", attempts: 5, lastError: "boom" } });
    const done = await prisma.job.create({ data: { type: "test.noop", payload: {}, status: "SUCCEEDED" } });
    await retryFailedJob(admin, dead.id);
    expect(await prisma.job.findUniqueOrThrow({ where: { id: dead.id } })).toMatchObject({ status: "PENDING", attempts: 0, lastError: null });
    await expect(retryFailedJob(admin, done.id)).rejects.toThrow(/Only failed or dead/);
    await prisma.job.deleteMany({ where: { id: { in: [dead.id, done.id] } } });

    const inquiry = await prisma.contactInquiry.create({ data: { name: "Ama", email: "ama@example.test", message: "Do you support Twi?" } });
    await setInquiryStatus(admin, { inquiryId: inquiry.id, status: "IN_PROGRESS" });
    expect((await prisma.contactInquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe("IN_PROGRESS");

    const expiring = announcementSchema.parse({ title: "Maintenance tonight", body: "Brief downtime at 23:00 GMT.", level: "WARNING", endsAt: "2099-01-01T10:00" });
    expect(expiring.endsAt?.toISOString()).toBe("2099-01-01T10:00:00.000Z");
    const announcement = await createAnnouncement(admin, expiring);
    const past = await createAnnouncement(admin, { title: "Old news", body: "Already over.", level: "INFO", endsAt: new Date("2020-01-01T00:00:00Z") });
    let active = await getActiveAnnouncements();
    expect(active.map((entry) => entry.id)).toContain(announcement.id);
    expect(active.map((entry) => entry.id)).not.toContain(past.id);
    await setAnnouncementActive(admin, announcement.id, false);
    active = await getActiveAnnouncements();
    expect(active.map((entry) => entry.id)).not.toContain(announcement.id);
    await prisma.announcement.deleteMany({ where: { id: { in: [announcement.id, past.id] } } });

    try {
      await setAiGloballyEnabled(admin, { enabled: false, reason: "Provider incident drill" });
      expect(await isAiGloballyEnabled()).toBe(false);
    } finally {
      await setAiGloballyEnabled(admin, { enabled: true, reason: "Drill finished" });
    }
    expect(await isAiGloballyEnabled()).toBe(true);
    const log = await listAuditLog({ action: "admin.ai_" });
    const mine = log.rows.filter((row) => row.actorId === admin.userId).map((row) => row.action);
    expect(mine.sort()).toEqual(["admin.ai_disabled", "admin.ai_enabled"]);
  });
});
