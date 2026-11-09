import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
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
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
          <Logo href="/admin" />
          <span className="rounded-md bg-navy px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
          {hasMfa ? (
            <nav aria-label="Admin" className="flex flex-wrap gap-1 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <Link href="/app/dashboard" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
        {hasMfa ? (
          children
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
            <ShieldCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold">Two-factor authentication required</h1>
            <p className="mt-2 text-sm text-muted-foreground">The admin console can change every workspace. Turn on two-factor authentication for your account, then sign in again.</p>
            <Link href="/app/account" className="mt-4 inline-block font-medium text-foreground link-underline">
              Set up two-factor authentication
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
