import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/auth-forms";
import { getCurrentSession } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Create your account" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const session = await getCurrentSession();
  if (session) redirect(next?.startsWith("/invite/") ? next : "/app/dashboard");

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">Hire your AI employee</h1>
        <p className="text-muted-foreground">Create an account, then set up your business in a few guided steps.</p>
      </div>
      <RegisterForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
