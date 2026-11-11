import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { PageHeader, Panel, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { formatMoney, formatNumber } from "@/lib/format";
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
        description="Prices are in cedis and apply to new payments; current periods keep what was paid. Plans are never deleted. Take one off sale to stop selling it."
      />
      {plans.length === 0 ? (
        <section className="surface rounded-[1.25rem]">
          <PanelEmpty icon={Layers}>No plans yet. Run the database seed to create the starting plans.</PanelEmpty>
        </section>
      ) : (
        <div className="grid gap-6">
          {plans.map((plan) => (
            <Panel
              key={plan.id}
              title={plan.name}
              aside={
                <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                  <StatusLabel dot={plan.isActive ? "bg-success" : "bg-foreground/30"} label={plan.isActive ? "On sale" : "Not on sale"} />
                  <StatusLabel dot={plan.isPublic ? "bg-success" : "bg-foreground/30"} label={plan.isPublic ? "On pricing page" : "Hidden from pricing"} />
                </span>
              }
            >
              <p className="px-5 pb-4 text-xs text-muted-foreground">
                <span className="font-mono">{plan.code}</span> · {formatMoney(plan.priceMonthlyMinor, plan.currency)} a month · {formatMoney(plan.priceYearlyMinor, plan.currency)} a year ·{" "}
                {formatNumber(plan._count.subscriptions)} {plan._count.subscriptions === 1 ? "subscription" : "subscriptions"}
              </p>
              <div className="border-t px-5 py-5">
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
                    { name: "features", label: "Features (one per line)", type: "textarea", defaultValue: plan.features.join("\n"), span: 2 },
                    { name: "isActive", label: "On sale", type: "checkbox", defaultValue: plan.isActive ? "on" : "" },
                    { name: "isPublic", label: "Shown on pricing page", type: "checkbox", defaultValue: plan.isPublic ? "on" : "" },
                  ]}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
