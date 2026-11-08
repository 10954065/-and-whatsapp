import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/auth/current";
import { logoutAction } from "@/modules/auth/auth.actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Two-factor authentication" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MfaPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser({ allowPendingMfa: true });
  if (!session.user.mfaEnabled || session.mfaVerified) redirect("/app/dashboard");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">Two-factor check</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{session.user.email}</span>.
        </p>
      </div>
      <MfaForm next={next} />
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          Use a different account
        </Button>
      </form>
    </div>
  );
}
