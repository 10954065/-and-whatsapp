import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PageHeader, Panel, PanelEmpty, StatusLabel } from "@/components/app/page-primitives";
import { ActionButton, QuickForm } from "@/components/operations/operations-forms";
import { formatDateTime } from "@/lib/format";
import { requireAdminConsole } from "@/lib/auth/current";
import { createAnnouncementAction, setAnnouncementActiveAction } from "@/modules/administration/admin.actions";
import { listAnnouncements } from "@/modules/administration/monitoring.service";

export const metadata: Metadata = { title: "Announcements" };

const TZ = "Africa/Accra";

const LEVEL = {
  INFO: { dot: "bg-info", label: "Info" },
  WARNING: { dot: "bg-warning", label: "Warning" },
  CRITICAL: { dot: "bg-destructive", label: "Critical" },
} as const;

export default async function AdminAnnouncementsPage() {
  if (!(await requireAdminConsole())) return null;
  const announcements = await listAnnouncements();
  const now = new Date();
  const isShowing = (announcement: (typeof announcements)[number]) => announcement.isActive && (announcement.endsAt === null || announcement.endsAt > now);
  const showing = announcements.filter(isShowing).length;

  return (
    <>
      <PageHeader eyebrow="Platform" title="Announcements" description="Shown as a banner to every workspace while active (up to three at a time)." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="New announcement" className="h-auto lg:self-start">
          <div className="px-5 pb-5">
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
          </div>
        </Panel>

        <Panel title="All announcements" aside={announcements.length ? <span className="text-[12px] text-muted-foreground">{`${showing} showing`}</span> : null}>
          {announcements.length === 0 ? (
            <PanelEmpty icon={Megaphone}>No announcements yet. Published ones show here, newest first.</PanelEmpty>
          ) : (
            <ul className="pb-1">
              {announcements.map((announcement) => {
                const state = announcement.isActive ? (isShowing(announcement) ? "Showing" : "Expired") : "Hidden";
                return (
                  <li key={announcement.id} className="flex min-w-0 items-start gap-3 border-t px-5 py-3.5 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="min-w-0 text-sm font-medium wrap-break-word">{announcement.title}</p>
                        <StatusLabel {...LEVEL[announcement.level]} />
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed wrap-break-word text-muted-foreground">{announcement.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {state}
                        {announcement.endsAt ? ` · until ${formatDateTime(announcement.endsAt, TZ)}` : ""} · published {formatDateTime(announcement.createdAt, TZ)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ActionButton
                        action={setAnnouncementActiveAction}
                        values={{ announcementId: announcement.id, isActive: announcement.isActive ? "false" : "true" }}
                        label={announcement.isActive ? "Hide" : "Show"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
