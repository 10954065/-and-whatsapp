import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { AccessDenied, EmptyState, PageHeader } from "@/components/app/page-primitives";
import { ActionButton, QuickForm, type FieldSpec } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { createWorkflowAction, setWorkflowStatusAction } from "@/modules/workflows/workflow.actions";
import { listWorkflows } from "@/modules/workflows/workflow.service";

export const metadata: Metadata = { title: "Automation" };

const TRIGGER_LABEL: Record<string, string> = {
  WHATSAPP_MESSAGE: "New WhatsApp message",
  INSTAGRAM_MESSAGE: "New Instagram message",
  NEW_CUSTOMER: "New customer",
  NEW_LEAD: "New lead",
  NEW_ORDER: "New order",
  PAYMENT_CONFIRMED: "Payment confirmed",
  BOOKING_CREATED: "Booking created",
  BOOKING_CANCELLED: "Booking cancelled",
};

const CONDITIONS = [
  { value: "", label: "No condition" },
  { value: "channel", label: "Channel is (whatsapp / instagram)" },
  { value: "customer_tag", label: "Customer has tag" },
  { value: "message_contains", label: "Message contains" },
  { value: "lead_status", label: "Lead status is" },
  { value: "order_total_gte", label: "Order total at least" },
  { value: "within_business_hours", label: "Within opening hours (yes / no)" },
];

const ACTIONS = [
  { value: "", label: "None" },
  { value: "send_message", label: "Send message (text)" },
  { value: "add_customer_tag", label: "Add customer tag (tag)" },
  { value: "notify_team", label: "Notify team (title)" },
  { value: "create_follow_up", label: "Create follow-up (title|hours)" },
  { value: "create_lead", label: "Create lead (interest)" },
  { value: "assign_conversation", label: "Assign conversation (member id)" },
];

export default async function AutomationPage() {
  const context = await requireTenant();
  if (!context.can("automation.read")) return <AccessDenied what="automation" />;
  const { workflows, runs } = await listWorkflows(context.businessId);
  const canManage = context.can("automation.manage");
  const builder: FieldSpec[] = [
    { name: "name", label: "Workflow name", placeholder: "Tag wholesale enquiries" },
    { name: "trigger", label: "When", type: "select", options: Object.entries(TRIGGER_LABEL).map(([value, label]) => ({ value, label })) },
    ...[1, 2].flatMap((row) => [
      { name: `c${row}_field`, label: `Condition ${row}`, type: "select" as const, options: CONDITIONS },
      { name: `c${row}_value`, label: `Condition ${row} value` },
    ]),
    ...[1, 2, 3].flatMap((row) => [
      { name: `a${row}_type`, label: `Then ${row}`, type: "select" as const, options: ACTIONS },
      { name: `a${row}_value`, label: `Then ${row} value` },
    ]),
  ];

  return (
    <>
      <PageHeader title="Automation studio" description="When something happens, check conditions, then act. Messages respect consent and the 24-hour window; chained workflows stop after 3 levels." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="mb-3 font-semibold">Workflows</h2>
            {workflows.length === 0 ? (
              <EmptyState icon={Blocks} title="No workflows yet" description="Start with “New customer → send a welcome message” or “Order at least GH₵500 → notify team”." />
            ) : (
              <ul className="divide-y">
                {workflows.map((workflow) => (
                  <li key={workflow.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1">
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TRIGGER_LABEL[workflow.trigger]} · v{workflow.currentVersion} · {workflow._count.runs} runs
                      </p>
                    </div>
                    <Badge variant={workflow.status === "ACTIVE" ? "default" : "secondary"}>{workflow.status.toLowerCase()}</Badge>
                    {canManage ? (
                      <ActionButton
                        action={setWorkflowStatusAction}
                        values={{ workflowId: workflow.id, status: workflow.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }}
                        label={workflow.status === "ACTIVE" ? "Pause" : "Activate"}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="mb-3 font-semibold">Recent runs</h2>
            <ul className="divide-y text-sm">
              {runs.length === 0 ? <li className="py-2 text-muted-foreground">No runs yet.</li> : null}
              {runs.map((run) => (
                <li key={run.id} className="py-2">
                  <span className="font-medium">{run.workflow.name}</span> · {run.status.toLowerCase()} · {formatRelative(run.createdAt)}
                  {run.error ? <span className="text-muted-foreground"> · {run.error}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
        {canManage ? (
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="mb-4 font-semibold">New workflow</h2>
            <QuickForm action={createWorkflowAction} submitLabel="Save workflow" fields={builder} columns={2} />
          </section>
        ) : null}
      </div>
    </>
  );
}
