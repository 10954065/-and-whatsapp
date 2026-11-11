import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
import { AdminMenu, AdminTabs } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/current";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · SUNLEON AI admin" }, robots: { index: false, follow: false } };

/** Platform administration: 404 for everyone but super-admins, and two-factor authentication is required. */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSuperAdmin();
  const hasMfa = session.user.mfaEnabled && session.mfaVerified;

  return (
    <div className="min-h-svh bg-background">
      <header className="grain sticky top-0 z-30 bg-[#1d1a16] text-[#f3efe7]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 md:pt-4 lg:px-8">
          <Logo href="/admin" inverted />
          <span className="shrink-0 rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#1d1a16]">
            Admin console
          </span>
          {/* With the console open, phones get the side-bar menu; the links below move into it. */}
          {hasMfa ? <AdminMenu /> : null}
          <div className={cn("ml-auto items-center gap-4", hasMfa ? "hidden md:flex" : "flex")}>
            <Link href="/app/account" title="Account & security" className="flex items-center gap-1 text-sm whitespace-nowrap text-white/60 transition-colors hover:text-white">
              <UserRound className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Account &amp; security</span>
            </Link>
            <Link href="/app/dashboard" title="Back to app" className="flex items-center gap-1 text-sm whitespace-nowrap text-white/60 transition-colors hover:text-white">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Back to app</span>
            </Link>
          </div>
        </div>
        {hasMfa ? (
          <div className="mx-auto hidden max-w-7xl px-3 pb-3 md:block lg:px-7">
            <AdminTabs />
          </div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-16 sm:pt-10 lg:px-8">
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
