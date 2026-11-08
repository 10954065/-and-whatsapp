import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">Forgot your password?</h1>
        <p className="text-muted-foreground">
          Enter your account email and we&apos;ll send you a single-use link to choose a new one.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
