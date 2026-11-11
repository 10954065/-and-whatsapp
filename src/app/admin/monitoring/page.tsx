import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle, Cog, MailX, Webhook } from "lucide-react";
import { Metric, MetricStrip, PageHeader, Panel, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { ActionButton } from "@/components/operations/operations-forms";
import { formatDateTime, formatNumber } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { cn } from "@/lib/utils";
import { retryJobAction } from "@/modules/administration/admin.actions";
import { getMonitoringSnapshot } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Monitoring" };

const TZ = "Africa/Accra";

const capitalise = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** Amber count while something needs a look, green when clear. */
function Count({ value }: { value: number }) {
  return <StatusLabel dot={value ? "bg-warning" : "bg-success"} label={value ? formatNumber(value) : "None"} />;
}

/** One problem: what and when on top, the detail wrapped below, so long messages never widen the page. */
function IssueRow({ title, status, when, detail, action }: { title: string; status?: ReactNode; when: Date; detail?: string | null; action?: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-3 border-t px-5 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 truncate font-mono text-xs font-medium">{title}</span>
          {status}
          <span className="text-xs text-muted-foreground">{formatDateTime(when, TZ)}</span>
        </div>
        {detail ? (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed wrap-break-word text-muted-foreground" title={detail}>
            {detail}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </li>
  );
}

const VISIBLE = 8;

/** The newest few items, with the rest one tap away so long lists don't bury the page. */
function IssueList({ children, className }: { children: ReactNode[]; className?: string }) {
  const rest = children.slice(VISIBLE);
  return (
    <ul className={cn("pb-1", className)}>
      {children.slice(0, VISIBLE)}
      {rest.length ? (
        <li className="border-t">
          <details className="group">
            <summary className="cursor-pointer list-none px-5 py-3 text-center text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show {rest.length} more</span>
              <span className="hidden group-open:inline">Show fewer</span>
            </summary>
            <ul className="border-t">{rest}</ul>
          </details>
        </li>
      ) : null}
    </ul>
  );
}

export default async function AdminMonitoringPage() {
  if (!(await requireAdminConsole())) return null;
  const snapshot = await getMonitoringSnapshot();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Monitoring" description="Failed background jobs, webhook problems, recent errors and email failures. Message contents and payloads are never shown here." />

      <MetricStrip label="Problems at a glance">
        <Metric label="Failed jobs" value={formatNumber(snapshot.jobs.length)} hint="Failed or dead" icon={Cog} href="#jobs" />
        <Metric label="Webhook problems" value={formatNumber(snapshot.webhooks.length)} hint="Failed or flagged" icon={Webhook} href="#webhooks" />
        <Metric label="Recent errors" value={formatNumber(snapshot.errors.length)} hint="Newest first" icon={AlertTriangle} href="#errors" />
        <Metric label="Email failures" value={formatNumber(snapshot.emails.length)} hint="Not delivered" icon={MailX} href="#emails" />
      </MetricStrip>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section id="jobs" className="scroll-mt-28">
          <Panel title="Failed and dead jobs" aside={<Count value={snapshot.jobs.length} />}>
            {snapshot.jobs.length === 0 ? (
              <PanelEmpty icon={Cog}>No failed jobs. Background work is running normally.</PanelEmpty>
            ) : (
              <IssueList>
                {snapshot.jobs.map((job) => (
                  <IssueRow
                    key={job.id}
                    title={job.type}
                    status={<StatusLabel dot="bg-destructive" label={`${capitalise(job.status)} · ${job.attempts}/${job.maxAttempts} tries`} />}
                    when={job.updatedAt}
                    detail={job.lastError}
                    action={<ActionButton action={retryJobAction} values={{ jobId: job.id }} label="Retry" />}
                  />
                ))}
              </IssueList>
            )}
          </Panel>
        </section>

        <section id="webhooks" className="scroll-mt-28">
          <Panel title="Webhook problems" aside={<Count value={snapshot.webhooks.length} />}>
            {snapshot.webhooks.length === 0 ? (
              <PanelEmpty icon={Webhook}>No failed or flagged webhooks.</PanelEmpty>
            ) : (
              <IssueList>
                {snapshot.webhooks.map((event) => (
                  <IssueRow
                    key={event.id}
                    title={`${capitalise(event.provider)} · ${event.eventType ?? "unknown event"}`}
                    status={<StatusLabel dot={event.status === "FAILED" ? "bg-destructive" : "bg-warning"} label={capitalise(event.status)} />}
                    when={event.receivedAt}
                    detail={event.error}
                  />
                ))}
              </IssueList>
            )}
          </Panel>
        </section>
      </div>

      <section id="errors" className="mt-6 scroll-mt-28">
        <Panel title="Recent errors" aside={<Count value={snapshot.errors.length} />}>
          {snapshot.errorGroups.length ? (
            <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3">
              <span className="text-xs text-muted-foreground">Last 24 hours:</span>
              {snapshot.errorGroups.map((group) => (
                <span key={group.source} className="rounded-full bg-foreground/5 px-2 py-0.5 font-mono text-[11px]">
                  {group.source} · {formatNumber(group.count)}
                </span>
              ))}
            </div>
          ) : null}
          {snapshot.errors.length === 0 ? (
            <PanelEmpty icon={AlertTriangle}>No errors recorded.</PanelEmpty>
          ) : (
            <IssueList className="border-t">
              {snapshot.errors.map((error) => (
                <IssueRow key={error.id} title={error.source} when={error.createdAt} detail={error.message} />
              ))}
            </IssueList>
          )}
        </Panel>
      </section>

      <section id="emails" className="mt-6 scroll-mt-28">
        <Panel title="Email failures" aside={<Count value={snapshot.emails.length} />}>
          {snapshot.emails.length === 0 ? (
            <PanelEmpty icon={MailX}>No failed emails.</PanelEmpty>
          ) : (
            <IssueList>
              {snapshot.emails.map((email) => (
                <IssueRow key={email.id} title={`${email.template} to ${email.to}`} when={email.createdAt} detail={email.error} />
              ))}
            </IssueList>
          )}
        </Panel>
      </section>
    </>
  );
}
