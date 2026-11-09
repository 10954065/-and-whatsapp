import Link from "next/link";
import { CreditCard, MailWarning, Megaphone, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar, AppTopbar } from "@/components/app/app-shell";
import { APP_NAVIGATION } from "@/config/navigation";
import { ROLE_LABELS } from "@/config/permissions";
import { listUserMemberships, requireTenant } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { getActiveAnnouncements } from "@/modules/administration/monitoring.service";
import { isSubscriptionLapsed } from "@/modules/billing/billing.service";
import { countUnreadNotifications } from "@/modules/notifications/notification.service";
import { getPendingDeletion } from "@/modules/privacy/privacy.service";
import { formatDate } from "@/lib/format";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireTenant();
  const [memberships, unreadNotifications, subscription, announcements, pendingDeletion] = await Promise.all([
    listUserMemberships(context.user.id),
    countUnreadNotifications(context.businessId),
    prisma.subscription.findUnique({ where: { businessId: context.businessId }, select: { status: true, trialEndsAt: true } }),
    getActiveAnnouncements(),
    getPendingDeletion(context.businessId),
  ]);

  const sections = APP_NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => context.can(item.permission)),
  })).filter((section) => section.items.length > 0);

  const businesses = memberships.map((membership) => ({
    id: membership.businessId,
    name: membership.business.name,
    roleLabel: ROLE_LABELS[membership.role],
  }));

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar sections={sections} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          sections={sections}
          business={{ id: context.businessId, name: context.business.name, roleLabel: ROLE_LABELS[context.role] }}
          businesses={businesses}
          user={{ name: context.user.name, email: context.user.email }}
          unreadNotifications={unreadNotifications}
          isPlatformAdmin={context.user.platformRole === "SUPER_ADMIN"}
        />
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            role={announcement.level === "INFO" ? "status" : "alert"}
            className={cn(
              "flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm lg:px-8",
              announcement.level === "INFO" && "border-primary/20 bg-primary/8",
              announcement.level === "WARNING" && "border-warning/30 bg-warning/10",
              announcement.level === "CRITICAL" && "border-destructive/30 bg-destructive/10",
            )}
          >
            <Megaphone className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{announcement.title}</span>
            <span className="text-muted-foreground">{announcement.body}</span>
          </div>
        ))}
        {!context.user.emailVerifiedAt ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm lg:px-8">
            <MailWarning className="size-4 text-warning" aria-hidden="true" />
            <span>Confirm your email address to connect channels, invite your team and activate your AI employee.</span>
            <Link href="/verify-email" className="font-semibold text-primary hover:underline">
              Resend confirmation
            </Link>
          </div>
        ) : null}
        {pendingDeletion ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm lg:px-8">
            <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
            <span>This workspace will be permanently deleted on {formatDate(pendingDeletion.purgeAfter, context.business.timezone)}.</span>
            {context.role === "OWNER" ? (
              <Link href="/app/settings#data" className="font-semibold text-primary hover:underline">
                Cancel deletion
              </Link>
            ) : null}
          </div>
        ) : null}
        {isSubscriptionLapsed(subscription) && context.business.status === "ACTIVE" ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm lg:px-8">
            <CreditCard className="size-4 text-destructive" aria-hidden="true" />
            <span>Your plan has ended, so AI replies and automations are paused. Your data is safe.</span>
            {context.can("billing.manage") ? (
              <Link href="/app/billing" className="font-semibold text-primary hover:underline">
                Choose a plan
              </Link>
            ) : (
              <span className="text-muted-foreground">Ask the workspace owner to renew.</span>
            )}
          </div>
        ) : null}
        {context.business.status !== "ACTIVE" ? (
          <main className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <ShieldAlert className="mx-auto size-10 text-warning" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-bold">This workspace is suspended</h1>
              <p className="mt-2 text-muted-foreground">
                Your data is safe and has not been deleted. Contact SUNLEON AI support to restore access.
              </p>
            </div>
          </main>
        ) : (
          <main className="flex-1 px-4 py-8 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        )}
      </div>
    </div>
  );
}
