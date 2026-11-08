import { z } from "zod";
import type { ActorType, OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx, type TenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { AppError, fail } from "@/lib/monitoring/errors";
import { recordAudit } from "@/modules/administration/audit.service";
import { emitWorkflowEvent } from "@/modules/workflows/workflow.engine";

const money = z.coerce.number().min(0).max(10_000_000).transform((value) => Math.round(value * 100));

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2_000).optional().transform((value) => value || null),
  price: money,
  sku: z.string().trim().max(60).optional().transform((value) => value || null),
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  trackInventory: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(5),
});

export async function createProduct(actor: TenantActor, input: z.infer<typeof productSchema>) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: { currency: true } });
  return withTenantTx(actor.businessId, async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        description: input.description,
        priceMinor: input.price,
        currency: business.currency,
        trackInventory: input.trackInventory,
        lowStockThreshold: input.lowStockThreshold,
        variants: { create: { businessId: actor.businessId, name: "Default", sku: input.sku, isDefault: true, stockQuantity: input.stockQuantity } },
      },
      include: { variants: true },
    });
    if (input.stockQuantity > 0) {
      await tx.stockMovement.create({
        data: { businessId: actor.businessId, variantId: product.variants[0].id, type: "INITIAL", quantityDelta: input.stockQuantity, balanceAfter: input.stockQuantity, actorType: "USER", actorId: actor.userId },
      });
    }
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "product.created", entityType: "Product", entityId: product.id }, tx);
    return product;
  });
}

/** Atomic stock change with a ledger entry; never lets stock go below zero. */
export async function adjustStock(actor: TenantActor, variantId: string, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0) throw fail.validation("Enter a whole number other than zero.");
  return withTenantTx(actor.businessId, async (tx) => {
    const rows = await tx.$queryRaw<{ stockQuantity: number }[]>`
      UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${delta}, "updatedAt" = now()
      WHERE "id" = ${variantId} AND "businessId" = ${actor.businessId} AND "stockQuantity" + ${delta} >= 0
      RETURNING "stockQuantity"`;
    if (rows.length === 0) throw fail.validation("Stock can't go below zero (or the product was not found).");
    await tx.stockMovement.create({
      data: { businessId: actor.businessId, variantId, type: delta > 0 ? "RESTOCK" : "ADJUSTMENT", quantityDelta: delta, balanceAfter: rows[0].stockQuantity, reason, actorType: "USER", actorId: actor.userId },
    });
    return rows[0].stockQuantity;
  });
}

async function nextOrderNumber(tx: TenantTx, businessId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "BusinessCounter" ("businessId", "key", "value") VALUES (${businessId}, 'order', 1)
    ON CONFLICT ("businessId", "key") DO UPDATE SET "value" = "BusinessCounter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

export interface OrderLineInput {
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  businessId: string;
  customerId: string;
  conversationId?: string | null;
  items: OrderLineInput[];
  discountCode?: string | null;
  /** Upper bound for discounts applied by the AI (percent). */
  maxDiscountPercent?: number;
  notes?: string | null;
  deliveryMethod?: string | null;
  deliveryAddress?: string | null;
  createdByType: ActorType;
  createdById?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Creates an order in one tenant transaction: prices come from the catalogue (never from
 * the caller), stock is decremented atomically per line (fails if insufficient), the order
 * number comes from an atomic counter, and payment stays UNPAID until a verified payment.
 */
export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) throw fail.validation("Add at least one item.");
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
    if (existing) return existing;
  }
  const lines = new Map<string, number>();
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000) throw fail.validation("Quantities must be between 1 and 1000.");
    lines.set(item.variantId, (lines.get(item.variantId) ?? 0) + item.quantity);
  }

  const created = await withTenantTx(input.businessId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, businessId: input.businessId, deletedAt: null } });
    if (!customer) throw fail.notFound("Customer");
    const variants = await tx.productVariant.findMany({
      where: { id: { in: [...lines.keys()] }, businessId: input.businessId, isActive: true, product: { isActive: true, deletedAt: null } },
      include: { product: true },
    });
    if (variants.length !== lines.size) throw fail.validation("One or more products are unavailable.");

    let subtotal = 0;
    const itemsData: Omit<Prisma.OrderItemCreateManyInput, "orderId">[] = [];
    for (const variant of variants) {
      const quantity = lines.get(variant.id)!;
      const unitPrice = variant.priceMinor ?? variant.product.priceMinor;
      subtotal += unitPrice * quantity;
      itemsData.push({
        businessId: input.businessId,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.isDefault ? null : variant.name,
        sku: variant.sku,
        unitPriceMinor: unitPrice,
        quantity,
        lineTotalMinor: unitPrice * quantity,
      });
    }

    let discount = 0;
    let discountCode: string | null = null;
    if (input.discountCode) {
      const now = new Date();
      const code = await tx.discount.findFirst({ where: { businessId: input.businessId, code: input.discountCode.trim().toUpperCase(), isActive: true } });
      const isValid =
        code &&
        (!code.startsAt || code.startsAt <= now) &&
        (!code.endsAt || code.endsAt >= now) &&
        (code.maxRedemptions === null || code.redemptionCount < code.maxRedemptions) &&
        (code.minOrderMinor === null || subtotal >= code.minOrderMinor);
      if (!isValid) throw fail.validation("That discount code is not valid for this order.");
      discount = code.type === "PERCENT" ? Math.floor((subtotal * code.value) / 100) : Math.min(code.value, subtotal);
      if (input.maxDiscountPercent !== undefined && discount > Math.floor((subtotal * input.maxDiscountPercent) / 100)) {
        throw fail.forbidden("This discount exceeds what the AI employee may apply. A team member must approve it.");
      }
      discountCode = code.code;
      await tx.discount.update({ where: { id: code.id }, data: { redemptionCount: { increment: 1 } } });
    }

    for (const variant of variants) {
      if (!variant.product.trackInventory) continue;
      const quantity = lines.get(variant.id)!;
      const rows = await tx.$queryRaw<{ stockQuantity: number }[]>`
        UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${quantity}, "updatedAt" = now()
        WHERE "id" = ${variant.id} AND "businessId" = ${input.businessId} AND "stockQuantity" >= ${quantity}
        RETURNING "stockQuantity"`;
      if (rows.length === 0) throw new AppError("CONFLICT", `Only ${variant.stockQuantity} of “${variant.product.name}” left in stock.`);
      variant.stockQuantity = rows[0].stockQuantity;
    }

    const order = await tx.order.create({
      data: {
        businessId: input.businessId,
        number: await nextOrderNumber(tx, input.businessId),
        customerId: input.customerId,
        conversationId: input.conversationId ?? null,
        currency: variants[0].product.currency,
        subtotalMinor: subtotal,
        discountMinor: discount,
        totalMinor: subtotal - discount,
        discountCode,
        notes: input.notes ?? null,
        deliveryMethod: input.deliveryMethod ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        createdByType: input.createdByType,
        createdById: input.createdById ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        items: { createMany: { data: itemsData } },
      },
      include: { items: true },
    });
    for (const variant of variants.filter((entry) => entry.product.trackInventory)) {
      await tx.stockMovement.create({
        data: {
          businessId: input.businessId,
          variantId: variant.id,
          type: "SALE",
          quantityDelta: -lines.get(variant.id)!,
          balanceAfter: variant.stockQuantity,
          orderId: order.id,
          actorType: input.createdByType,
          actorId: input.createdById ?? null,
        },
      });
    }
    await recordAudit({ businessId: input.businessId, actorType: input.createdByType, actorId: input.createdById ?? null, action: "order.created", entityType: "Order", entityId: order.id, metadata: { total: order.totalMinor } }, tx);
    return order;
  });
  await emitWorkflowEvent({
    trigger: "NEW_ORDER",
    eventId: `order:${created.id}`,
    businessId: input.businessId,
    depth: 0,
    customerId: input.customerId,
    conversationId: input.conversationId ?? null,
    orderTotalMinor: created.totalMinor,
  });
  return created;
}

const FULFILMENT_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "READY", "CANCELLED"],
  PROCESSING: ["READY", "SHIPPED", "CANCELLED"],
  READY: ["SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Moves fulfilment status along allowed transitions; cancellations return stock. Payment status is separate. */
export async function updateOrderStatus(actor: TenantActor, orderId: string, status: OrderStatus, reason?: string) {
  return withTenantTx(actor.businessId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, businessId: actor.businessId }, include: { items: { include: { variant: { include: { product: true } } } } } });
    if (!order) throw fail.notFound("Order");
    if (!FULFILMENT_FLOW[order.status].includes(status)) throw fail.validation(`An order can't move from ${order.status.toLowerCase()} to ${status.toLowerCase()}.`);
    if (status === "CANCELLED" || status === "RETURNED") {
      for (const item of order.items.filter((entry) => entry.variant.product.trackInventory)) {
        const updated = await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
        await tx.stockMovement.create({
          data: { businessId: actor.businessId, variantId: item.variantId, type: status === "CANCELLED" ? "CANCELLATION" : "RETURN", quantityDelta: item.quantity, balanceAfter: updated.stockQuantity, orderId, actorType: "USER", actorId: actor.userId },
        });
      }
    }
    const now = new Date();
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        confirmedAt: status === "CONFIRMED" ? now : order.confirmedAt,
        fulfilledAt: status === "DELIVERED" ? now : order.fulfilledAt,
        cancelledAt: status === "CANCELLED" ? now : order.cancelledAt,
        cancelReason: status === "CANCELLED" ? (reason ?? null) : order.cancelReason,
      },
    });
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "order.status_changed", entityType: "Order", entityId: orderId, metadata: { from: order.status, to: status } }, tx);
    return updated;
  });
}

export async function searchProducts(businessId: string, query: string, take = 8) {
  return prisma.product.findMany({
    where: {
      businessId,
      isActive: true,
      deletedAt: null,
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { tags: { has: query.toLowerCase() } }] } : {}),
    },
    include: { variants: { where: { isActive: true } } },
    take,
  });
}
