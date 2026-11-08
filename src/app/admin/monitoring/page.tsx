import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-primitives";
import { ActionButton } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { retryJobAction } from "@/modules/administration/admin.actions";
import { getMonitoringSnapshot } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Monitoring" };

const TZ = "Africa/Accra";

function Panel({ title, empty, children, count }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {title} <Badge variant={count ? "destructive" : "secondary"}>{count}</Badge>
      </h2>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}

export default async function AdminMonitoringPage() {
  if (!(await requireAdminConsole())) return null;
  const snapshot = await getMonitoringSnapshot();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Monitoring" description="Failed background jobs, webhook problems, recent errors and email failures. Message contents and payloads are never shown here." />
      <div className="grid gap-6">
        <Panel title="Failed and dead jobs" count={snapshot.jobs.length} empty="No failed jobs.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.jobs.map((job) => (
                <tr key={job.id} className="border-t first:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{job.type}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{job.status.toLowerCase()}</Badge> {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{job.lastError ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">{formatDateTime(job.updatedAt, TZ)}</td>
                  <td className="py-2 text-right">
                    <ActionButton action={retryJobAction} values={{ jobId: job.id }} label="Retry" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Webhook problems" count={snapshot.webhooks.length} empty="No failed or flagged webhooks.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.webhooks.map((event) => (
                <tr key={event.id} className="border-t first:border-0">
                  <td className="py-2 pr-3">{event.provider.toLowerCase()}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{event.eventType ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{event.status.toLowerCase()}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{event.error ?? "—"}</td>
                  <td className="py-2 text-xs whitespace-nowrap">{formatDateTime(event.receivedAt, TZ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Recent errors" count={snapshot.errors.length} empty="No errors recorded.">
          {snapshot.errorGroups.length ? (
            <p className="mb-3 text-xs text-muted-foreground">Last 24 hours: {snapshot.errorGroups.map((group) => `${group.source} (${group.count})`).join(", ")}</p>
          ) : null}
          <table className="w-full text-sm">
            <tbody>
              {snapshot.errors.map((error) => (
                <tr key={error.id} className="border-t first:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{error.source}</td>
                  <td className="py-2 pr-3 text-xs">{error.message}</td>
                  <td className="py-2 text-xs whitespace-nowrap">{formatDateTime(error.createdAt, TZ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Email failures" count={snapshot.emails.length} empty="No failed emails.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.emails.map((email) => (
                <tr key={email.id} className="border-t first:border-0">
                  <td className="py-2 pr-3">{email.template}</td>
                  <td className="py-2 pr-3 text-xs">{email.to}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{email.error ?? "—"}</td>
                  <td className="py-2 text-xs whitespace-nowrap">{formatDateTime(email.createdAt, TZ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
