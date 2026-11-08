import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as paystackWebhook } from "@/app/api/webhooks/paystack/route";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { resetEnvCache } from "@/lib/env";
import { processDueJobs } from "@/lib/queue";
import { hmacHex, randomToken } from "@/lib/security/crypto";
import { confirmPayment, runBillingLifecycle, startSubscriptionCheckout } from "@/modules/billing/billing.service";
import { createOrder, createProduct, markOrderPaid } from "@/modules/commerce/commerce.service";
import { inviteMember } from "@/modules/team/team.service";
import { createWorkflow, setWorkflowStatus } from "@/modules/workflows/workflow.service";
import "@/workers/handlers";
import { createBusinessFor, createUser } from "./helpers";

const SECRET = "sk_test_integration_secret";

/** Scripted Paystack: initialize returns a hosted checkout; verify returns whatever the test sets. */
const verifyResults = new Map<string, Record<string, unknown>>();
const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith("/transaction/initialize")) {
    const body = JSON.parse(String(init?.body)) as { reference: string };
    return Response.json({ status: true, message: "Authorization URL created", data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, access_code: "abc", reference: body.reference } });
  }
  const reference = decodeURIComponent(url.split("/transaction/verify/")[1] ?? "");
  const data = verifyResults.get(reference);
  if (!data) return Response.json({ status: false, message: "Transaction reference not found" }, { status: 400 });
  return Response.json({ status: true, message: "Verification successful", data: { id: 4_099_260_516, reference, channel: "mobile_money", paid_at: new Date().toISOString(), customer: { customer_code: "CUS_test" }, ...data } });
});

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  resetEnvCache();
});
afterAll(() => {
  delete process.env.PAYSTACK_SECRET_KEY;
  resetEnvCache();
});
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Billing Shop");
  const actor: TenantActor & { email: string } = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null, email: owner.email };
  const plan = await prisma.subscriptionPlan.create({
    data: { code: `TEST_${randomToken(6).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`, name: "Business", priceMonthlyMinor: 79_900, priceYearlyMinor: 799_000, limits: { staffSeats: 3 }, features: [] },
  });
  await prisma.subscription.create({ data: { businessId: business.id, planId: plan.id, status: "TRIALING", trialEndsAt: new Date(Date.now() + 5 * 86_400_000), currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000) } });
  return { owner, actor, business, plan };
}

async function checkout(actor: TenantActor & { email: string }, planCode: string, interval: "MONTHLY" | "YEARLY" = "MONTHLY") {
  const url = await startSubscriptionCheckout(actor, { planCode, interval });
  return url.split("/").pop()!;
}

describe("Paystack subscription payments", () => {
  it("starts a checkout and activates the plan only after server verification, exactly once", async () => {
    const { actor, business, plan } = await setup();
    const reference = await checkout(actor, plan.code);
    const initialize = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(initialize).toMatchObject({ email: actor.email, amount: "79900", currency: "GHS", reference, callback_url: "http://localhost:3000/api/billing/paystack/callback" });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ authorization: `Bearer ${SECRET}` });
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference } })).status).toBe("PENDING");

    // Not yet paid at Paystack: nothing changes.
    verifyResults.set(reference, { status: "ongoing", amount: 79_900, currency: "GHS" });
    expect(await confirmPayment(reference)).toBe("pending");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("TRIALING");

    verifyResults.set(reference, { status: "success", amount: 79_900, currency: "GHS" });
    const now = new Date("2026-11-08T12:00:00Z");
    const outcomes = await Promise.all([confirmPayment(reference, now), confirmPayment(reference, now), confirmPayment(reference, now)]);
    expect(outcomes).toEqual(["success", "success", "success"]);

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } });
    expect(subscription).toMatchObject({ status: "ACTIVE", planId: plan.id, interval: "MONTHLY", trialEndsAt: null, providerCustomerCode: "CUS_test" });
    expect(subscription.currentPeriodEnd.toISOString()).toBe("2026-12-08T12:00:00.000Z");
    const transaction = await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference } });
    expect(transaction).toMatchObject({ status: "SUCCESS", subscriptionId: subscription.id, providerTransactionId: "4099260516", channel: "mobile_money" });
    expect(await prisma.auditLog.count({ where: { businessId: business.id, action: "billing.payment_succeeded" } })).toBe(1);
    expect(await prisma.notification.count({ where: { businessId: business.id, type: "billing" } })).toBe(1);

    // Paying early for the same plan extends from the current end.
    const renewal = await checkout(actor, plan.code);
    verifyResults.set(renewal, { status: "success", amount: 79_900, currency: "GHS" });
    await confirmPayment(renewal, new Date("2026-11-20T12:00:00Z"));
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).currentPeriodEnd.toISOString()).toBe("2027-01-08T12:00:00.000Z");
  });

  it("rejects payments whose amount or currency differ, and records abandoned checkouts", async () => {
    const { actor, business, plan } = await setup();
    const short = await checkout(actor, plan.code);
    verifyResults.set(short, { status: "success", amount: 100, currency: "GHS" });
    expect(await confirmPayment(short)).toBe("failed");
    expect(await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference: short } })).toMatchObject({ status: "FAILED", failureReason: "Amount or currency did not match the checkout" });

    const foreign = await checkout(actor, plan.code, "YEARLY");
    verifyResults.set(foreign, { status: "success", amount: 799_000, currency: "NGN" });
    expect(await confirmPayment(foreign)).toBe("failed");

    const abandoned = await checkout(actor, plan.code);
    verifyResults.set(abandoned, { status: "abandoned", amount: 79_900, currency: "GHS", gateway_response: "The transaction was not completed" });
    expect(await confirmPayment(abandoned)).toBe("failed");
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference: abandoned } })).status).toBe("ABANDONED");

    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("TRIALING");
    expect(await confirmPayment("sl-not-ours")).toBe("unknown");
  });

  it("accepts only signed webhooks, stores each event once and confirms through the verify API", async () => {
    const { actor, business, plan } = await setup();
    const reference = await checkout(actor, plan.code);
    verifyResults.set(reference, { status: "success", amount: 79_900, currency: "GHS" });
    const body = JSON.stringify({ event: "charge.success", data: { id: 77, reference, amount: 79_900, currency: "GHS", status: "success" } });
    const request = (signature: string) => new Request("http://localhost:3000/api/webhooks/paystack", { method: "POST", body, headers: { "x-paystack-signature": signature, "x-forwarded-for": `10.9.${Math.floor(Math.random() * 255)}.1` } });

    expect((await paystackWebhook(request(hmacHex("sha512", "wrong-secret", body)))).status).toBe(401);
    const accepted = await paystackWebhook(request(hmacHex("sha512", SECRET, body)));
    expect(accepted.status).toBe(200);
    expect(await (await paystackWebhook(request(hmacHex("sha512", SECRET, body)))).json()).toMatchObject({ duplicate: true });

    await processDueJobs({ workerId: "vitest", limit: 50 });
    const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { dedupeKey: `paystack:charge.success:${reference}` } });
    expect(event).toMatchObject({ status: "PROCESSED", businessId: business.id, signatureValid: true });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("ACTIVE");
  });
});

describe("payment recovery and concurrency", () => {
  it("re-enqueues a stored webhook whose processing never started", async () => {
    const { actor, business, plan } = await setup();
    const reference = await checkout(actor, plan.code);
    verifyResults.set(reference, { status: "success", amount: 79_900, currency: "GHS" });
    const payload = { event: "charge.success", data: { id: 78, reference } };
    // As if the first delivery was stored but its job was never enqueued.
    await prisma.webhookEvent.create({ data: { provider: "PAYSTACK", dedupeKey: `paystack:charge.success:${reference}`, eventType: "charge.success", signatureValid: true, payload } });

    const body = JSON.stringify(payload);
    const response = await paystackWebhook(new Request("http://localhost:3000/api/webhooks/paystack", { method: "POST", body, headers: { "x-paystack-signature": hmacHex("sha512", SECRET, body) } }));
    expect(await response.json()).toMatchObject({ duplicate: true });
    await processDueJobs({ workerId: "vitest", limit: 50 });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("ACTIVE");
  });

  it("retries webhooks for payments still pending, and reconciles stale checkouts", async () => {
    const { actor, business, plan } = await setup();
    const reference = await checkout(actor, plan.code);
    verifyResults.set(reference, { status: "ongoing", amount: 79_900, currency: "GHS" });
    const body = JSON.stringify({ event: "charge.success", data: { id: 79, reference } });
    await paystackWebhook(new Request("http://localhost:3000/api/webhooks/paystack", { method: "POST", body, headers: { "x-paystack-signature": hmacHex("sha512", SECRET, body) } }));
    await processDueJobs({ workerId: "vitest", limit: 50 });
    const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { dedupeKey: `paystack:charge.success:${reference}` } });
    expect(event.status).toBe("FAILED");
    expect(await prisma.job.findFirstOrThrow({ where: { idempotencyKey: `webhook.paystack:${event.id}` } })).toMatchObject({ lastError: "Payment still pending at Paystack" });

    // Paystack settles later; the sweep re-verifies checkouts older than five minutes.
    verifyResults.set(reference, { status: "success", amount: 79_900, currency: "GHS" });
    const stale = await checkout(actor, plan.code);
    await prisma.paymentTransaction.update({ where: { reference: stale }, data: { createdAt: new Date(Date.now() - 50 * 3_600_000) } });
    await prisma.paymentTransaction.update({ where: { reference }, data: { createdAt: new Date(Date.now() - 10 * 60_000) } });
    const result = await runBillingLifecycle(new Date());
    expect(result.reconciled).toBeGreaterThanOrEqual(1);
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference } })).status).toBe("SUCCESS");
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference: stale } })).status).toBe("ABANDONED");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("ACTIVE");
  });

  it("applies two different payments confirmed at once without losing a period", async () => {
    const { actor, business, plan } = await setup();
    const first = await checkout(actor, plan.code);
    const second = await checkout(actor, plan.code);
    verifyResults.set(first, { status: "success", amount: 79_900, currency: "GHS" });
    verifyResults.set(second, { status: "success", amount: 79_900, currency: "GHS" });
    const now = new Date("2026-11-08T12:00:00Z");
    await Promise.all([confirmPayment(first, now), confirmPayment(second, now)]);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).currentPeriodEnd.toISOString()).toBe("2027-01-08T12:00:00.000Z");
  });

  it("credits unused time when switching plans and flags refunds for review", async () => {
    const { actor, business, plan } = await setup();
    const starter = await prisma.subscriptionPlan.create({
      data: { code: `TEST_S_${randomToken(6).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`, name: "Starter", priceMonthlyMinor: 30_000, priceYearlyMinor: 300_000, limits: {}, features: [] },
    });
    const now = new Date("2026-11-08T12:00:00Z");
    await prisma.subscription.update({ where: { businessId: business.id }, data: { planId: starter.id, status: "ACTIVE", interval: "MONTHLY", trialEndsAt: null, currentPeriodEnd: new Date("2026-11-23T12:00:00Z") } });
    const upgrade = await checkout(actor, plan.code);
    verifyResults.set(upgrade, { status: "success", amount: 79_900, currency: "GHS" });
    await confirmPayment(upgrade, now);
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { businessId: business.id } });
    expect(subscription.planId).toBe(plan.id);
    // 15 unused Starter days at 30,000/30 per day buy 15 × 1,000 / (79,900/30) ≈ 5.63 Business days.
    const creditDays = (subscription.currentPeriodEnd.getTime() - new Date("2026-12-08T12:00:00Z").getTime()) / 86_400_000;
    expect(creditDays).toBeCloseTo(5.63, 1);

    const refundId = Math.floor(Math.random() * 1e9);
    const refund = JSON.stringify({ event: "refund.processed", data: { id: refundId, transaction_reference: upgrade } });
    await paystackWebhook(new Request("http://localhost:3000/api/webhooks/paystack", { method: "POST", body: refund, headers: { "x-paystack-signature": hmacHex("sha512", SECRET, refund) } }));
    await processDueJobs({ workerId: "vitest", limit: 50 });
    expect(await prisma.webhookEvent.findUniqueOrThrow({ where: { dedupeKey: `paystack:refund.processed:${refundId}` } })).toMatchObject({ status: "IGNORED", error: "Needs manual review in the Paystack dashboard" });
    expect(await prisma.errorEvent.count({ where: { source: "billing.paystack_review" } })).toBeGreaterThanOrEqual(1);
  });
});

describe("subscription lifecycle and plan limits", () => {
  it("ends trials, applies a grace period, expires lapsed plans and reminds once", async () => {
    const trial = await setup();
    const paid = await setup();
    const grace = await setup();
    const ending = await setup();
    const now = new Date();
    const days = (count: number) => new Date(now.getTime() + count * 86_400_000);
    await prisma.subscription.update({ where: { businessId: trial.business.id }, data: { trialEndsAt: days(-1) } });
    await prisma.subscription.update({ where: { businessId: paid.business.id }, data: { status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: days(-1) } });
    await prisma.subscription.update({ where: { businessId: grace.business.id }, data: { status: "GRACE", trialEndsAt: null, currentPeriodEnd: days(-5), graceUntil: days(-2) } });
    await prisma.subscription.update({ where: { businessId: ending.business.id }, data: { status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: days(2) } });

    await runBillingLifecycle(now);
    await runBillingLifecycle(now);

    const status = async (businessId: string) => prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    expect((await status(trial.business.id)).status).toBe("EXPIRED");
    const inGrace = await status(paid.business.id);
    expect(inGrace.status).toBe("GRACE");
    expect(inGrace.graceUntil!.getTime() - inGrace.currentPeriodEnd.getTime()).toBe(3 * 86_400_000);
    expect((await status(grace.business.id)).status).toBe("EXPIRED");
    expect((await status(ending.business.id)).status).toBe("ACTIVE");
    for (const { business } of [trial, paid, grace, ending]) {
      expect(await prisma.notification.count({ where: { businessId: business.id, type: "billing" } })).toBe(1);
    }
  });

  it("limits team seats to the plan, counting pending invitations", async () => {
    const { actor } = await setup();
    await inviteMember(actor, { email: `seat-1-${randomToken(4).toLowerCase()}@example.test`, role: "STAFF" });
    await inviteMember(actor, { email: `seat-2-${randomToken(4).toLowerCase()}@example.test`, role: "STAFF" });
    await expect(inviteMember(actor, { email: `seat-3-${randomToken(4).toLowerCase()}@example.test`, role: "STAFF" })).rejects.toThrow(/3 team seats/);
  });
});

describe("order payments recorded by staff", () => {
  it("marks an order paid once and triggers payment-confirmed workflows", async () => {
    const { actor, business } = await setup();
    const customer = await prisma.customer.create({ data: { businessId: business.id, displayName: "Yaa" } });
    const product = await createProduct(actor, { name: "Kente stole", description: null, price: 15_000, sku: null, stockQuantity: 3, trackInventory: true, lowStockThreshold: 0 });
    const order = await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId: product.variants[0].id, quantity: 1 }], createdByType: "USER" });
    const workflow = await createWorkflow(actor, { name: "Thank paying customers", trigger: "PAYMENT_CONFIRMED", definition: { conditions: [], actions: [{ type: "add_customer_tag", value: "paid" }] } });
    await setWorkflowStatus(actor, workflow.id, "ACTIVE");

    const paidOrder = await markOrderPaid(actor, order.id, "mobile_money");
    expect(paidOrder.paymentStatus).toBe("PAID");
    await expect(markOrderPaid(actor, order.id, "cash")).rejects.toThrow(/can't be marked as paid/);
    await processDueJobs({ workerId: "vitest", limit: 50 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).tags).toContain("paid");
    expect(await prisma.auditLog.count({ where: { businessId: business.id, action: "order.marked_paid" } })).toBe(1);
  });
});
