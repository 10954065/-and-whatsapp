"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@/config/permissions";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { adjustStock, createOrder, createProduct, productSchema, updateOrderStatus } from "@/modules/commerce/commerce.service";

async function actorWith(permission: Permission) {
  const context = await requireTenantAction(permission);
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function createProductAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => void (await createProduct(await actorWith("products.write"), parseInput(productSchema, formData)), revalidatePath("/app/products")), {
    source: "commerce.product",
    successMessage: "Product added.",
  });
}

const stockSchema = z.object({ variantId: z.string().min(1), delta: z.coerce.number().int(), reason: z.string().trim().min(2).max(200) });

export async function adjustStockAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const input = parseInput(stockSchema, formData);
      await adjustStock(await actorWith("inventory.write"), input.variantId, input.delta, input.reason);
      revalidatePath("/app/inventory");
      revalidatePath("/app/products");
    },
    { source: "commerce.stock", successMessage: "Stock updated." },
  );
}

const orderSchema = z.object({
  customerId: z.string().min(1, "Choose a customer."),
  variantId: z.string().min(1, "Choose a product."),
  quantity: z.coerce.number().int().min(1).max(1_000),
  deliveryMethod: z.enum(["delivery", "pickup"]).default("pickup"),
  deliveryAddress: z.string().trim().max(300).optional(),
  discountCode: z.string().trim().max(40).optional().transform((value) => value || null),
});

export async function createOrderAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const actor = await actorWith("orders.write");
      const input = parseInput(orderSchema, formData);
      await createOrder({
        businessId: actor.businessId,
        customerId: input.customerId,
        items: [{ variantId: input.variantId, quantity: input.quantity }],
        deliveryMethod: input.deliveryMethod,
        deliveryAddress: input.deliveryAddress ?? null,
        discountCode: input.discountCode,
        createdByType: "USER",
        createdById: actor.userId,
      });
      revalidatePath("/app/orders");
    },
    { source: "commerce.order", successMessage: "Order created." },
  );
}

const statusSchema = z.object({ orderId: z.string().min(1), status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "READY", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]) });

export async function updateOrderStatusAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const input = parseInput(statusSchema, formData);
      await updateOrderStatus(await actorWith("orders.write"), input.orderId, input.status);
      revalidatePath("/app/orders");
    },
    { source: "commerce.order_status", successMessage: "Order updated." },
  );
}
