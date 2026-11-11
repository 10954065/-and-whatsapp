import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · SUNLEON AI admin" }, robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/monitoring", label: "Monitoring" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
];

/** Platform administration: 404 for everyone but super-admins, and two-factor authentication is required. */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSuperAdmin();
  const hasMfa = session.user.mfaEnabled && session.mfaVerified;

  return (
    <div className="min-h-svh bg-background">
      <header className="grain sticky top-0 z-30 bg-[#1d1a16] text-[#f3efe7]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 pt-4 pb-3 lg:px-8">
          <Logo href="/admin" inverted />
          <span className="shrink-0 rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#1d1a16]">
            Admin console
          </span>
          {/* Icons only on phones; the labels stay available to screen readers. */}
          <Link
            href="/app/account"
            title="Account & security"
            className="ml-auto flex items-center gap-1 text-sm whitespace-nowrap text-white/60 transition-colors hover:text-white"
          >
            <UserRound className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Account &amp; security</span>
          </Link>
          <Link
            href="/app/dashboard"
            title="Back to app"
            className="flex items-center gap-1 text-sm whitespace-nowrap text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Back to app</span>
          </Link>
        </div>
        {hasMfa ? (
          <div className="mx-auto max-w-7xl px-3 pb-3 lg:px-7">
            <AdminNav items={NAV} />
          </div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pt-10 pb-16 lg:px-8">
        {hasMfa ? (
          children
        ) : (
          <div className="surface mx-auto max-w-md rounded-[1.5rem] p-8 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sun-soft text-sun-ink">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">Two-factor authentication required</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The admin console can change every workspace. Turn on two-factor authentication for your account, then sign in again.
            </p>
            <Button asChild className="mt-6">
              <Link href="/app/account">Set up two-factor authentication</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
