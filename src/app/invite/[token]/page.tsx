import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AcceptInvitationForm } from "@/components/team/team-forms";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/config/permissions";
import { getCurrentSession } from "@/lib/auth/current";
import { logoutAction } from "@/modules/auth/auth.actions";
import { findInvitation } from "@/modules/team/team.service";

export const metadata: Metadata = { title: "Join a workspace", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [found, session] = await Promise.all([findInvitation(token), getCurrentSession()]);
  const returnTo = encodeURIComponent(`/invite/${token}`);

  let body: React.ReactNode;
  if (!found || !found.isUsable) {
    body = (
      <>
        <h1 className="font-display text-[2.75rem] leading-none font-normal tracking-[-0.015em]">This invitation is no longer valid</h1>
        <p className="text-muted-foreground">It may have expired, been revoked or already been used. Ask the person who invited you to send a new one.</p>
      </>
    );
  } else {
    const { invitation } = found;
    const heading = (
      <>
        <h1 className="font-display text-[2.75rem] leading-none font-normal tracking-[-0.015em]">Join {invitation.business.name}</h1>
        <p className="text-muted-foreground">
          {invitation.invitedBy.name} invited <span className="font-medium text-foreground">{invitation.email}</span> to join as{" "}
          {ROLE_LABELS[invitation.role]}.
        </p>
      </>
    );
    if (!session) {
      body = (
        <>
          {heading}
          <div className="grid gap-2">
            <Button asChild size="lg">
              <Link href={`/register?next=${returnTo}`}>Create an account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/login?next=${returnTo}`}>I already have an account</Link>
            </Button>
          </div>
        </>
      );
    } else if (session.user.email !== invitation.email) {
      body = (
        <>
          {heading}
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
            You&apos;re signed in as {session.user.email}. Sign in with {invitation.email} to accept.
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </>
      );
    } else {
      body = (
        <>
          {heading}
          <AcceptInvitationForm token={token} businessName={invitation.business.name} />
        </>
      );
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-12">
      <Logo />
      <div className="mt-10 grid w-full max-w-md gap-5 rounded-2xl border bg-card p-8 shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UsersRound className="size-5" aria-hidden="true" />
        </span>
        {body}
      </div>
    </div>
  );
}
