import type { Metadata } from "next";
import { CalendarCheck, Headphones, Repeat, TrendingUp } from "lucide-react";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";

export const metadata: Metadata = { title: "Solutions" };

const SOLUTIONS = [
  {
    icon: TrendingUp,
    title: "Sell more from your DMs",
    problem: "Customers ask about price and stock, then go quiet when no one replies quickly.",
    outcome: "Instant, accurate answers from your catalogue, an order created in chat, and an automatic follow-up if payment is pending.",
  },
  {
    icon: Headphones,
    title: "Customer support that never sleeps",
    problem: "The same questions about delivery, opening hours and returns arrive all day and all night.",
    outcome: "Your AI employee answers from your policies and FAQs, and hands sensitive cases to your team with full context.",
  },
  {
    icon: CalendarCheck,
    title: "Fill your calendar",
    problem: "Booking back-and-forth eats staff time, and double bookings upset customers.",
    outcome: "Real availability checks, confirmed bookings, reminders, and database-level protection against overlaps.",
  },
  {
    icon: Repeat,
    title: "Never lose a lead",
    problem: "Interested customers are forgotten in long chat lists.",
    outcome: "Leads are captured automatically, tagged by intent, and followed up on a schedule you control.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero eyebrow="Solutions" title="Start from the outcome you need.">
        SUNLEON AI combines an AI employee with the CRM, orders and bookings it needs to finish the job.
      </PageHero>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-20">
        {SOLUTIONS.map(({ icon: Icon, title, problem, outcome }, index) => (
          <article key={title} className="grid gap-6 rounded-3xl border bg-card p-8 md:grid-cols-[auto_1fr_1fr] md:items-start">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet to-azure text-white">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">0{index + 1}</p>
              <h2 className="mt-1 text-2xl font-bold">{title}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{problem}</p>
            </div>
            <p className="rounded-2xl bg-muted/60 p-5 text-sm leading-6">
              <span className="mb-1 block text-xs font-semibold tracking-wider text-primary uppercase">With SUNLEON AI</span>
              {outcome}
            </p>
          </article>
        ))}
      </section>
      <CtaBand />
    </>
  );
}
