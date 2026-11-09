import type { Metadata } from "next";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { INDUSTRY_OPTIONS } from "@/config/industries";

export const metadata: Metadata = { title: "Industries" };

const EXAMPLES: Record<string, string> = {
  RESTAURANT: "“Is jollof available tonight? Can you deliver to Spintex?”",
  RETAIL: "“Do you have this phone case for the iPhone 16?”",
  FASHION: "“What sizes does the agbada come in?”",
  BEAUTY: "“Which shea butter is best for dry skin?”",
  SALON_SPA: "“Can I book braids with Akosua on Saturday morning?”",
  HEALTHCARE_ADMIN: "“What time does the clinic open, and can I book a check-up?”",
  HOSPITALITY: "“Do you have a double room free next weekend?”",
  REAL_ESTATE: "“Is the 2-bedroom in Cantonments still available to view?”",
  EDUCATION: "“When does registration for the next coding cohort close?”",
  PROFESSIONAL_SERVICES: "“How much do you charge to register a company?”",
  GENERAL: "“Are you open on public holidays?”",
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero eyebrow="Industries" title="One AI engine. Eleven ways to work.">
        Each template gives your AI employee the right knowledge fields, tone, workflows and escalation rules for your
        industry, and you can adjust everything.
      </PageHero>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRY_OPTIONS.map((industry) => (
          <article key={industry.value} className="flex flex-col rounded-3xl border bg-card p-7">
            <h2 className="text-lg font-bold">{industry.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{industry.description}</p>
            <p className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm italic">{EXAMPLES[industry.value]}</p>
          </article>
        ))}
      </section>
      <p className="mx-auto max-w-3xl px-6 text-center text-sm text-muted-foreground">
        Healthcare template note: SUNLEON AI handles administrative tasks such as appointments and opening hours only.
        It never gives diagnoses or treatment advice and always refers clinical questions to qualified staff.
      </p>
      <CtaBand />
    </>
  );
}
