import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { listAuditLog } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const text = (value: string | string[] | undefined, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

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
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <Input name="action" defaultValue={action} placeholder="Action prefix, e.g. admin. or billing." aria-label="Action prefix" className="max-w-xs" />
        <Input name="businessId" defaultValue={businessId} placeholder="Business id" aria-label="Business id" className="max-w-xs" />
        <Button type="submit" size="sm" variant="outline">
          Filter
        </Button>
      </form>
      <div className="overflow-x-auto surface rounded-[1.25rem]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Business</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {log.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No entries match.
                </td>
              </tr>
            ) : null}
            {log.rows.map((entry) => (
              <tr key={entry.id} className="border-b align-top last:border-0">
                <td className="px-4 py-2 text-xs whitespace-nowrap">{formatDateTime(entry.createdAt, "Africa/Accra")}</td>
                <td className="px-4 py-2 font-mono text-xs">{entry.action}</td>
                <td className="px-4 py-2 text-xs">
                  {entry.actorType.toLowerCase()}
                  {entry.ipAddress ? <span className="block text-muted-foreground">{entry.ipAddress}</span> : null}
                </td>
                <td className="px-4 py-2 text-xs">
                  {entry.businessId ? (
                    <Link href={`/admin/businesses/${entry.businessId}`} className="link-underline text-foreground">
                      {entry.business?.name ?? entry.businessId}
                    </Link>
                  ) : (
                    "platform"
                  )}
                </td>
                <td className="max-w-md px-4 py-2 font-mono text-[11px] break-all text-muted-foreground">{entry.metadata ? JSON.stringify(entry.metadata) : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
        {log.page > 1 ? <Link href={pageHref(log.page - 1)}>← Newer</Link> : null}
        <span className="text-muted-foreground">Page {log.page}</span>
        {log.hasMore ? <Link href={pageHref(log.page + 1)}>Older →</Link> : null}
      </nav>
    </>
  );
}
