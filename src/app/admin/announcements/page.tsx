import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-primitives";
import { ActionButton, QuickForm } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { createAnnouncementAction, setAnnouncementActiveAction } from "@/modules/administration/admin.actions";
import { listAnnouncements } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Announcements" };

const LEVEL_VARIANT = { INFO: "secondary", WARNING: "outline", CRITICAL: "destructive" } as const;

export default async function AdminAnnouncementsPage() {
  if (!(await requireAdminConsole())) return null;
  const announcements = await listAnnouncements();
  const now = new Date();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Announcements" description="Shown as a banner to every workspace while active (up to three at a time)." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="surface rounded-[1.25rem] p-6">
          <h2 className="mb-4 font-semibold">New announcement</h2>
          <QuickForm
            action={createAnnouncementAction}
            submitLabel="Publish"
            fields={[
              { name: "title", label: "Title", placeholder: "Scheduled maintenance on Sunday" },
              { name: "body", label: "Message", type: "textarea" },
              {
                name: "level",
                label: "Level",
                type: "select",
                options: [
                  { value: "INFO", label: "Info" },
                  { value: "WARNING", label: "Warning" },
                  { value: "CRITICAL", label: "Critical" },
                ],
              },
              { name: "endsAt", label: "Hide after (GMT, optional)", type: "datetime-local" },
            ]}
          />
        </section>
        <section className="surface rounded-[1.25rem] p-6">
          <h2 className="mb-3 font-semibold">All announcements</h2>
          {announcements.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : null}
          <ul className="divide-y">
            {announcements.map((announcement) => {
              const expired = announcement.endsAt !== null && announcement.endsAt <= now;
              return (
                <li key={announcement.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-medium">
                      {announcement.title} <Badge variant={LEVEL_VARIANT[announcement.level]}>{announcement.level.toLowerCase()}</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">{announcement.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {announcement.isActive ? (expired ? "Expired" : "Showing") : "Hidden"}
                      {announcement.endsAt ? ` · until ${formatDateTime(announcement.endsAt, "Africa/Accra")}` : ""}
                    </p>
                  </div>
                  <ActionButton
                    action={setAnnouncementActiveAction}
                    values={{ announcementId: announcement.id, isActive: announcement.isActive ? "false" : "true" }}
                    label={announcement.isActive ? "Hide" : "Show"}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
