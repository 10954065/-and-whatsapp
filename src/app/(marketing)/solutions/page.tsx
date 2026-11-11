import type { Metadata } from "next";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { pageMetadata } from "@/config/seo";

export const metadata: Metadata = pageMetadata("/solutions");

const SOLUTIONS = [
  {
    title: "Sell more from your DMs",
    problem: "Customers ask about price and stock, then go quiet when no one replies quickly.",
    outcome: "Instant, accurate answers from your catalogue, an order created in chat, and an automatic follow-up if payment is pending.",
  },
  {
    title: "Support that never sleeps",
    problem: "The same questions about delivery, opening hours and returns arrive all day and all night.",
    outcome: "Sunleon answers from your policies and FAQs, and hands sensitive cases to your team with full context.",
  },
  {
    title: "Fill your calendar",
    problem: "Booking back-and-forth eats staff time, and double bookings upset customers.",
    outcome: "Real availability checks, confirmed bookings, reminders, and database-level protection against overlaps.",
  },
  {
    title: "Never lose a lead",
    problem: "Interested customers are forgotten in long chat lists.",
    outcome: "Leads are captured automatically, tagged by intent, and followed up on a schedule you control.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero eyebrow="Solutions" title={<>Start from the result <span className="italic">you need.</span></>}>
        Sunleon pairs the conversation with the customer records, orders and bookings it needs to finish the job.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        {SOLUTIONS.map(({ title, problem, outcome }, index) => (
          <article key={title} className="grid gap-8 border-t py-12 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <span className="font-mono text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="mt-3 font-display text-4xl leading-[1.02] font-normal tracking-[-0.012em] sm:text-5xl">{title}</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="mt-2 font-display text-2xl leading-snug text-foreground/70 italic">{problem}</p>
              </div>
              <div className="surface rounded-2xl p-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-2 rounded-full bg-sun" aria-hidden="true" /> With Sunleon
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{outcome}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
      <CtaBand />
    </>
  );
}
