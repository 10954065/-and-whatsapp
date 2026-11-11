import type { Metadata } from "next";
import { BubbleReveal } from "@/components/marketing/bubble-reveal";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { INDUSTRY_OPTIONS } from "@/config/industries";
import { pageMetadata } from "@/config/seo";

export const metadata: Metadata = pageMetadata("/industries");

const EXAMPLES: Record<string, string> = {
  RESTAURANT: "Is jollof available tonight? Can you deliver to Spintex?",
  RETAIL: "Do you have this phone case for the iPhone 16?",
  FASHION: "What sizes does the agbada come in?",
  BEAUTY: "Which shea butter is best for dry skin?",
  SALON_SPA: "Can I book braids with Akosua on Saturday morning?",
  HEALTHCARE_ADMIN: "What time does the clinic open, and can I book a check-up?",
  HOSPITALITY: "Do you have a double room free next weekend?",
  REAL_ESTATE: "Is the 2-bedroom in Cantonments still available to view?",
  EDUCATION: "When does registration for the next coding cohort close?",
  PROFESSIONAL_SERVICES: "How much do you charge to register a company?",
  GENERAL: "Are you open on public holidays?",
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero eyebrow="Industries" title={<>One assistant. <span className="italic">Eleven ways to work.</span></>}>
        Each template sets up the right questions, tone, starter workflows and hand-over rules for your kind of business,
        and you can change all of it.
      </PageHero>
      <section className="mx-auto grid max-w-7xl gap-x-6 gap-y-14 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3 lg:py-28">
        {INDUSTRY_OPTIONS.map((industry, index) => (
          <article key={industry.value} className="flex flex-col">
            <div className="rounded-[1.75rem] bg-[#efe7de] p-5 pb-6 dark:bg-white/[0.04]">
              <p className="mb-3 text-[11px] font-medium text-[#54656f] dark:text-muted-foreground">A customer asks</p>
              <BubbleReveal delay={(index % 3) * 0.08} className="dark:bg-card">
                {EXAMPLES[industry.value]}
              </BubbleReveal>
            </div>
            <h2 className="mt-6 font-display text-3xl font-normal tracking-[-0.01em]">{industry.label}</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">{industry.description}</p>
          </article>
        ))}
      </section>
      <p className="mx-auto max-w-3xl px-6 pb-8 text-center text-sm leading-relaxed text-muted-foreground">
        A note on healthcare: Sunleon handles front-desk tasks such as appointments and opening hours only. It never gives
        diagnoses or treatment advice, and it always refers clinical questions to qualified staff.
      </p>
      <CtaBand />
    </>
  );
}
