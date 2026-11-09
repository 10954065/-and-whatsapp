import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-primitives";
import { ActionButton } from "@/components/operations/operations-forms";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/modules/notifications/notification.actions";
import { listNotifications } from "@/modules/notifications/notification.service";

export const metadata: Metadata = { title: "Notifications" };

const KIND_LABEL: Record<string, string> = {
  "ai.escalation": "Escalation",
  "order.created": "Order",
  "booking.created": "Booking",
  "stock.low": "Stock",
  automation: "Automation",
  billing: "Billing",
};

export default async function NotificationsPage() {
  const context = await requireTenant();
  const notifications = await listNotifications(context.businessId);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts for your whole team. Choose which events notify you, and add an email address, in Settings → Notifications."
        actions={unread > 0 ? <ActionButton action={markNotificationsReadAction} values={{ notificationId: "all" }} label="Mark all as read" /> : null}
      />
      <section className="surface rounded-[1.25rem]">
        {notifications.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Bell} title="You're all caught up" description="Escalations, new orders, bookings, low stock and automation alerts will appear here." />
          </div>
        ) : (
          <ul className="divide-y">
            {notifications.map((notification) => (
              <li key={notification.id} className={cn("flex flex-wrap items-start gap-3 px-6 py-4", !notification.readAt && "bg-primary/4")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.readAt ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {notification.link ? (
                      <Link href={notification.link} className="hover:underline">
                        {notification.title}
                      </Link>
                    ) : (
                      notification.title
                    )}
                    {!notification.readAt ? <span className="sr-only"> (unread)</span> : null}
                  </p>
                  {notification.body ? <p className="text-sm text-muted-foreground">{notification.body}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-2">
                      {KIND_LABEL[notification.type] ?? "Alert"}
                    </Badge>
                    {formatRelative(notification.createdAt)}
                  </p>
                </div>
                {!notification.readAt ? <ActionButton action={markNotificationsReadAction} values={{ notificationId: notification.id }} label="Mark read" variant="ghost" /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
