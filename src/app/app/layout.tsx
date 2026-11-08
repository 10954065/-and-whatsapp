import Link from "next/link";
import { MailWarning, ShieldAlert } from "lucide-react";
import { AppSidebar, AppTopbar } from "@/components/app/app-shell";
import { APP_NAVIGATION } from "@/config/navigation";
import { ROLE_LABELS } from "@/config/permissions";
import { listUserMemberships, requireTenant } from "@/lib/auth/tenant";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireTenant();
  const memberships = await listUserMemberships(context.user.id);

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
        />
        {!context.user.emailVerifiedAt ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm lg:px-8">
            <MailWarning className="size-4 text-warning" aria-hidden="true" />
            <span>Confirm your email address to connect channels, invite your team and activate your AI employee.</span>
            <Link href="/verify-email" className="font-semibold text-primary hover:underline">
              Resend confirmation
            </Link>
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
