import { createHash, createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as qstashWakeUp } from "@/app/api/queue/qstash/route";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { resetEnvCache } from "@/lib/env";
import { enqueueJob, registerJobHandler, setJobDispatcher } from "@/lib/queue";
import { createService, createStaffMember } from "@/modules/bookings/bookings.service";
import { createOrder, createProduct } from "@/modules/commerce/commerce.service";
import { connectSandbox } from "@/modules/integrations/integration.service";
import { simulateSandboxMessage } from "@/modules/messaging/inbox.service";
import {
  cancelWorkspaceDeletion,
  deleteUserAccount,
  exportBusinessData,
  getPendingDeletion,
  processScheduledDeletions,
  purgeExpiredMessages,
  requestWorkspaceDeletion,
} from "@/modules/privacy/privacy.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser({ password: "owner-password-123" });
  const business = await createBusinessFor(owner.id, "Privacy Shop");
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  await connectSandbox(actor);
  await simulateSandboxMessage(actor, { customerName: "Adwoa", text: "Is the green kaftan available?" });
  return { owner, actor, business };
}

describe("data export", () => {
  it("gives the owner every customer, conversation and order, without secrets", async () => {
    const { actor, business } = await setup();
    await prisma.integration.updateMany({ where: { businessId: business.id }, data: { credentialsEnc: "v1:secret-ciphertext" } });
    const data = await exportBusinessData(actor);
    expect(data.customers.map((customer) => customer.displayName)).toContain("Adwoa");
    expect(data.conversations[0].messages[0].text).toBe("Is the green kaftan available?");
    const serialised = JSON.stringify(data);
    expect(serialised).not.toContain("secret-ciphertext");
    expect(serialised).not.toContain("passwordHash");
    expect(await prisma.dataRequest.count({ where: { businessId: business.id, type: "EXPORT", status: "COMPLETED" } })).toBe(1);
    await expect(exportBusinessData({ ...actor, role: "ADMIN" })).rejects.toThrow(/Only the workspace owner/);
  });
});

describe("workspace deletion", () => {
  it("requires the exact name, can be cancelled, and purges everything after the grace period", async () => {
    const { actor, business } = await setup();
    const customer = await prisma.customer.findFirstOrThrow({ where: { businessId: business.id } });
    const product = await createProduct(actor, { name: "Kaftan", description: null, price: 30_000, sku: null, stockQuantity: 2, trackInventory: true, lowStockThreshold: 0 });
    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId: product.variants[0].id, quantity: 1 }], createdByType: "USER" });
    const service = await createService(actor, { name: "Fitting", durationMinutes: 30, bufferMinutes: 0, price: null });
    const staff = await createStaffMember(actor, { name: "Esi", serviceIds: [service.id], days: [1], start: "09:00", end: "17:00" });
    const startsAt = new Date("2027-01-04T10:00:00Z");
    await prisma.booking.create({ data: { businessId: business.id, serviceId: service.id, staffId: staff.id, customerId: customer.id, startsAt, endsAt: new Date(startsAt.getTime() + 1_800_000), blockedUntil: new Date(startsAt.getTime() + 1_800_000), createdByType: "USER" } });

    await expect(requestWorkspaceDeletion(actor, { confirmName: "privacy shop" })).rejects.toThrow(/doesn't match/);
    await requestWorkspaceDeletion(actor, { confirmName: "Privacy Shop" });
    expect(await getPendingDeletion(business.id)).not.toBeNull();
    await expect(requestWorkspaceDeletion(actor, { confirmName: "Privacy Shop" })).rejects.toThrow(/already scheduled/);
    await cancelWorkspaceDeletion(actor);
    expect(await getPendingDeletion(business.id)).toBeNull();

    await requestWorkspaceDeletion(actor, { confirmName: "Privacy Shop" });
    expect(await processScheduledDeletions(new Date())).toBe(0);
    await prisma.dataRequest.updateMany({ where: { businessId: business.id, type: "DELETION" }, data: { requestedAt: new Date(Date.now() - 8 * 86_400_000) } });
    expect(await processScheduledDeletions(new Date())).toBeGreaterThanOrEqual(1);

    expect(await prisma.business.findUnique({ where: { id: business.id } })).toBeNull();
    expect(await prisma.customer.count({ where: { businessId: business.id } })).toBe(0);
    expect(await prisma.message.count({ where: { businessId: business.id } })).toBe(0);
    expect(await prisma.order.count({ where: { businessId: business.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "privacy.workspace_purged", entityId: business.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "privacy.deletion_requested", businessId: null, actorId: actor.userId } })).toBeGreaterThanOrEqual(1);
  });
});

describe("retention and account deletion", () => {
  it("deletes messages older than the business's retention period only", async () => {
    const { business } = await setup();
    const other = await setup();
    await prisma.businessSettings.upsert({ where: { businessId: business.id }, update: { messageRetentionDays: 30 }, create: { businessId: business.id, messageRetentionDays: 30 } });
    await prisma.message.updateMany({ where: { businessId: { in: [business.id, other.business.id] } }, data: { createdAt: new Date(Date.now() - 40 * 86_400_000) } });
    await purgeExpiredMessages();
    expect(await prisma.message.count({ where: { businessId: business.id } })).toBe(0);
    expect(await prisma.message.count({ where: { businessId: other.business.id } })).toBe(1);
  });

  it("blocks owners, and strips personal data for other members", async () => {
    const { owner, business } = await setup();
    await expect(deleteUserAccount(owner.id, { password: "owner-password-123" }, null)).rejects.toThrow(/You own a workspace/);

    const staff = await createUser({ password: "staff-password-123" });
    await prisma.businessMembership.create({ data: { businessId: business.id, userId: staff.id, role: "STAFF" } });
    await prisma.session.create({ data: { id: `test-session-${staff.id}`, userId: staff.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    await expect(deleteUserAccount(staff.id, { password: "wrong-password" }, null)).rejects.toThrow(/incorrect/);
    await deleteUserAccount(staff.id, { password: "staff-password-123" }, "10.1.1.1");

    const deleted = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(deleted).toMatchObject({ name: "Deleted user", email: `deleted-${staff.id}@deleted.invalid`, mfaEnabled: false });
    expect(deleted.deletedAt).not.toBeNull();
    expect(await prisma.businessMembership.count({ where: { userId: staff.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(0);
  });
});

describe("operational endpoints", () => {
  const SIGNING_KEY = "qstash_current_test_key";
  beforeAll(() => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = SIGNING_KEY;
    resetEnvCache();
  });
  afterAll(() => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    resetEnvCache();
  });

  it("runs a stored job when QStash calls with a valid signature, and rejects forged calls", async () => {
    let ran = 0;
    registerJobHandler("test.qstash_wakeup", async () => {
      ran += 1;
    });
    setJobDispatcher(() => undefined);
    const { id } = await enqueueJob("test.qstash_wakeup", {});
    setJobDispatcher(null);

    const body = JSON.stringify({ jobId: id });
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "Upstash", sub: "http://localhost:3000/api/queue/qstash", exp: now + 300, nbf: now - 5, body: createHash("sha256").update(body).digest("base64url") })).toString("base64url");
    const token = `${header}.${payload}.${createHmac("sha256", SIGNING_KEY).update(`${header}.${payload}`).digest("base64url")}`;
    const call = (signature: string) => qstashWakeUp(new Request("http://localhost:3000/api/queue/qstash", { method: "POST", body, headers: { "upstash-signature": signature } }));

    expect((await call(`${token.slice(0, -2)}xx`)).status).toBe(401);
    expect(await (await call(token)).json()).toEqual({ ran: true, succeeded: true });
    expect(await (await call(token)).json()).toEqual({ ran: false, succeeded: false });
    expect(ran).toBe(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id } })).status).toBe("SUCCEEDED");
  });

  it("reports health without exposing secrets", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", database: { ok: true, migrationFinished: true } });
    expect(typeof body.database.latestMigration).toBe("string");
    expect(Object.values(body.providers).every((value) => typeof value === "boolean")).toBe(true);
  });
});
