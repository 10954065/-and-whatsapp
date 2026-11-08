import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { requireAdminConsole } from "@/lib/auth/current";
import { updatePlanAction } from "@/modules/administration/admin.actions";
import { listPlans } from "@/modules/administration/admin.service";

export const metadata: Metadata = { title: "Plans" };

const limit = (limits: unknown, key: string) => String((limits as Record<string, unknown> | null)?.[key] ?? 0);

export default async function AdminPlansPage() {
  if (!(await requireAdminConsole())) return null;
  const plans = await listPlans();

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Plans"
        description="Prices are in cedis and apply to new payments; current periods keep what was paid. Plans are never deleted — deactivate one to stop selling it."
      />
      {plans.length === 0 ? <p className="text-sm text-muted-foreground">No plans yet. Run the database seed to create the starting plans.</p> : null}
      <div className="grid gap-6">
        {plans.map((plan) => (
          <section key={plan.id} className="rounded-2xl border bg-card p-6">
            <h2 className="mb-4 flex flex-wrap items-center gap-2 font-semibold">
              {plan.name} <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
              <Badge variant="outline">{plan._count.subscriptions} subscriptions</Badge>
              {!plan.isActive ? <Badge variant="destructive">inactive</Badge> : null}
            </h2>
            <QuickForm
              action={updatePlanAction}
              submitLabel="Save plan"
              resetOnSuccess={false}
              hidden={{ planId: plan.id }}
              columns={3}
              fields={[
                { name: "name", label: "Name", defaultValue: plan.name },
                { name: "priceMonthly", label: "Monthly price (GHS)", type: "number", step: "0.01", defaultValue: String(plan.priceMonthlyMinor / 100) },
                { name: "priceYearly", label: "Yearly price (GHS)", type: "number", step: "0.01", defaultValue: String(plan.priceYearlyMinor / 100) },
                { name: "aiMessagesPerMonth", label: "AI replies / month", type: "number", defaultValue: limit(plan.limits, "aiMessagesPerMonth") },
                { name: "workflowExecutionsPerMonth", label: "Automation runs / month", type: "number", defaultValue: limit(plan.limits, "workflowExecutionsPerMonth") },
                { name: "channels", label: "Channels", type: "number", defaultValue: limit(plan.limits, "channels") },
                { name: "staffSeats", label: "Team seats", type: "number", defaultValue: limit(plan.limits, "staffSeats") },
                { name: "knowledgeStorageMb", label: "Knowledge storage (MB)", type: "number", defaultValue: limit(plan.limits, "knowledgeStorageMb") },
                { name: "trialDays", label: "Trial days", type: "number", defaultValue: String(plan.trialDays) },
                { name: "description", label: "Description", type: "textarea", defaultValue: plan.description ?? "" },
                { name: "features", label: "Features (one per line)", type: "textarea", defaultValue: plan.features.join("\n") },
                { name: "isActive", label: "Available", type: "checkbox", defaultValue: plan.isActive ? "on" : "" },
                { name: "isPublic", label: "Shown on pricing page", type: "checkbox", defaultValue: plan.isPublic ? "on" : "" },
              ]}
            />
          </section>
        ))}
      </div>
    </>
  );
}
