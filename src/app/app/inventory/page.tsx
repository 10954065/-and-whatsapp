import type { Metadata } from "next";
import { AccessDenied, PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { adjustStockAction } from "@/modules/commerce/commerce.actions";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const context = await requireTenant();
  if (!context.can("products.read")) return <AccessDenied what="inventory" />;
  const [variants, movements] = await Promise.all([
    prisma.productVariant.findMany({ where: { businessId: context.businessId, isActive: true, product: { deletedAt: null, trackInventory: true } }, include: { product: true }, orderBy: { stockQuantity: "asc" }, take: 200 }),
    prisma.stockMovement.findMany({ where: { businessId: context.businessId }, include: { variant: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <>
      <PageHeader title="Inventory" description="Stock levels and every stock movement. Orders reduce stock automatically; cancellations return it." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt, context.business.timezone)}</TableCell>
                  <TableCell>
                    {movement.variant.product.name}
                    <p className="text-xs text-muted-foreground">
                      {movement.type.toLowerCase()} {movement.reason ? `· ${movement.reason}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className={movement.quantityDelta < 0 ? "text-destructive" : "text-success"}>
                    {movement.quantityDelta > 0 ? "+" : ""}
                    {movement.quantityDelta}
                  </TableCell>
                  <TableCell>{movement.balanceAfter}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        {context.can("inventory.write") && variants.length ? (
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="mb-4 font-semibold">Adjust stock</h2>
            <QuickForm
              action={adjustStockAction}
              submitLabel="Record adjustment"
              fields={[
                { name: "variantId", label: "Product", type: "select", options: variants.map((variant) => ({ value: variant.id, label: `${variant.product.name} (${variant.stockQuantity} in stock)` })) },
                { name: "delta", label: "Change (+ restock, − loss)", type: "number", placeholder: "10" },
                { name: "reason", label: "Reason", placeholder: "New delivery from supplier" },
              ]}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
