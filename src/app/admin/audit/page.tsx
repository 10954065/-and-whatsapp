import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { PageHeader, PanelEmpty } from "@/components/app/page-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { cn } from "@/lib/utils";
import { listAuditLog } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type AuditEntry = Awaited<ReturnType<typeof listAuditLog>>["rows"][number];

const TZ = "Africa/Accra";

const text = (value: string | string[] | undefined, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const actorLabel = (entry: AuditEntry) => entry.actorType.charAt(0) + entry.actorType.slice(1).toLowerCase();

function BusinessLink({ entry }: { entry: AuditEntry }) {
  return entry.businessId ? (
    <Link href={`/admin/businesses/${entry.businessId}`} className="text-foreground hover:underline">
      {entry.business?.name ?? entry.businessId}
    </Link>
  ) : (
    <span>Platform</span>
  );
}

/** Two lines of the recorded details; the full JSON is in the tooltip. */
function Details({ entry, className }: { entry: AuditEntry; className?: string }) {
  if (!entry.metadata) return <span className={cn("text-xs text-muted-foreground", className)}>None</span>;
  const json = JSON.stringify(entry.metadata);
  return (
    <p className={cn("line-clamp-2 font-mono text-[11px] break-all text-muted-foreground", className)} title={json}>
      {json}
    </p>
  );
}

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await requireAdminConsole())) return null;
  const params = await searchParams;
  const action = text(params.action, 80);
  const businessId = text(params.businessId, 40);
  const page = Number(params.page) > 0 ? Math.floor(Number(params.page)) : 1;
  const log = await listAuditLog({ action: action || undefined, businessId: businessId || undefined, page });
  const pageHref = (target: number) => `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...(businessId ? { businessId } : {}), page: String(target) })}`;

  return (
    <>
      <PageHeader eyebrow="Platform" title="Audit log" description="Every security-relevant and administrative change, newest first. Sensitive values are redacted when recorded." />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <Input name="action" defaultValue={action} placeholder="Action prefix, e.g. admin. or billing." aria-label="Action prefix" className="sm:w-72" />
        <Input name="businessId" defaultValue={businessId} placeholder="Business id" aria-label="Business id" className="sm:w-56" />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <section className="surface overflow-hidden rounded-[1.25rem]" aria-label="Audit entries">
        {log.rows.length === 0 ? (
          <PanelEmpty icon={ScrollText}>No entries match.</PanelEmpty>
        ) : (
          <>
            <table className="hidden w-full table-fixed text-sm md:table">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-40 px-5 py-2.5 font-medium">When</th>
                  <th className="w-56 px-4 py-2.5 font-medium">Action</th>
                  <th className="w-32 px-4 py-2.5 font-medium">Actor</th>
                  <th className="w-44 px-4 py-2.5 font-medium">Business</th>
                  <th className="px-5 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {log.rows.map((entry) => (
                  <tr key={entry.id} className="border-b align-top last:border-0">
                    <td className="px-5 py-3 text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(entry.createdAt, TZ)}</td>
                    <td className="truncate px-4 py-3 font-mono text-xs" title={entry.action}>
                      {entry.action}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {actorLabel(entry)}
                      {entry.ipAddress ? <span className="block truncate text-muted-foreground">{entry.ipAddress}</span> : null}
                    </td>
                    <td className="truncate px-4 py-3 text-xs">
                      <BusinessLink entry={entry} />
                    </td>
                    <td className="px-5 py-3">
                      <Details entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="md:hidden">
              {log.rows.map((entry) => (
                <li key={entry.id} className="min-w-0 border-b px-4 py-3.5 last:border-0">
                  <p className="truncate font-mono text-xs font-medium">{entry.action}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt, TZ)} · {actorLabel(entry)} · <BusinessLink entry={entry} />
                  </p>
                  {entry.metadata ? <Details entry={entry} className="mt-1" /> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
        {log.page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={pageHref(log.page - 1)}>
              <ChevronLeft /> Newer
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">Page {log.page}</span>
        {log.hasMore ? (
          <Button asChild variant="outline" size="sm">
            <Link href={pageHref(log.page + 1)}>
              Older <ChevronRight />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
