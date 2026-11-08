import type { Metadata } from "next";
import { Camera, FlaskConical, MessageCircle } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/app/page-primitives";
import { InstagramConnectButton, IntegrationActions, SandboxConnectButton, WhatsAppConnectForm } from "@/components/integrations/integration-forms";
import { Badge } from "@/components/ui/badge";
import { env, outboundMessagingMode, providerStatus } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { listIntegrations } from "@/modules/integrations/integration.service";

export const metadata: Metadata = { title: "Integrations" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONNECTED: "default",
  PENDING: "secondary",
  ERROR: "destructive",
  EXPIRED: "destructive",
  DISCONNECTED: "outline",
};

export default async function IntegrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  if (!context.can("integrations.read")) return <AccessDenied what="integrations" />;
  const params = await searchParams;
  const integrations = await listIntegrations(context.businessId);
  const providers = providerStatus();
  const canManage = context.can("integrations.manage");
  const mode = outboundMessagingMode();
  const webhookUrl = `${env().APP_URL}/api/webhooks/meta`;
  const instagramNotice = typeof params.instagram === "string" ? params.instagram : null;

  return (
    <>
      <PageHeader title="Integrations" description="Connect your official WhatsApp Business and Instagram professional accounts. SUNLEON AI uses Meta's official APIs only." />
      {mode === "sandbox" ? (
        <p className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          This deployment is in <strong>sandbox mode</strong>: outbound messages are recorded but not delivered to customers.
        </p>
      ) : null}
      {instagramNotice ? (
        <p role="status" className="mb-6 rounded-xl border bg-card px-4 py-3 text-sm">
          Instagram: {instagramNotice === "connected" ? "account connected." : instagramNotice === "cancelled" ? "connection cancelled." : "connection failed. Check the account is a professional account and try again."}
        </p>
      ) : null}

      {integrations.length ? (
        <section className="mb-8 grid gap-3">
          {integrations.map((integration) => (
            <div key={integration.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-semibold">
                  {integration.channel === "SANDBOX" ? "Test channel" : integration.channel === "WHATSAPP" ? "WhatsApp" : "Instagram"} · {integration.displayHandle ?? integration.externalAccountName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {integration.lastHealthCheckAt ? `Checked ${formatRelative(integration.lastHealthCheckAt)}` : "Not checked yet"}
                  {integration.tokenExpiresAt ? ` · token expires ${formatRelative(integration.tokenExpiresAt)}` : ""}
                </p>
                {integration.lastError ? <p className="mt-1 text-xs text-destructive">{integration.lastError}</p> : null}
              </div>
              <Badge variant={STATUS_VARIANT[integration.status]}>{integration.status.toLowerCase()}</Badge>
              {canManage && integration.status !== "DISCONNECTED" ? <IntegrationActions id={integration.id} /> : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="size-4 text-[#128C7E]" aria-hidden="true" /> WhatsApp Business Platform
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Uses the WhatsApp Cloud API. You need a Meta Business account, a WhatsApp Business Account and a registered phone number.
          </p>
          {!providers.meta ? (
            <p className="text-sm text-warning">The platform&apos;s Meta app credentials are not configured yet, so incoming messages cannot be received.</p>
          ) : canManage && context.user.emailVerifiedAt ? (
            <WhatsAppConnectForm />
          ) : (
            <p className="text-sm text-muted-foreground">An owner or admin with a verified email can connect WhatsApp.</p>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Camera className="size-4 text-[#E1306C]" aria-hidden="true" /> Instagram messaging
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Requires an Instagram professional (business or creator) account. You&apos;ll sign in with Instagram and approve message access.
          </p>
          {providers.instagram ? (
            canManage ? <InstagramConnectButton disabled={!context.user.emailVerifiedAt} /> : null
          ) : (
            <p className="text-sm text-warning">Instagram Login is not configured on this platform yet.</p>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FlaskConical className="size-4 text-primary" aria-hidden="true" /> Test channel
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            A private channel for trying the full flow — customer message, AI reply, takeover — without Meta. Messages never leave SUNLEON AI.
          </p>
          {canManage ? <SandboxConnectButton /> : null}
          <p className="mt-6 text-xs text-muted-foreground">
            Webhook callback URL for your Meta app: <code className="rounded bg-muted px-1.5 py-0.5">{webhookUrl}</code>
          </p>
        </section>
      </div>
    </>
  );
}
