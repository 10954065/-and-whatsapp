import { describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { cancelBooking, createBooking, createService, createStaffMember, findAvailability, generateSlots, localToUtc } from "@/modules/bookings/bookings.service";
import { adjustStock, createOrder, createProduct, updateOrderStatus } from "@/modules/commerce/commerce.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup(timezone = "Africa/Accra") {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Ops Test");
  await prisma.business.update({ where: { id: business.id }, data: { timezone } });
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  const customer = await prisma.customer.create({ data: { businessId: business.id, displayName: "Akua" } });
  return { actor, business, customer };
}

describe("orders and inventory", () => {
  it("uses catalogue prices, decrements stock atomically and numbers orders sequentially", async () => {
    const { actor, business, customer } = await setup();
    const product = await createProduct(actor, { name: "Kente scarf", description: null, price: 12_000, sku: null, stockQuantity: 5, trackInventory: true, lowStockThreshold: 1 });
    const variantId = product.variants[0].id;
    const first = await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 2 }], createdByType: "USER" });
    const second = await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 1 }], createdByType: "USER" });
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first).toMatchObject({ subtotalMinor: 24_000, totalMinor: 24_000, paymentStatus: "UNPAID", status: "PENDING" });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockQuantity).toBe(2);
    expect(await prisma.stockMovement.count({ where: { variantId, type: "SALE" } })).toBe(2);
  });

  it("never oversells when orders race for the last units", async () => {
    const { actor, business, customer } = await setup();
    const product = await createProduct(actor, { name: "Last bag", description: null, price: 5_000, sku: null, stockQuantity: 3, trackInventory: true, lowStockThreshold: 0 });
    const variantId = product.variants[0].id;
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () => createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId, quantity: 1 }], createdByType: "AI" })),
    );
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(3);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockQuantity).toBe(0);
  });

  it("returns stock on cancellation and enforces fulfilment transitions", async () => {
    const { actor, business, customer } = await setup();
    const product = await createProduct(actor, { name: "Shea butter", description: null, price: 3_500, sku: null, stockQuantity: 4, trackInventory: true, lowStockThreshold: 0 });
    const order = await createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId: product.variants[0].id, quantity: 4 }], createdByType: "USER" });
    await expect(updateOrderStatus(actor, order.id, "DELIVERED")).rejects.toThrow(/can't move/);
    await updateOrderStatus(actor, order.id, "CANCELLED", "Customer changed mind");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stockQuantity).toBe(4);
    await expect(adjustStock(actor, product.variants[0].id, -10, "count")).rejects.toThrow(/below zero/);
  });

  it("caps AI discounts and blocks cross-tenant products", async () => {
    const { actor, business, customer } = await setup();
    const other = await setup();
    const product = await createProduct(actor, { name: "Dress", description: null, price: 10_000, sku: null, stockQuantity: 10, trackInventory: true, lowStockThreshold: 0 });
    await prisma.discount.create({ data: { businessId: business.id, code: "BIG50", type: "PERCENT", value: 50 } });
    await expect(
      createOrder({ businessId: business.id, customerId: customer.id, items: [{ variantId: product.variants[0].id, quantity: 1 }], discountCode: "big50", maxDiscountPercent: 10, createdByType: "AI" }),
    ).rejects.toThrow(/exceeds what the AI/);
    await expect(
      createOrder({ businessId: other.business.id, customerId: other.customer.id, items: [{ variantId: product.variants[0].id, quantity: 1 }], createdByType: "AI" }),
    ).rejects.toThrow(/unavailable/);
  });
});

describe("bookings", () => {
  it("converts business-local times to UTC", () => {
    expect(localToUtc("2026-11-14", 9 * 60, "Africa/Accra").toISOString()).toBe("2026-11-14T09:00:00.000Z");
    expect(localToUtc("2026-11-14", 9 * 60, "Africa/Lagos").toISOString()).toBe("2026-11-14T08:00:00.000Z");
  });

  it("generates slots that respect duration, buffers and busy times", () => {
    const hour = 3_600_000;
    const slots = generateSlots({ working: [{ start: 0, end: 4 * hour }], busy: [{ start: hour, end: 2 * hour }], durationMs: hour, bufferMs: 15 * 60_000, notBefore: 0, stepMs: 30 * 60_000 });
    expect(slots.map((slot) => slot.start / hour)).toEqual([2, 2.5]);
  });

  it("offers only real availability and prevents double booking under concurrency", async () => {
    const { actor, business, customer } = await setup();
    const service = await createService(actor, { name: "Braids", durationMinutes: 60, bufferMinutes: 15, price: 15_000 });
    const staff = await createStaffMember(actor, { name: "Akosua", serviceIds: [service.id], days: [6], start: "09:00", end: "12:00" });
    const date = "2026-11-14"; // a Saturday
    const slots = await findAvailability(business.id, service.id, date, { now: new Date("2026-11-01T00:00:00Z") });
    expect(slots[0].startsAt.toISOString()).toBe("2026-11-14T09:00:00.000Z");
    expect(slots.at(-1)?.startsAt.toISOString()).toBe("2026-11-14T10:45:00.000Z");

    const request = () => createBooking({ businessId: business.id, serviceId: service.id, staffId: staff.id, customerId: customer.id, startsAt: slots[0].startsAt, createdByType: "AI" });
    const results = await Promise.allSettled([request(), request(), request()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.booking.count({ where: { staffId: staff.id, status: "CONFIRMED" } })).toBe(1);

    const after = await findAvailability(business.id, service.id, date, { now: new Date("2026-11-01T00:00:00Z") });
    expect(after.some((slot) => slot.startsAt.getTime() < slots[0].startsAt.getTime() + 75 * 60_000)).toBe(false);

    const booking = await prisma.booking.findFirstOrThrow({ where: { staffId: staff.id } });
    await cancelBooking(actor, booking.id, "Rescheduling");
    const reopened = await findAvailability(business.id, service.id, date, { now: new Date("2026-11-01T00:00:00Z") });
    expect(reopened[0].startsAt.toISOString()).toBe("2026-11-14T09:00:00.000Z");
  });

  it("rejects times outside real availability", async () => {
    const { actor, business, customer } = await setup();
    const service = await createService(actor, { name: "Consultation", durationMinutes: 30, bufferMinutes: 0, price: null });
    const staff = await createStaffMember(actor, { name: "Kofi", serviceIds: [service.id], days: [1], start: "09:00", end: "10:00" });
    await expect(
      createBooking({ businessId: business.id, serviceId: service.id, staffId: staff.id, customerId: customer.id, startsAt: new Date("2026-11-16T15:00:00Z"), createdByType: "AI" }),
    ).rejects.toThrow(/no longer available/);
  });
});
