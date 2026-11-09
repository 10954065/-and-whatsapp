import type { Metadata } from "next";
import { AccessDenied, PageHeader } from "@/components/app/page-primitives";
import { ActionButton, StatusSelect } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatMoney } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { completeTaskAction, updateLeadStatusAction } from "@/modules/crm/crm.actions";

export const metadata: Metadata = { title: "Leads" };

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

export default async function LeadsPage() {
  const context = await requireTenant();
  if (!context.can("leads.read")) return <AccessDenied what="leads" />;
  const [leads, tasks] = await Promise.all([
    prisma.lead.findMany({ where: { businessId: context.businessId }, include: { customer: { select: { displayName: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }),
    prisma.followUpTask.findMany({ where: { businessId: context.businessId, status: "OPEN" }, include: { customer: { select: { displayName: true } } }, orderBy: { dueAt: "asc" }, take: 50 }),
  ]);
  const canWrite = context.can("leads.write");
  return (
    <>
      <PageHeader title="Leads" description="Buying interest captured by your assistant and team, from new to won." />
      <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
        {STATUSES.map((status) => {
          const column = leads.filter((lead) => lead.status === status);
          return (
            <section key={status} className="min-w-52 rounded-2xl border bg-card p-3">
              <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
                {status.charAt(0) + status.slice(1).toLowerCase()} <Badge variant="secondary">{column.length}</Badge>
              </h2>
              <ul className="grid gap-2">
                {column.map((lead) => (
                  <li key={lead.id} className="rounded-xl border bg-background p-3 text-sm">
                    <p className="font-medium">{lead.customer.displayName}</p>
                    <p className="text-xs text-muted-foreground">{lead.interest ?? "No details"}</p>
                    <p className="mt-1 text-xs">
                      {lead.estimatedValueMinor ? formatMoney(lead.estimatedValueMinor, lead.currency) : ""} {lead.capturedBy === "AI" ? <Badge className="ml-1 bg-primary/12 text-[10px] text-primary">AI</Badge> : null}
                    </p>
                    {canWrite ? (
                      <div className="mt-2">
                        <StatusSelect action={updateLeadStatusAction} values={{ leadId: lead.id }} name="status" current={lead.status} options={STATUSES} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="mb-3 font-semibold">Follow-ups due</h2>
        {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due. Follow-ups created by your assistant appear here.</p> : null}
        <ul className="divide-y text-sm">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 py-2">
              <div className="flex-1">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {formatDateTime(task.dueAt, context.business.timezone)}
                  {task.customer ? ` · ${task.customer.displayName}` : ""} · by {task.createdByType.toLowerCase()}
                </p>
              </div>
              {context.can("customers.write") ? <ActionButton action={completeTaskAction} values={{ taskId: task.id }} label="Done" /> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
