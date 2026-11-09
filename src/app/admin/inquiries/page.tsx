import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-primitives";
import { StatusSelect } from "@/components/operations/operations-forms";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { setInquiryStatusAction } from "@/modules/administration/admin.actions";
import { INQUIRY_STATUSES, listInquiries } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Inquiries" };

const STATUS_LABELS: Record<string, string> = { NEW: "New", IN_PROGRESS: "In progress", CLOSED: "Closed" };

export default async function AdminInquiriesPage() {
  if (!(await requireAdminConsole())) return null;
  const inquiries = await listInquiries();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Contact inquiries" description="Messages sent from the public contact page. Reply by email from your own mailbox." />
      {inquiries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inquiries yet.</p>
      ) : (
        <ul className="grid gap-3">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className="surface rounded-[1.25rem] p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1">
                  <p className="font-medium">
                    {inquiry.name}
                    {inquiry.company ? <span className="text-muted-foreground"> · {inquiry.company}</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inquiry.email}
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
              <p className="mt-3 text-sm whitespace-pre-wrap">{inquiry.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
