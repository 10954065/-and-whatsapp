import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { CreateBusinessForm } from "@/components/onboarding/create-business-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/current";
import { listUserMemberships } from "@/lib/auth/tenant";
import { logoutAction } from "@/modules/auth/auth.actions";

export const metadata: Metadata = { title: "Create your workspace" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser();
  const params = await searchParams;
  const memberships = await listUserMemberships(session.user.id);
  const isCreatingAnother = params.new === "1";
  if (memberships.length > 0 && !isCreatingAnother) redirect("/app/dashboard");

  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" />
      <div className="relative mx-auto flex min-h-svh max-w-xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Logo href={memberships.length ? "/app/dashboard" : "/"} />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <div className="flex flex-1 flex-col justify-center py-12">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Your workspace</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Tell us about your business</h1>
          <p className="mt-3 text-muted-foreground">
            Your workspace keeps your customers, conversations and AI employee separate from every other business.
            You can change these details later.
          </p>
          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <CreateBusinessForm />
          </div>
          {isCreatingAnother && memberships.length > 0 ? (
            <Link href="/app/dashboard" className="mt-6 text-center text-sm font-medium text-primary hover:underline">
              Cancel and return to your workspace
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
