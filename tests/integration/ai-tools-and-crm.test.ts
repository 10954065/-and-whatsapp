import { describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { businessInfoTool, captureLeadTool, followUpTool } from "@/modules/ai/tools/core-tools";
import type { ToolContext } from "@/modules/ai/tools/types";
import { createService, createStaffMember } from "@/modules/bookings/bookings.service";
import { checkAvailabilityTool, createBookingTool } from "@/modules/bookings/bookings.tools";
import { createProduct } from "@/modules/commerce/commerce.service";
import { checkStockTool, createOrderTool, orderStatusTool, productInfoTool } from "@/modules/commerce/commerce.tools";
import { addCustomerNote, completeTask, createCustomer, createLead, customerSchema, listCustomers, updateLeadStatus } from "@/modules/crm/crm.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Tools Shop");
  await prisma.business.update({ where: { id: business.id }, data: { description: "Phones and accessories in Osu, Accra.", phone: "+233200000001" } });
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  const customer = await prisma.customer.create({ data: { businessId: business.id, displayName: "Kwame" } });
  const context = (mode: "live" | "test" = "live", customerId: string | null = customer.id): ToolContext => ({
    businessId: business.id,
    conversationId: null,
    customerId,
    aiRunId: `run-${mode}-${Math.random()}`,
    mode,
    timezone: "Africa/Accra",
    currency: "GHS",
    maxDiscountPercent: 0,
  });
  return { actor, business, customer, context };
}

describe("AI commerce and booking tools", () => {
  it("quotes real catalogue data, creates unpaid orders and reports their status", async () => {
    const { actor, context } = await setup();
    const product = await createProduct(actor, { name: "Wireless earbuds", description: null, price: 45_000, sku: "EB-1", stockQuantity: 3, trackInventory: true, lowStockThreshold: 0 });
    const variantId = product.variants[0].id;

    const info = await productInfoTool.execute(context(), { query: "earbuds" });
    expect(info.message).toContain("Wireless earbuds");
    expect(info.message).toContain(variantId);
    expect((await productInfoTool.execute(context(), { query: "television" })).message).toBe("No matching products found.");
    expect((await checkStockTool.execute(context(), { variant_id: variantId })).message).toContain("3 in stock");
    expect((await checkStockTool.execute(context(), { variant_id: "missing" })).ok).toBe(false);

    expect((await createOrderTool.execute(context("test"), { items: [{ variant_id: variantId, quantity: 1 }] })).message).toMatch(/^TEST MODE/);
    expect((await createOrderTool.execute(context("live", null), { items: [{ variant_id: variantId, quantity: 1 }] })).ok).toBe(false);
    const created = await createOrderTool.execute(context(), { items: [{ variant_id: variantId, quantity: 2 }], delivery_method: "pickup" });
    expect(created.message).toMatch(/Order #1 created\. Total .*900.*\(unpaid\)/);
    const tooMany = await createOrderTool.execute(context(), { items: [{ variant_id: variantId, quantity: 5 }] });
    expect(tooMany).toMatchObject({ ok: false });

    const status = await orderStatusTool.execute(context(), { order_number: 1 });
    expect(status.message).toContain("payment unpaid");
    expect(status.paymentVerified).toBe(false);
  });

  it("lists services, offers only real slots and books one", async () => {
    const { actor, context } = await setup();
    const service = await createService(actor, { name: "Screen repair", durationMinutes: 60, bufferMinutes: 0, price: 20_000 });
    const staff = await createStaffMember(actor, { name: "Yaw", serviceIds: [service.id], days: [0, 1, 2, 3, 4, 5, 6], start: "08:00", end: "18:00" });
    expect((await checkAvailabilityTool.execute(context(), { service_id: "", date: "2027-02-01" })).message).toContain(`service_id ${service.id}`);

    const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const slots = await checkAvailabilityTool.execute(context(), { service_id: service.id, date });
    const start = /start (\S+)/.exec(slots.message)![1];
    expect(slots.message).toContain(`staff_id ${staff.id}`);
    expect((await createBookingTool.execute(context("test"), { service_id: service.id, staff_id: staff.id, start })).message).toMatch(/^TEST MODE/);
    const booked = await createBookingTool.execute(context(), { service_id: service.id, staff_id: staff.id, start });
    expect(booked).toMatchObject({ ok: true });
    expect((await createBookingTool.execute({ ...context(), aiRunId: "another-run" }, { service_id: service.id, staff_id: staff.id, start })).ok).toBe(false);
  });
});

describe("AI core tools", () => {
  it("reads business facts and records leads and follow-ups, never writing in test mode", async () => {
    const { business, customer, context } = await setup();
    const info = await businessInfoTool.execute(context(), {});
    expect(info.message).toContain("Phones and accessories in Osu, Accra.");

    expect((await captureLeadTool.execute(context("test"), { interest: "Bulk phone order" })).message).toMatch(/^TEST MODE/);
    await captureLeadTool.execute(context(), { interest: "Bulk phone order", estimated_value: 500_000 });
    await captureLeadTool.execute(context(), { interest: "Bulk phone order for 20 staff" });
    const leads = await prisma.lead.findMany({ where: { customerId: customer.id } });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ interest: "Bulk phone order for 20 staff", estimatedValueMinor: 500_000, capturedBy: "AI" });

    await followUpTool.execute(context(), { title: "Send bulk quote", due_in_hours: 4 });
    expect(await prisma.followUpTask.count({ where: { businessId: business.id, createdByType: "AI" } })).toBe(1);
  });
});

describe("CRM", () => {
  it("creates customers without merging, notes, leads and tasks", async () => {
    const { actor, business } = await setup();
    const input = customerSchema.parse({ displayName: "Abena Owusu", phone: "+233244111222", email: "ABENA@Example.test", tags: "VIP, wholesale" });
    expect(input).toMatchObject({ email: "abena@example.test", tags: ["vip", "wholesale"] });
    const customer = await createCustomer(actor, input);
    await expect(createCustomer(actor, customerSchema.parse({ displayName: "Abena again", phone: "+233244111222" }))).rejects.toThrow(/already exists/);

    expect((await listCustomers(business.id, "abena")).map((row) => row.id)).toContain(customer.id);
    expect((await listCustomers(business.id, undefined, "vip")).map((row) => row.id)).toEqual([customer.id]);

    await addCustomerNote(actor, customer.id, "Prefers delivery after 5pm");
    expect(await prisma.customerNote.count({ where: { customerId: customer.id } })).toBe(1);

    const lead = await createLead(actor, customer.id, "Office laptops", 1_200_000);
    await updateLeadStatus(actor, lead.id, "WON");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).wonAt).not.toBeNull();
    await expect(updateLeadStatus(actor, "missing", "LOST")).rejects.toThrow(/not found/i);

    const task = await prisma.followUpTask.create({ data: { businessId: business.id, title: "Call back", dueAt: new Date(), createdByType: "USER" } });
    await completeTask(actor, task.id);
    await expect(completeTask(actor, task.id)).rejects.toThrow(/not found/i);
  });
});
