import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { AccessDenied, EmptyState, PageHeader } from "@/components/app/page-primitives";
import { QuickForm, StatusSelect } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatMoney } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { createOrderAction, markOrderPaidAction, updateOrderStatusAction } from "@/modules/commerce/commerce.actions";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "READY", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

/** Customers pay the business directly; staff record how. */
const PAYMENT_METHODS: Record<string, string> = { mobile_money: "Mobile money", cash: "Cash", bank_transfer: "Bank transfer", card: "Card", other: "Other" };

export default async function OrdersPage() {
  const context = await requireTenant();
  if (!context.can("orders.read")) return <AccessDenied what="orders" />;
  const [orders, customers, variants] = await Promise.all([
    prisma.order.findMany({ where: { businessId: context.businessId }, include: { customer: { select: { displayName: true } }, items: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.customer.findMany({ where: { businessId: context.businessId, deletedAt: null }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" }, take: 300 }),
    prisma.productVariant.findMany({ where: { businessId: context.businessId, isActive: true, product: { isActive: true, deletedAt: null } }, include: { product: true }, take: 300 }),
  ]);
  const canWrite = context.can("orders.write");
  return (
    <>
      <PageHeader title="Orders" description="Fulfilment and payment are tracked separately. An order is only marked paid after Paystack verifies the payment." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          {orders.length === 0 ? (
            <EmptyState className="m-6" icon={ShoppingBag} title="No orders yet" description="Orders created by you or your AI employee appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Fulfilment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <p className="font-medium">
                        #{order.number} · {order.customer.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt, context.business.timezone)} · {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(", ")} · by {order.createdByType.toLowerCase()}
                      </p>
                    </TableCell>
                    <TableCell>{formatMoney(order.totalMinor, order.currency)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={order.paymentStatus === "PAID" ? "default" : "outline"}>{order.paymentStatus.toLowerCase()}</Badge>
                        {canWrite && ["UNPAID", "PENDING", "FAILED"].includes(order.paymentStatus) && !["CANCELLED", "RETURNED"].includes(order.status) ? (
                          <StatusSelect
                            action={markOrderPaidAction}
                            values={{ orderId: order.id }}
                            name="method"
                            current="mobile_money"
                            options={Object.keys(PAYMENT_METHODS)}
                            labels={PAYMENT_METHODS}
                            ariaLabel={`Payment method for order ${order.number}`}
                            submitLabel="Mark paid"
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <StatusSelect action={updateOrderStatusAction} values={{ orderId: order.id }} name="status" current={order.status} options={STATUSES} />
                      ) : (
                        order.status.toLowerCase()
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        {canWrite && customers.length && variants.length ? (
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="mb-4 font-semibold">New order</h2>
            <QuickForm
              action={createOrderAction}
              submitLabel="Create order"
              fields={[
                { name: "customerId", label: "Customer", type: "select", options: customers.map((customer) => ({ value: customer.id, label: customer.displayName })) },
                { name: "variantId", label: "Product", type: "select", options: variants.map((variant) => ({ value: variant.id, label: `${variant.product.name} — ${formatMoney(variant.priceMinor ?? variant.product.priceMinor, variant.product.currency)}` })) },
                { name: "quantity", label: "Quantity", type: "number", defaultValue: "1" },
                { name: "deliveryMethod", label: "Delivery", type: "select", options: [{ value: "pickup", label: "Pick-up" }, { value: "delivery", label: "Delivery" }] },
                { name: "deliveryAddress", label: "Delivery address" },
                { name: "discountCode", label: "Discount code" },
              ]}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
