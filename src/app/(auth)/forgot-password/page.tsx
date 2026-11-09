import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-[2.75rem] leading-none font-normal tracking-[-0.015em]">Forgot your password?</h1>
        <p className="text-muted-foreground">
          Enter your account email and we&apos;ll send you a single-use link to choose a new one.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground link-underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
