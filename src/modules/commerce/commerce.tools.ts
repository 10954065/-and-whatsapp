import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";
import { isAppError } from "@/lib/monitoring/errors";
import { defineTool } from "@/modules/ai/tools/types";
import { createOrder, searchProducts } from "@/modules/commerce/commerce.service";

const describeVariant = (product: { name: string; priceMinor: number; currency: string; trackInventory: boolean }, variant: { id: string; name: string; priceMinor: number | null; stockQuantity: number; isDefault: boolean }) =>
  `${product.name}${variant.isDefault ? "" : ` (${variant.name})`} — ${formatMoney(variant.priceMinor ?? product.priceMinor, product.currency)} — ${
    product.trackInventory ? `${variant.stockQuantity} in stock` : "available"
  } — variant_id ${variant.id}`;

export const productInfoTool = defineTool({
  name: "get_product_info",
  label: "Look up products and prices",
  description: "Searches the product catalogue by name or keyword and returns products with their real prices, stock and variant ids. Use before quoting any price or recommending a product.",
  isWrite: false,
  schema: z.strictObject({ query: z.string().max(120).describe("Product name or keyword; empty to list popular items") }),
  async execute(context, input) {
    const products = await searchProducts(context.businessId, input.query.trim());
    if (products.length === 0) return { ok: true, message: "No matching products found.", verifiedFacts: [] };
    const lines = products.flatMap((product) => product.variants.map((variant) => describeVariant(product, variant)));
    return { ok: true, message: lines.join("\n"), verifiedFacts: lines };
  },
});

export const checkStockTool = defineTool({
  name: "check_stock",
  label: "Check stock levels",
  description: "Returns the current stock for a specific product variant id (from get_product_info). Use right before promising availability.",
  isWrite: false,
  schema: z.strictObject({ variant_id: z.string().min(1).max(64) }),
  async execute(context, input) {
    const variant = await prisma.productVariant.findFirst({ where: { id: input.variant_id, businessId: context.businessId }, include: { product: true } });
    if (!variant) return { ok: false, message: "Unknown product variant." };
    const line = describeVariant(variant.product, variant);
    return { ok: true, message: line, verifiedFacts: [line] };
  },
});

export const createOrderTool = defineTool({
  name: "create_order",
  label: "Create orders",
  description:
    "Creates an order for the current customer with catalogue prices. Only call after the customer has confirmed the items, quantities and delivery details. The order starts unpaid; never tell the customer it is paid. Returns the order number and total.",
  isWrite: true,
  schema: z.strictObject({
    items: z.array(z.strictObject({ variant_id: z.string().min(1).max(64), quantity: z.number().int().min(1).max(100) })).min(1).max(20),
    delivery_method: z.enum(["delivery", "pickup"]).optional(),
    delivery_address: z.string().max(300).optional(),
    discount_code: z.string().max(40).optional(),
    notes: z.string().max(500).optional(),
  }),
  async execute(context, input) {
    if (context.mode === "test") return { ok: true, message: `TEST MODE: an order for ${input.items.length} item(s) would be created.` };
    if (!context.customerId) return { ok: false, message: "No customer is linked to this conversation." };
    try {
      const order = await createOrder({
        businessId: context.businessId,
        customerId: context.customerId,
        conversationId: context.conversationId,
        items: input.items.map((item) => ({ variantId: item.variant_id, quantity: item.quantity })),
        discountCode: input.discount_code ?? null,
        maxDiscountPercent: context.maxDiscountPercent,
        deliveryMethod: input.delivery_method ?? null,
        deliveryAddress: input.delivery_address ?? null,
        notes: input.notes ?? null,
        createdByType: "AI",
        idempotencyKey: `ai-order:${context.aiRunId}:${JSON.stringify(input.items)}`,
      });
      const summary = `Order #${order.number} created. Total ${formatMoney(order.totalMinor, order.currency)} (unpaid).`;
      return { ok: true, message: summary, verifiedFacts: [summary], data: { orderId: order.id } };
    } catch (error) {
      if (isAppError(error)) return { ok: false, message: error.message };
      throw error;
    }
  },
});

export const orderStatusTool = defineTool({
  name: "get_order_status",
  label: "Check order status",
  description: "Returns the fulfilment and payment status of this customer's recent orders. Use when the customer asks where their order is or whether it is paid.",
  isWrite: false,
  schema: z.strictObject({ order_number: z.number().int().min(1).optional() }),
  async execute(context, input) {
    if (!context.customerId) return { ok: false, message: "No customer is linked to this conversation." };
    const orders = await prisma.order.findMany({
      where: { businessId: context.businessId, customerId: context.customerId, ...(input.order_number ? { number: input.order_number } : {}) },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    if (orders.length === 0) return { ok: true, message: "No orders found for this customer." };
    const lines = orders.map((order) => `Order #${order.number}: ${order.status.toLowerCase()}, payment ${order.paymentStatus.toLowerCase()}, total ${formatMoney(order.totalMinor, order.currency)}`);
    return { ok: true, message: lines.join("\n"), verifiedFacts: lines, paymentVerified: orders.some((order) => order.paymentStatus === "PAID") };
  },
});
