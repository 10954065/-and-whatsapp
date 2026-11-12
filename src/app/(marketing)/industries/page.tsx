import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  House,
  type LucideIcon,
  Scissors,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { BubbleReveal } from "@/components/marketing/bubble-reveal";
import { IndustryDrawing } from "@/components/marketing/industry-drawing";
import { CtaBand, JumpChips, PageHero, PANEL_HOVER, PenUnderlined, TONE_WASH } from "@/components/marketing/marketing-blocks";
import { INDUSTRY_OPTIONS } from "@/config/industries";
import { pageMetadata } from "@/config/seo";
import { INDUSTRY_TONES } from "@/config/tones";
import type { Industry } from "@/generated/prisma/enums";
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
  // The "Not on the list?" card: the general template's own two fields.
  GENERAL_SETUP: ["What you offer", "Frequent questions"],
};

function ChecksRow({ checks }: { checks: readonly string[] }) {
  return (
    <p className="mt-auto ml-auto flex w-fit max-w-full flex-wrap items-center justify-end gap-1.5 pt-3 text-[11px] font-medium text-[#54656f] dark:text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-(--tone) ring-1 ring-foreground/25" />
        Sunleon checks
      </span>
      {checks.map((check) => (
        <span key={check} className="rounded-full bg-card/85 px-2.5 py-1 text-foreground shadow-(--shadow-hairline)">
          {check}
        </span>
      ))}
    </p>
  );
}

const ICONS: Record<Industry, LucideIcon> = {
  RESTAURANT: UtensilsCrossed,
  RETAIL: ShoppingBag,
  FASHION: Shirt,
  BEAUTY: Sparkles,
  SALON_SPA: Scissors,
  HEALTHCARE_ADMIN: CalendarClock,
  HOSPITALITY: BedDouble,
  REAL_ESTATE: House,
  EDUCATION: GraduationCap,
  PROFESSIONAL_SERVICES: BriefcaseBusiness,
  GENERAL: Store,
};

const anchorFor = (industry: Industry) => industry.toLowerCase().replace(/_/g, "-");

const JUMP_CHIPS = INDUSTRY_OPTIONS.map((industry) => ({
  href: `#${anchorFor(industry.value)}`,
  label: industry.label,
  icon: ICONS[industry.value],
  tone: INDUSTRY_TONES[industry.value],
}));

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Industries"
        title={
          <>
            One assistant.{" "}
            <span className="italic">
              <PenUnderlined>Eleven</PenUnderlined> ways to work.
            </span>
          </>
        }
        footer={<JumpChips label="Jump to an industry" chips={JUMP_CHIPS} />}
      >
        Each template sets up the right questions, tone, starter workflows and hand-over rules for your kind of business,
        and you can change all of it.
      </PageHero>
      <section className="mx-auto grid max-w-7xl gap-x-6 gap-y-14 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3 lg:py-28">
        {INDUSTRY_OPTIONS.map((industry, index) => (
          <article
            key={industry.value}
            id={anchorFor(industry.value)}
            className={cn("group row-span-3 grid scroll-mt-28 grid-rows-subgrid gap-y-0", INDUSTRY_TONES[industry.value])}
          >
            <div className={cn(PANEL_HOVER, TONE_WASH, "p-5 pb-6")}>
              <IndustryDrawing
                industry={industry.value}
                delay={(index % 3) * 0.08}
                className="mx-auto mt-1 mb-5 h-28 w-auto origin-bottom text-foreground motion-safe:group-hover:animate-[wiggle_0.55s_ease-in-out]"
              />
              <p className="mb-3 text-[11px] font-medium text-[#54656f] dark:text-muted-foreground">A customer asks</p>
              <BubbleReveal delay={(index % 3) * 0.08} className="dark:bg-card">
                {EXAMPLES[industry.value]}
              </BubbleReveal>
              <ChecksRow checks={CHECKS[industry.value]} />
            </div>
            <h2 className="mt-6 font-display text-3xl font-normal tracking-[-0.01em]">{industry.label}</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">{industry.description}</p>
          </article>
        ))}
        <article className="group row-span-3 grid grid-rows-subgrid gap-y-0 [--tone:var(--sun)]">
          <div className={cn(PANEL_HOVER, "border-2 border-dashed border-foreground/15 p-4.5 pb-5.5 group-hover:border-foreground/30")}>
            <svg
              viewBox="0 0 160 100"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              aria-hidden="true"
              className="mx-auto mt-1 mb-5 h-28 w-auto text-foreground/45"
            >
              <circle cx="80" cy="48" r="30" strokeDasharray="6 7" />
              <path d="M80 36V60M68 48H92" />
            </svg>
            <p className="mb-3 text-[11px] font-medium text-[#54656f] dark:text-muted-foreground">A customer asks</p>
            <BubbleReveal delay={0.16} className="dark:bg-card">
              Will it work for my kind of business?
            </BubbleReveal>
            <ChecksRow checks={CHECKS.GENERAL_SETUP} />
          </div>
          <h2 className="mt-6 font-display text-3xl font-normal tracking-[-0.01em]">Not on the list?</h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Start with the general setup and teach it what you do. You can change every question, tone and hand-over rule.{" "}
            <Link href="/register" className="link-underline inline-flex items-center gap-1 font-medium text-foreground">
              Start free trial <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </p>
        </article>
      </section>
      <p className="mx-auto max-w-3xl px-6 pb-8 text-center text-sm leading-relaxed text-muted-foreground">
        A note on healthcare: Sunleon handles front-desk tasks such as appointments and opening hours only. It never gives
        diagnoses or treatment advice, and it always refers clinical questions to qualified staff.
      </p>
      <CtaBand />
    </>
  );
}
