import { describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { getAnalytics, localDate } from "@/modules/analytics/analytics.service";
import { createOrder, createProduct, updateOrderStatus } from "@/modules/commerce/commerce.service";
import { connectSandbox } from "@/modules/integrations/integration.service";
import { simulateSandboxMessage } from "@/modules/messaging/inbox.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Analytics Shop");
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  return { actor, business };
}

const aiRun = (businessId: string, trigger: "INBOUND_MESSAGE" | "TEST_CONSOLE", status: "SUCCEEDED" | "ESCALATED") =>
  prisma.aiRun.create({ data: { businessId, trigger, status, tier: "fast", model: "claude-haiku-5-5", promptKey: "customer-agent", promptVersion: 1 } });

describe("business analytics", () => {
  it("counts only this business's real activity and buckets it by local day", async () => {
    const { actor, business } = await setup();
    const other = await setup();
    await connectSandbox(actor);
    await connectSandbox(other.actor);

    await simulateSandboxMessage(actor, { customerName: "Kofi", text: "Hello, are you open?" });
    await simulateSandboxMessage(actor, { customerName: "Efua", text: "Price of the blue dress?" });
    await simulateSandboxMessage(other.actor, { customerName: "Someone", text: "Not yours" });

    const customer = await prisma.customer.findFirstOrThrow({ where: { businessId: business.id, displayName: "Kofi" } });
    const product = await createProduct(actor, { name: "Blue dress", description: null, price: 20_000, sku: null, stockQuantity: 10, trackInventory: true, lowStockThreshold: 0 });
    const variantId = product.variants[0].id;
    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 2 }], createdByType: "AI" });
    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 1 }], createdByType: "USER" });
    const cancelled = await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 3 }], createdByType: "USER" });
    await updateOrderStatus(actor, cancelled.id, "CANCELLED", "Changed mind");
    await prisma.order.updateMany({ where: { businessId: business.id, number: 1 }, data: { paymentStatus: "PAID" } });

    await aiRun(business.id, "INBOUND_MESSAGE", "SUCCEEDED");
    await aiRun(business.id, "INBOUND_MESSAGE", "ESCALATED");
    await aiRun(business.id, "TEST_CONSOLE", "SUCCEEDED");
    await prisma.aiUsageRecord.create({ data: { businessId: business.id, model: "claude-haiku-5-5", tier: "fast", inputTokens: 1_000, outputTokens: 200, costMicros: 1_500 } });
    await prisma.lead.create({ data: { businessId: business.id, customerId: customer.id, status: "WON" } });
    await prisma.lead.create({ data: { businessId: business.id, customerId: customer.id, status: "NEW" } });

    const data = await getAnalytics(business.id, 7);
    expect(data.conversations).toMatchObject({ started: 2, inbound: 2 });
    expect(data.ai).toMatchObject({ runs: 2, succeeded: 1, escalated: 1, escalationRate: 0.5, costMicros: 1_500 });
    expect(data.sales).toMatchObject({ orders: 2, revenueMinor: 60_000, paidMinor: 40_000, aiOrders: 1, averageOrderMinor: 30_000 });
    expect(data.sales.topProducts).toEqual([{ name: "Blue dress", quantity: 3, revenueMinor: 60_000 }]);
    expect(data.leads).toMatchObject({ created: 2, won: 1, open: 1, winRate: 0.5 });

    expect(data.daily).toHaveLength(7);
    const today = data.daily.at(-1)!;
    expect(today.date).toBe(localDate(new Date(), data.timezone));
    expect(today).toMatchObject({ conversations: 2, orders: 2, revenueMinor: 60_000 });
    expect(data.daily.slice(0, -1).every((point) => point.conversations === 0 && point.orders === 0)).toBe(true);

    const otherData = await getAnalytics(other.business.id, 30);
    expect(otherData.conversations.started).toBe(1);
    expect(otherData.sales.orders).toBe(0);
  });

  it("returns honest zeros for a brand-new workspace", async () => {
    const { business } = await setup();
    const data = await getAnalytics(business.id, 30);
    expect(data.daily).toHaveLength(30);
    expect(data.sales.averageOrderMinor).toBeNull();
    expect(data.ai.escalationRate).toBeNull();
    expect(data.leads.winRate).toBeNull();
  });
});
