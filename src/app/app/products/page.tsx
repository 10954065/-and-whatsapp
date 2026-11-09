import type { Metadata } from "next";
import { Package } from "lucide-react";
import { AccessDenied, EmptyState, PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { createProductAction } from "@/modules/commerce/commerce.actions";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const context = await requireTenant();
  if (!context.can("products.read")) return <AccessDenied what="products" />;
  const products = await prisma.product.findMany({
    where: { businessId: context.businessId, deletedAt: null },
    include: { variants: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Products" description="Your catalogue. The AI quotes prices and stock only from here." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="overflow-hidden surface rounded-[1.25rem]">
          {products.length === 0 ? (
            <EmptyState className="m-6" icon={Package} title="No products yet" description="Add the items you sell with their prices and stock." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const stock = product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.variants[0]?.sku ?? "No SKU"}</p>
                      </TableCell>
                      <TableCell>{formatMoney(product.priceMinor, product.currency)}</TableCell>
                      <TableCell>
                        {product.trackInventory ? (
                          <Badge variant={stock <= product.lowStockThreshold ? "destructive" : "secondary"}>{stock} in stock</Badge>
                        ) : (
                          <Badge variant="outline">Not tracked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
        {context.can("products.write") ? (
          <section className="surface rounded-[1.25rem] p-6">
            <h2 className="mb-4 font-semibold">Add a product</h2>
            <QuickForm
              action={createProductAction}
              submitLabel="Add product"
              fields={[
                { name: "name", label: "Name" },
                { name: "description", label: "Description", type: "textarea" },
                { name: "price", label: `Price (${context.business.currency})`, type: "number", step: "0.01" },
                { name: "sku", label: "SKU (optional)" },
                { name: "stockQuantity", label: "Opening stock", type: "number", defaultValue: "0" },
                { name: "lowStockThreshold", label: "Low-stock alert at", type: "number", defaultValue: "5" },
                { name: "trackInventory", label: "Track stock for this product", type: "checkbox", defaultValue: "on" },
              ]}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
