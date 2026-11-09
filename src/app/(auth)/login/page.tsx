import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { getCurrentSession } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const NOTICES: Record<string, string> = {
  reset: "Your password was changed. Sign in with your new password.",
  verified: "Email confirmed. Sign in to continue.",
  deleted: "Your account was deleted and your personal details were removed.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await getCurrentSession();
  if (session && (!session.user.mfaEnabled || session.mfaVerified)) redirect("/app/dashboard");

  const next = typeof params.next === "string" ? params.next : undefined;
  const noticeKey = Object.keys(NOTICES).find((key) => params[key] === "1");

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-[2.75rem] leading-none font-normal tracking-[-0.015em]">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to pick up your conversations and orders.</p>
      </div>
      {noticeKey ? (
        <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm">
          {NOTICES[noticeKey]}
        </p>
      ) : null}
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New to SUNLEON AI?{" "}
        <Link href="/register" className="font-medium text-foreground link-underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
