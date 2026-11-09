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
    <div className="grain relative min-h-svh overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute -top-64 -right-48 size-[40rem] rounded-full bg-sun-soft" />
      <div className="relative mx-auto flex min-h-svh max-w-2xl flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Logo href={memberships.length ? "/app/dashboard" : "/"} />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <div className="flex flex-1 flex-col justify-center py-14">
          <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-sun" aria-hidden="true" />
            Your workspace
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[0.98] font-normal tracking-[-0.018em] sm:text-6xl">
            Tell us about <span className="italic">your business.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Your workspace keeps your customers and conversations separate from every other business. You can change
            these details later.
          </p>
          <div className="surface mt-10 rounded-[2rem] p-6 sm:p-9">
            <CreateBusinessForm />
          </div>
          {isCreatingAnother && memberships.length > 0 ? (
            <Link href="/app/dashboard" className="link-underline mt-6 self-center text-sm font-medium">
              Cancel and return to your workspace
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
