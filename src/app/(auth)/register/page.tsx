import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/auth-forms";
import { pageMetadata } from "@/config/seo";
import { META_FREE_REPLIES_PER_MONTH } from "@/config/whatsapp-fees";
import { getCurrentSession } from "@/lib/auth/current";
import { isArriving } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = pageMetadata("/register");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const session = await getCurrentSession();
  // A visitor who signed up a moment ago stays here while the welcome animation plays.
  if (session && !(await isArriving())) redirect(next?.startsWith("/invite/") ? next : "/app/dashboard");

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-[2.75rem] leading-none font-normal tracking-[-0.015em]">Start your free trial</h1>
        <p className="text-muted-foreground">Create your account, then set up your business in a few short steps. No card needed.</p>
        <p className="text-sm text-muted-foreground">
          On WhatsApp, Meta charges separately for replies after the first {formatNumber(META_FREE_REPLIES_PER_MONTH)} each
          month and bills you directly.{" "}
          <Link href="/pricing#whatsapp-fees" className="font-medium text-foreground link-underline">
            How Meta&apos;s fees work
          </Link>
        </p>
      </div>
      <RegisterForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground link-underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
