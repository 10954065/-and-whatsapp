import type { Metadata } from "next";
import { PageHeader, Panel, StatusLabel } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { providerStatus } from "@/lib/env";
import { requireAdminConsole } from "@/lib/auth/current";
import { setAiEnabledAction } from "@/modules/administration/admin.actions";
import { aiProviderLabel } from "@/modules/ai/llm";
import { isAiGloballyEnabled } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Settings" };

const PROVIDERS: { key: keyof ReturnType<typeof providerStatus>; label: string; purpose?: string }[] = [
  { key: "ai", label: "AI replies" },
  { key: "voyage", label: "Voyage", purpose: "Semantic knowledge search" },
  { key: "meta", label: "Meta", purpose: "App and webhooks" },
  { key: "instagram", label: "Instagram Login" },
  { key: "paystack", label: "Paystack", purpose: "Subscription payments" },
  { key: "resend", label: "Resend", purpose: "Email" },
  { key: "objectStorage", label: "Object storage", purpose: "Uploads" },
  { key: "qstash", label: "QStash", purpose: "Background job wake-ups" },
];

export default async function AdminSettingsPage() {
  if (!(await requireAdminConsole())) return null;
  const aiEnabled = await isAiGloballyEnabled();
  const providers = providerStatus();
  const configured = PROVIDERS.filter((provider) => providers[provider.key]).length;

  return (
    <>
      <PageHeader eyebrow="Platform" title="Settings" description="Platform-wide switches, and which providers this deployment can reach." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="AI kill switch" className="h-auto lg:self-start" aside={<StatusLabel dot={aiEnabled ? "bg-success" : "bg-destructive"} label={aiEnabled ? "AI on" : "AI off for everyone"} />}>
          <div className="grid gap-4 px-5 pb-5">
            <p className="text-sm text-muted-foreground">
              Turning AI off stops every AI reply on the platform immediately; new customer messages wait in each business&apos;s inbox for their team. Use it for incidents or provider problems.
            </p>
            <QuickForm
              action={setAiEnabledAction}
              variant={aiEnabled ? "destructive" : "default"}
              submitLabel={aiEnabled ? "Turn AI off everywhere" : "Turn AI back on"}
              hidden={{ enabled: aiEnabled ? "false" : "true" }}
              fields={[{ name: "reason", label: "Reason", placeholder: aiEnabled ? "Provider outage reported at 14:05" : "Provider recovered" }]}
            />
          </div>
        </Panel>

        <Panel title="Providers" aside={<span className="text-[12px] text-muted-foreground">{`${configured} of ${PROVIDERS.length} configured`}</span>}>
          <p className="px-5 pb-3 text-sm text-muted-foreground">Whether each provider&apos;s credentials are present in this deployment. Values are never shown.</p>
          <ul className="border-t pb-1">
            {PROVIDERS.map((provider) => {
              const isConfigured = providers[provider.key];
              const detail = provider.key === "ai" ? aiProviderLabel() : provider.purpose;
              return (
                <li key={provider.key} className="flex min-w-0 items-center gap-3 border-t px-5 py-3 first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{provider.label}</span>
                    {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
                  </span>
                  <StatusLabel dot={isConfigured ? "bg-success" : "bg-foreground/30"} label={isConfigured ? "Configured" : "Not configured"} className="shrink-0" />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
