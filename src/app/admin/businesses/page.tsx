import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { industryLabel } from "@/config/industries";
import { formatDate, formatNumber } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { listBusinesses } from "@/modules/administration/admin.service";

export const metadata: Metadata = { title: "Businesses" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;

export default async function AdminBusinessesPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await requireAdminConsole())) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const status = STATUSES.find((value) => value === params.status);
  const page = Number(params.page) > 0 ? Math.floor(Number(params.page)) : 1;
  const result = await listBusinesses({ query, status, page });
  const pageHref = (target: number) => `/admin/businesses?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}), page: String(target) })}`;

  return (
    <>
      <PageHeader eyebrow="Platform" title="Businesses" description={`${formatNumber(result.total)} workspaces`} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <Input name="q" defaultValue={query} placeholder="Name, slug or email" aria-label="Search businesses" className="max-w-xs" />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="h-8 rounded-lg border bg-transparent px-2.5 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Business</th>
              <th className="px-4 py-2 font-medium">Industry</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Members</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No businesses match.
                </td>
              </tr>
            ) : null}
            {result.rows.map((business) => (
              <tr key={business.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/businesses/${business.id}`} className="font-medium text-foreground link-underline">
                    {business.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{business.slug}</span>
                </td>
                <td className="px-4 py-2">{industryLabel(business.industry)}</td>
                <td className="px-4 py-2">{business.subscription ? `${business.subscription.plan.name} · ${business.subscription.status.toLowerCase()}` : "No plan"}</td>
                <td className="px-4 py-2 tabular-nums">{business._count.memberships}</td>
                <td className="px-4 py-2">
                  <Badge variant={business.status === "ACTIVE" ? "secondary" : "destructive"}>{business.status.toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-2">{formatDate(business.createdAt, "Africa/Accra")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
          {result.page > 1 ? <Link href={pageHref(result.page - 1)}>← Previous</Link> : null}
          <span className="text-muted-foreground">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages ? <Link href={pageHref(result.page + 1)}>Next →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
