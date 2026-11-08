import type { Metadata } from "next";
import { BadgeCheck, MailWarning } from "lucide-react";
import { PageHeader } from "@/components/app/page-primitives";
import { ChangePasswordForm, DisableMfaForm, MfaSetup } from "@/components/account/security-forms";
import { ResendVerificationForm } from "@/components/auth/auth-forms";
import { Badge } from "@/components/ui/badge";
import { requireTenant } from "@/lib/auth/tenant";

export const metadata: Metadata = { title: "Account & security" };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,18rem)_1fr]">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function AccountPage() {
  const { user } = await requireTenant();
  return (
    <>
      <PageHeader title="Account & security" description="Your personal sign-in details. These apply to every workspace you belong to." />
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <Section title="Profile" description="Your name and sign-in email.">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium">
                {user.email}
                {user.emailVerifiedAt ? (
                  <Badge variant="secondary" className="gap-1">
                    <BadgeCheck className="size-3.5 text-success" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-warning/40">
                    <MailWarning className="size-3.5 text-warning" /> Not verified
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
          {!user.emailVerifiedAt ? (
            <div className="mt-4">
              <ResendVerificationForm />
            </div>
          ) : null}
        </Section>
        <Section title="Password" description="Changing your password signs you out on all other devices.">
          <ChangePasswordForm />
        </Section>
        <Section
          title="Two-factor authentication"
          description="Require a code from your phone in addition to your password when you sign in."
        >
          {user.mfaEnabled ? (
            <div className="grid gap-4">
              <Badge className="w-fit gap-1 bg-success/15 text-success">
                <BadgeCheck className="size-3.5" /> On
              </Badge>
              <DisableMfaForm />
            </div>
          ) : (
            <MfaSetup />
          )}
        </Section>
      </div>
    </>
  );
}
