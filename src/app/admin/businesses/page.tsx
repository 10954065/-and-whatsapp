import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { BUSINESS_STATUS, SUBSCRIPTION_STATUS } from "@/components/admin/admin-status";
import { PageHeader, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { industryLabel } from "@/config/industries";
import { formatDate, formatNumber } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { listBusinesses } from "@/modules/administration/admin.service";

export const metadata: Metadata = { title: "Businesses" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type BusinessRow = Awaited<ReturnType<typeof listBusinesses>>["rows"][number];

const STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
const TZ = "Africa/Accra";

function planLabel(business: BusinessRow): string {
  return business.subscription ? `${business.subscription.plan.name} · ${SUBSCRIPTION_STATUS[business.subscription.status].label.toLowerCase()}` : "No plan";
}

function BusinessesTable({ rows }: { rows: BusinessRow[] }) {
  return (
    <table className="hidden w-full text-sm md:table">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="px-5 py-2.5 font-medium">Business</th>
          <th className="px-4 py-2.5 font-medium">Industry</th>
          <th className="px-4 py-2.5 font-medium">Plan</th>
          <th className="px-4 py-2.5 text-right font-medium">Members</th>
          <th className="px-4 py-2.5 font-medium">Status</th>
          <th className="px-5 py-2.5 text-right font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((business) => (
          <tr key={business.id} className="border-b transition-colors last:border-0 hover:bg-foreground/3">
            <td className="max-w-64 px-5 py-3">
              <Link href={`/admin/businesses/${business.id}`} className="block truncate font-medium text-foreground hover:underline">
                {business.name}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">{business.slug}</span>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{industryLabel(business.industry)}</td>
            <td className="px-4 py-3">{planLabel(business)}</td>
            <td className="px-4 py-3 text-right">{formatNumber(business._count.memberships)}</td>
            <td className="px-4 py-3">
              <StatusLabel {...BUSINESS_STATUS[business.status]} />
            </td>
            <td className="px-5 py-3 text-right whitespace-nowrap text-muted-foreground">{formatDate(business.createdAt, TZ)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Phones: one readable row per business instead of a squeezed table. */
function BusinessesList({ rows }: { rows: BusinessRow[] }) {
  return (
    <ul className="md:hidden">
      {rows.map((business) => (
        <li key={business.id} className="border-b last:border-0">
          <Link href={`/admin/businesses/${business.id}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors active:bg-foreground/3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{business.name}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {planLabel(business)} · {formatNumber(business._count.memberships)} {business._count.memberships === 1 ? "member" : "members"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {industryLabel(business.industry)} · {formatDate(business.createdAt, TZ)}
              </span>
            </span>
            <StatusLabel {...BUSINESS_STATUS[business.status]} className="mt-0.5 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
      <PageHeader eyebrow="Platform" title="Businesses" description={`${formatNumber(result.total)} workspaces${query || status ? " match your search" : ""}`} />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={query} placeholder="Name, slug or email" aria-label="Search businesses" className="pl-9" />
        </div>
        <div className="flex gap-2">
          <select name="status" defaultValue={status ?? ""} aria-label="Status" className="h-9 flex-1 rounded-xl border border-input bg-card px-3 text-sm sm:flex-none">
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {BUSINESS_STATUS[value].label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </div>
      </form>

      <section className="surface overflow-hidden rounded-[1.25rem]" aria-label="Businesses">
        {result.rows.length === 0 ? (
          <PanelEmpty icon={Building2}>{query || status ? "No businesses match. Try another name, slug or status." : "No businesses yet."}</PanelEmpty>
        ) : (
          <>
            <BusinessesTable rows={result.rows} />
            <BusinessesList rows={result.rows} />
          </>
        )}
      </section>

      {result.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
          {result.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(result.page - 1)}>
                <ChevronLeft /> Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(result.page + 1)}>
                Next <ChevronRight />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
