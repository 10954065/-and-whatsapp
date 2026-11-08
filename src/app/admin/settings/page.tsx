import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { providerStatus } from "@/lib/env";
import { requireAdminConsole } from "@/lib/auth/current";
import { setAiEnabledAction } from "@/modules/administration/admin.actions";
import { isAiGloballyEnabled } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Settings" };

const PROVIDERS: { key: keyof ReturnType<typeof providerStatus>; label: string }[] = [
  { key: "anthropic", label: "Anthropic (AI replies)" },
  { key: "voyage", label: "Voyage (semantic knowledge search)" },
  { key: "meta", label: "Meta app & webhooks" },
  { key: "instagram", label: "Instagram Login" },
  { key: "paystack", label: "Paystack (subscription payments)" },
  { key: "resend", label: "Resend (email)" },
  { key: "objectStorage", label: "Object storage (uploads)" },
  { key: "qstash", label: "QStash (background job wake-ups)" },
];

export default async function AdminSettingsPage() {
  if (!(await requireAdminConsole())) return null;
  const aiEnabled = await isAiGloballyEnabled();
  const providers = providerStatus();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            AI kill switch <Badge variant={aiEnabled ? "secondary" : "destructive"}>{aiEnabled ? "AI on" : "AI off for everyone"}</Badge>
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Turning AI off stops every AI reply on the platform immediately; new customer messages wait in each business&apos;s inbox for their team. Use it for incidents or provider problems.
          </p>
          <QuickForm
            action={setAiEnabledAction}
            submitLabel={aiEnabled ? "Turn AI off everywhere" : "Turn AI back on"}
            hidden={{ enabled: aiEnabled ? "false" : "true" }}
            fields={[{ name: "reason", label: "Reason", placeholder: aiEnabled ? "Provider outage reported at 14:05" : "Provider recovered" }]}
          />
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="mb-1 font-semibold">Provider configuration</h2>
          <p className="mb-4 text-sm text-muted-foreground">Whether each provider&apos;s credentials are present in this deployment. Values are never shown.</p>
          <ul className="grid gap-2 text-sm">
            {PROVIDERS.map((provider) => (
              <li key={provider.key} className="flex items-center justify-between gap-3">
                <span>{provider.label}</span>
                <Badge variant={providers[provider.key] ? "secondary" : "outline"}>{providers[provider.key] ? "configured" : "not configured"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
