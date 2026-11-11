import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHeader, PanelEmpty } from "@/components/app/page-primitives";
import { StatusSelect } from "@/components/operations/operations-forms";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { cn } from "@/lib/utils";
import { setInquiryStatusAction } from "@/modules/administration/admin.actions";
import { INQUIRY_STATUSES, listInquiries } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Inquiries" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_LABELS: Record<string, string> = { NEW: "New", IN_PROGRESS: "In progress", CLOSED: "Closed" };
const FILTERS = [{ value: undefined, label: "All" }, ...INQUIRY_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))];

export default async function AdminInquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await requireAdminConsole())) return null;
  const params = await searchParams;
  const status = INQUIRY_STATUSES.find((value) => value === params.status);
  const inquiries = await listInquiries(status);

  return (
    <>
      <PageHeader eyebrow="Platform" title="Contact inquiries" description="Messages sent from the public contact page. Reply by email from your own mailbox." />
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const isActive = filter.value === status;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `/admin/inquiries?status=${filter.value}` : "/admin/inquiries"}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <section className="surface overflow-hidden rounded-[1.25rem]" aria-label="Inquiries">
        {inquiries.length === 0 ? (
          <PanelEmpty icon={Inbox}>{status ? "No inquiries with this status." : "No inquiries yet. Messages from the contact page show here."}</PanelEmpty>
        ) : (
          <ul>
            {inquiries.map((inquiry) => (
              <li key={inquiry.id} className="min-w-0 border-t px-5 py-4 first:border-t-0">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="truncate text-sm font-medium">
                      {inquiry.name}
                      {inquiry.company ? <span className="font-normal text-muted-foreground"> · {inquiry.company}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs wrap-break-word text-muted-foreground">
                      <a href={`mailto:${inquiry.email}`} className="text-foreground hover:underline">
                        {inquiry.email}
                      </a>
                      {inquiry.phone ? ` · ${inquiry.phone}` : ""} · {formatDateTime(inquiry.createdAt, "Africa/Accra")}
                    </p>
                  </div>
                  <StatusSelect
                    action={setInquiryStatusAction}
                    values={{ inquiryId: inquiry.id }}
                    name="status"
                    current={inquiry.status}
                    options={[...INQUIRY_STATUSES]}
                    labels={STATUS_LABELS}
                    ariaLabel={`Status of inquiry from ${inquiry.name}`}
                  />
                </div>
                <p className="mt-3 rounded-xl bg-foreground/4 p-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">{inquiry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
