import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-primitives";
import { IndustryTemplateForm } from "@/components/onboarding/industry-template-form";
import {
  BusinessHoursForm,
  BusinessProfileForm,
  NotificationSettingsForm,
} from "@/components/settings/settings-forms";
import { industryLabel } from "@/config/industries";
import { formatDate } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { getBusinessSettings } from "@/modules/businesses/settings.service";
import { getTemplateOverview } from "@/modules/onboarding/template.service";
import { ActionButton, QuickForm } from "@/components/operations/operations-forms";
import { cancelWorkspaceDeletionAction, requestWorkspaceDeletionAction } from "@/modules/privacy/privacy.actions";
import { DELETION_GRACE_DAYS, getPendingDeletion } from "@/modules/privacy/privacy.service";

export const metadata: Metadata = { title: "Settings" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const context = await requireTenant();
  const [business, overview, pendingDeletion] = await Promise.all([getBusinessSettings(context.businessId), getTemplateOverview(context.businessId), getPendingDeletion(context.businessId)]);
  const isOwner = context.role === "OWNER";
  const isReadOnly = !context.can("business.update");
  const settings = business.settings;

  return (
    <>
      <PageHeader
        title="Business settings"
        description={isReadOnly ? "You can view these settings. Ask an owner or admin to change them." : "Details your team and your AI employee rely on."}
      />
      <div className="grid gap-6">
        <Section id="profile" title="Business profile" description="Shown to your AI employee as trusted facts about your business.">
          <BusinessProfileForm
            disabled={isReadOnly}
            values={{
              name: business.name,
              industry: business.industry,
              description: business.description,
              phone: business.phone,
              email: business.email,
              website: business.website,
              address: business.address,
              city: business.city,
              country: business.country,
              timezone: business.timezone,
              currency: business.currency,
            }}
          />
        </Section>
        <Section id="template" title="Industry template" description="Starter answers, workflows and AI defaults for your industry. Nothing runs until you activate it.">
          <IndustryTemplateForm
            disabled={isReadOnly}
            industryLabel={industryLabel(overview.industry)}
            roleDescription={overview.template.roleDescription}
            fields={overview.template.knowledgeFields.map((field) => ({ ...field, value: overview.answers[field.key] ?? "" }))}
            workflows={overview.workflows}
            tools={overview.tools}
            commonQuestions={overview.template.commonQuestions}
            tips={overview.template.onboardingTips}
            otherAnswers={overview.otherAnswers}
            appliedLabel={overview.appliedAt ? formatDate(new Date(overview.appliedAt), business.timezone) : null}
            agentConfigured={overview.agentConfigured}
            canManageAutomation={context.can("automation.manage")}
          />
        </Section>
        <Section id="hours" title="Opening hours" description={`Times are in ${business.timezone}.`}>
          <BusinessHoursForm
            disabled={isReadOnly}
            hours={business.businessHours as Record<string, { start: string; end: string }[]> | null}
          />
        </Section>
        <Section id="notifications" title="Notifications & data retention" description="Who gets alerted, and how long conversation content is kept.">
          <NotificationSettingsForm
            disabled={isReadOnly}
            values={{
              notificationEmail: settings?.notificationEmail ?? null,
              notifyOnEscalation: settings?.notifyOnEscalation ?? true,
              notifyOnNewOrder: settings?.notifyOnNewOrder ?? true,
              notifyOnNewBooking: settings?.notifyOnNewBooking ?? true,
              notifyOnLowStock: settings?.notifyOnLowStock ?? true,
              messageRetentionDays: settings?.messageRetentionDays ?? 0,
            }}
          />
        </Section>
        {isOwner ? (
          <Section id="data" title="Your data" description="Download everything this workspace holds, or delete it permanently. Only the owner can do this.">
            <div className="grid gap-6">
              <div>
                <a href="/api/export/business" className="text-sm font-semibold text-primary hover:underline">
                  Download all workspace data (JSON)
                </a>
                <p className="mt-1 text-xs text-muted-foreground">Customers, conversations, orders, bookings, products, knowledge and settings. Channel credentials are never included.</p>
              </div>
              {pendingDeletion ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                  <p className="font-semibold">This workspace will be permanently deleted on {formatDate(pendingDeletion.purgeAfter, business.timezone)}.</p>
                  <p className="mt-1 mb-3 text-muted-foreground">Everything keeps working until then. After that, all data and files are removed and cannot be recovered.</p>
                  <ActionButton action={cancelWorkspaceDeletionAction} values={{}} label="Cancel deletion" />
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Deleting removes every customer, conversation, order, booking, file and setting after a {DELETION_GRACE_DAYS}-day grace period, during which you can cancel. Download your data first.
                  </p>
                  <QuickForm
                    action={requestWorkspaceDeletionAction}
                    submitLabel="Delete this workspace"
                    fields={[{ name: "confirmName", label: `Type “${business.name}” to confirm`, placeholder: business.name }]}
                  />
                </div>
              )}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}
