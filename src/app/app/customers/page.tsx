import type { Metadata } from "next";
import { Users } from "lucide-react";
import { AccessDenied, EmptyState, PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatRelative } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { addCustomerNoteAction, createCustomerAction, createLeadAction } from "@/modules/crm/crm.actions";
import { listCustomers } from "@/modules/crm/crm.service";

export const metadata: Metadata = { title: "Customers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  if (!context.can("customers.read")) return <AccessDenied what="customers" />;
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.slice(0, 80) : undefined;
  const customers = await listCustomers(context.businessId, search);
  const canWrite = context.can("customers.write");
  const options = customers.map((customer) => ({ value: customer.id, label: customer.displayName }));

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has contacted you or been added by your team. Records are never merged automatically." />
      <form action="/app/customers" className="mb-4">
        <input name="q" defaultValue={search} placeholder="Search by name, phone or email" aria-label="Search customers" className="h-9 w-full max-w-sm rounded-lg border bg-card px-3 text-sm" />
      </form>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="overflow-hidden surface rounded-[1.25rem]">
          {customers.length === 0 ? (
            <EmptyState className="m-6" icon={Users} title="No customers found" description="Customers appear automatically when they message you." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="hidden md:table-cell">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <p className="font-medium">{customer.displayName}</p>
                      <p className="text-xs text-muted-foreground">{[customer.phone, customer.email, customer.source].filter(Boolean).join(" · ")}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {customer.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                        {customer.leads.length ? <Badge className="text-[10px]">lead · {customer.leads[0].status.toLowerCase()}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {customer._count.conversations} chats · {customer._count.orders} orders · {customer._count.bookings} bookings
                      <br />
                      {customer.lastInboundAt ? `Last message ${formatRelative(customer.lastInboundAt)}` : "No messages yet"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatMoney(customer.lifetimeValueMinor, context.business.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        {canWrite ? (
          <aside className="grid content-start gap-6">
            <section className="surface rounded-[1.25rem] p-6">
              <h2 className="mb-4 font-semibold">Add a customer</h2>
              <QuickForm
                action={createCustomerAction}
                submitLabel="Add customer"
                fields={[
                  { name: "displayName", label: "Name" },
                  { name: "phone", label: "Phone", type: "tel", placeholder: "+233…" },
                  { name: "email", label: "Email", type: "email" },
                  { name: "tags", label: "Tags", placeholder: "vip, wholesale" },
                ]}
              />
            </section>
            {options.length ? (
              <>
                <section className="surface rounded-[1.25rem] p-6">
                  <h2 className="mb-4 font-semibold">Add a note</h2>
                  <QuickForm action={addCustomerNoteAction} submitLabel="Save note" fields={[{ name: "customerId", label: "Customer", type: "select", options }, { name: "body", label: "Note", type: "textarea" }]} />
                </section>
                {context.can("leads.write") ? (
                  <section className="surface rounded-[1.25rem] p-6">
                    <h2 className="mb-4 font-semibold">Convert to lead</h2>
                    <QuickForm
                      action={createLeadAction}
                      submitLabel="Create lead"
                      fields={[
                        { name: "customerId", label: "Customer", type: "select", options },
                        { name: "interest", label: "Interested in" },
                        { name: "value", label: `Estimated value (${context.business.currency})`, type: "number", step: "0.01" },
                      ]}
                    />
                  </section>
                ) : null}
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
    </>
  );
}
