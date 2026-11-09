import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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
          <span className="rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-semibold text-[#1d1a16]">Admin console</span>
          <Link href="/app/dashboard" className="ml-auto flex items-center gap-1 text-sm text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to app
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
