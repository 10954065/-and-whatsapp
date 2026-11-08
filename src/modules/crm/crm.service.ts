import { z } from "zod";
import type { LeadStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { recordAudit } from "@/modules/administration/audit.service";

export const customerSchema = z.object({
  displayName: z.string().trim().min(2, "Enter a name.").max(100),
  phone: z.string().trim().max(32).optional().transform((value) => value || null),
  email: z.string().trim().toLowerCase().max(254).optional().transform((value) => value || null),
  tags: z.string().max(300).optional().transform((value) => (value ? value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 10) : [])),
});

export async function listCustomers(businessId: string, search?: string, tag?: string) {
  const where: Prisma.CustomerWhereInput = {
    businessId,
    deletedAt: null,
    ...(tag ? { tags: { has: tag } } : {}),
    ...(search
      ? { OR: [{ displayName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }, { email: { contains: search, mode: "insensitive" } }] }
      : {}),
  };
  return prisma.customer.findMany({
    where,
    include: { _count: { select: { orders: true, bookings: true, conversations: true } }, leads: { where: { status: { notIn: ["WON", "LOST"] } }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

/** Manual creation never merges with existing records; a duplicate phone is reported instead. */
export async function createCustomer(actor: TenantActor, input: z.infer<typeof customerSchema>) {
  if (input.phone) {
    const existing = await prisma.customer.findFirst({ where: { businessId: actor.businessId, phone: input.phone, deletedAt: null } });
    if (existing) throw fail.conflict(`A customer with this phone already exists (${existing.displayName}).`);
  }
  return withTenantTx(actor.businessId, async (tx) => {
    const customer = await tx.customer.create({ data: { businessId: actor.businessId, ...input, source: "manual" } });
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "customer.created", entityType: "Customer", entityId: customer.id }, tx);
    return customer;
  });
}

export async function addCustomerNote(actor: TenantActor, customerId: string, body: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: actor.businessId } });
  if (!customer) throw fail.notFound("Customer");
  await withTenantTx(actor.businessId, (tx) => tx.customerNote.create({ data: { businessId: actor.businessId, customerId, authorId: actor.userId, body } }));
}

export async function createLead(actor: TenantActor, customerId: string, interest: string, estimatedValueMinor: number | null) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: actor.businessId } });
  if (!customer) throw fail.notFound("Customer");
  const business = await prisma.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: { currency: true } });
  return withTenantTx(actor.businessId, (tx) =>
    tx.lead.create({ data: { businessId: actor.businessId, customerId, interest, estimatedValueMinor, currency: business.currency, capturedBy: "USER", assignedToId: actor.userId, source: "manual" } }),
  );
}

export async function updateLeadStatus(actor: TenantActor, leadId: string, status: LeadStatus) {
  await withTenantTx(actor.businessId, async (tx) => {
    const result = await tx.lead.updateMany({
      where: { id: leadId, businessId: actor.businessId },
      data: { status, wonAt: status === "WON" ? new Date() : undefined, lostAt: status === "LOST" ? new Date() : undefined },
    });
    if (!result.count) throw fail.notFound("Lead");
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "lead.status_changed", entityType: "Lead", entityId: leadId, metadata: { status } }, tx);
  });
}

export async function completeTask(actor: TenantActor, taskId: string) {
  const result = await prisma.followUpTask.updateMany({ where: { id: taskId, businessId: actor.businessId, status: "OPEN" }, data: { status: "DONE", completedAt: new Date() } });
  if (!result.count) throw fail.notFound("Task");
}
