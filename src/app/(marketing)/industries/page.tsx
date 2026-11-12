import type { Metadata } from "next";
import { BubbleReveal } from "@/components/marketing/bubble-reveal";
import { IndustryDrawing } from "@/components/marketing/industry-drawing";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { INDUSTRY_OPTIONS } from "@/config/industries";
import { INDUSTRY_TONES } from "@/config/industry-tones";
import { pageMetadata } from "@/config/seo";
import { cn } from "@/lib/utils";

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

/** What the assistant looks up for each question above: a field the template asks you to fill in, or a tool it turns on. */
const CHECKS: Record<string, [string, string]> = {
  RESTAURANT: ["Dishes in stock", "Delivery areas & fees"],
  RETAIL: ["Products and prices", "Stock levels"],
  FASHION: ["Size guide", "Stock levels"],
  BEAUTY: ["Product range", "Skin types served"],
  SALON_SPA: ["Services", "Free slots by stylist"],
  HEALTHCARE_ADMIN: ["Opening hours", "Free appointment slots"],
  HOSPITALITY: ["Room types", "Check-in & policies"],
  REAL_ESTATE: ["Current listings", "Viewing slots"],
  EDUCATION: ["Programmes & courses", "Admissions"],
  PROFESSIONAL_SERVICES: ["Services", "Pricing approach"],
  GENERAL: ["Opening hours", "Frequent questions"],
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
          <article key={industry.value} className={cn("row-span-3 grid grid-rows-subgrid gap-y-0", INDUSTRY_TONES[industry.value])}>
            <div className="flex flex-col rounded-[1.75rem] bg-[color-mix(in_oklch,var(--tone)_17%,var(--paper))] p-5 pb-6 dark:bg-[color-mix(in_oklch,var(--tone)_11%,var(--paper))]">
              <IndustryDrawing industry={industry.value} delay={(index % 3) * 0.08} className="mx-auto mt-1 mb-5 h-28 w-auto text-foreground" />
              <p className="mb-3 text-[11px] font-medium text-[#54656f] dark:text-muted-foreground">A customer asks</p>
              <BubbleReveal delay={(index % 3) * 0.08} className="dark:bg-card">
                {EXAMPLES[industry.value]}
              </BubbleReveal>
              <p className="mt-auto ml-auto flex w-fit pt-3 max-w-full flex-wrap items-center justify-end gap-1.5 text-[11px] font-medium text-[#54656f] dark:text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-(--tone) ring-1 ring-foreground/25" />
                  Sunleon checks
                </span>
                {CHECKS[industry.value].map((check) => (
                  <span key={check} className="rounded-full bg-card/85 px-2.5 py-1 text-foreground shadow-(--shadow-hairline)">
                    {check}
                  </span>
                ))}
              </p>
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
