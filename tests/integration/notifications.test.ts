import { describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { processDueJobs } from "@/lib/queue";
import { escalateConversation } from "@/modules/ai/escalation";
import { adjustStock, createOrder, createProduct } from "@/modules/commerce/commerce.service";
import { countUnreadNotifications, markNotificationsRead } from "@/modules/notifications/notification.service";
import "@/workers/handlers";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Alert Shop");
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  const customer = await prisma.customer.create({ data: { businessId: business.id, displayName: "Esi" } });
  return { owner, actor, business, customer };
}

const notificationsOf = (businessId: string, type: string) => prisma.notification.findMany({ where: { businessId, type }, orderBy: { createdAt: "asc" } });

describe("team notifications", () => {
  it("alerts on new orders and when stock first falls to the low-stock level, then emails owners", async () => {
    const { owner, actor, business, customer } = await setup();
    const product = await createProduct(actor, { name: "Power bank", description: null, price: 25_000, sku: null, stockQuantity: 7, trackInventory: true, lowStockThreshold: 5 });
    const variantId = product.variants[0].id;

    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 1 }], createdByType: "AI" });
    expect(await notificationsOf(business.id, "stock.low")).toHaveLength(0);
    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 1 }], createdByType: "USER" });
    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 1 }], createdByType: "USER" });

    const orders = await notificationsOf(business.id, "order.created");
    expect(orders.map((notification) => notification.title)).toEqual(["New order #1", "New order #2", "New order #3"]);
    expect(orders[0].body).toContain("Esi");
    expect(orders[0].body).toContain("taken by your AI employee");
    const low = await notificationsOf(business.id, "stock.low");
    expect(low).toHaveLength(1);
    expect(low[0]).toMatchObject({ title: "Power bank is running low", body: "5 left (alert level 5).", link: "/app/inventory" });

    // Manual adjustments down to zero alert again only when crossing the threshold from above.
    await adjustStock(actor, variantId, -4, "count");
    expect(await notificationsOf(business.id, "stock.low")).toHaveLength(1);
    await adjustStock(actor, variantId, 10, "restock");
    await adjustStock(actor, variantId, -10, "count");
    expect((await notificationsOf(business.id, "stock.low")).map((notification) => notification.title)).toEqual(["Power bank is running low", "Power bank is out of stock"]);

    await processDueJobs({ workerId: "vitest", limit: 100 });
    await processDueJobs({ workerId: "vitest", limit: 100 });
    const emails = await prisma.emailLog.findMany({ where: { businessId: business.id, template: "notification" } });
    expect(emails).toHaveLength(5);
    expect(new Set(emails.map((email) => email.to))).toEqual(new Set([owner.email]));
  });

  it("respects notification settings and sends to the configured address", async () => {
    const { actor, business, customer } = await setup();
    await prisma.businessSettings.create({ data: { businessId: business.id, notifyOnNewOrder: false, notifyOnEscalation: true, notificationEmail: "alerts@example.test" } });
    const product = await createProduct(actor, { name: "Fan", description: null, price: 40_000, sku: null, stockQuantity: 10, trackInventory: true, lowStockThreshold: 0 });
    await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId: product.variants[0].id, quantity: 1 }], createdByType: "USER" });
    expect(await notificationsOf(business.id, "order.created")).toHaveLength(0);

    await escalateConversation({ businessId: business.id, conversationId: null, reason: "Refund request", summary: "Customer wants a refund" });
    const escalations = await notificationsOf(business.id, "ai.escalation");
    expect(escalations).toHaveLength(1);
    expect(escalations[0].body).toBe("Refund request: Customer wants a refund");

    await processDueJobs({ workerId: "vitest", limit: 100 });
    await processDueJobs({ workerId: "vitest", limit: 100 });
    const emails = await prisma.emailLog.findMany({ where: { businessId: business.id, template: "notification" } });
    expect(emails.map((email) => email.to)).toEqual(["alerts@example.test"]);

    await prisma.businessSettings.update({ where: { businessId: business.id }, data: { notifyOnEscalation: false } });
    await escalateConversation({ businessId: business.id, conversationId: null, reason: "Again", summary: "Second" });
    expect(await notificationsOf(business.id, "ai.escalation")).toHaveLength(1);
  });

  it("marks notifications read only inside the business", async () => {
    const first = await setup();
    const second = await setup();
    for (const { business } of [first, second]) {
      await escalateConversation({ businessId: business.id, conversationId: null, reason: "Help", summary: "Needs a person" });
    }
    const [notification] = await notificationsOf(first.business.id, "ai.escalation");
    expect(await markNotificationsRead(second.actor, notification.id)).toBe(0);
    expect(await countUnreadNotifications(first.business.id)).toBe(1);
    expect(await markNotificationsRead(first.actor, "all")).toBe(1);
    expect(await countUnreadNotifications(first.business.id)).toBe(0);
    expect(await countUnreadNotifications(second.business.id)).toBe(1);
  });
});
