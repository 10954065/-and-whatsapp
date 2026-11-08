import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">Choose a new password</h1>
        <p className="text-muted-foreground">You&apos;ll be signed out of all other devices.</p>
      </div>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm">
          This reset link is incomplete.{" "}
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
            Request a new link
          </Link>
          .
        </p>
      )}
    </div>
  );
}
