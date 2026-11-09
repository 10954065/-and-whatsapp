import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerificationForm, VerifyEmailForm } from "@/components/auth/auth-forms";
import { getCurrentSession } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Confirm your email" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Confirmation is a POST (button press), never a GET side effect, so email security
 * scanners that pre-fetch links cannot consume the token.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const session = await getCurrentSession();

  return (
    <div className="grid gap-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MailCheck className="size-6" aria-hidden="true" />
      </span>
      <div className="grid gap-2">
        <h1 className="font-display text-[2.75rem] leading-none font-normal tracking-[-0.015em]">Confirm your email</h1>
        <p className="text-muted-foreground">
          {token
            ? "Press the button below to confirm this email address belongs to you."
            : "We sent a confirmation link to your inbox. Open it on this device to continue."}
        </p>
      </div>
      {token ? <VerifyEmailForm token={token} /> : null}
      {!token && session && !session.user.emailVerifiedAt ? <ResendVerificationForm /> : null}
      {!token && !session ? (
        <Link href="/login" className="text-sm font-medium text-foreground link-underline">
          Back to sign in
        </Link>
      ) : null}
    </div>
  );
}
