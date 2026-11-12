import type { Metadata } from "next";
import { CalendarCheck, type LucideIcon, Magnet, Moon, ShoppingBag } from "lucide-react";
import { CtaBand, JumpChips, PageHero, PenUnderlined, TONE_WASH } from "@/components/marketing/marketing-blocks";
import { ExampleChat, type ExampleChatScript, PenArrow, ProblemDrawing, type ProblemDrawingName } from "@/components/marketing/solution-story";
import { pageMetadata } from "@/config/seo";
import { TONES } from "@/config/tones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("/solutions");

interface Solution {
  id: ProblemDrawingName;
  /** The shorter name on the jump chip. */
  chip: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  problem: string;
  outcome: string;
  /** Illustrative, and labelled "Example" on the page. Each step is something the product really does. */
  example: ExampleChatScript;
}

const SOLUTIONS: Solution[] = [
  {
    id: "sell",
    chip: "Sell more",
    icon: ShoppingBag,
    tone: TONES.coral,
    title: "Sell more from your DMs",
    problem: "Customers ask about price and stock, then go quiet when no one replies quickly.",
    outcome: "Instant, accurate answers from your catalogue, an order created in chat, and an automatic follow-up if payment is pending.",
    example: {
      customer: "Hello, please do you have the kente midi dress in size M?",
      steps: [
        { title: "Checked stock", detail: "Kente midi dress, size M: 3 left" },
        { title: "Order #1042 created", detail: "Payment link sent" },
      ],
      reply: "Yes, 3 left in size M! I've reserved one for you as order #1042. Here's your payment link.",
    },
  },
  {
    id: "support",
    chip: "Always-on support",
    icon: Moon,
    tone: TONES.indigo,
    title: "Support that never sleeps",
    problem: "The same questions about delivery, opening hours and returns arrive all day and all night.",
    outcome: "Sunleon answers from your policies and FAQs, and hands sensitive cases to your team with full context.",
    example: {
      customer: "Do you deliver on Sundays?",
      steps: [{ title: "Checked your FAQs", detail: "Delivery days" }],
      reply: "Hi! We deliver Monday to Saturday, so an order tonight goes out first thing on Monday.",
    },
  },
  {
    id: "bookings",
    chip: "Fill your calendar",
    icon: CalendarCheck,
    tone: TONES.rose,
    title: "Fill your calendar",
    problem: "Booking back-and-forth eats staff time, and double bookings upset customers.",
    outcome: "Real availability checks, confirmed bookings, reminders, and database-level protection against overlaps.",
    example: {
      customer: "Do you have Saturday morning for knotless braids?",
      steps: [
        { title: "Checked availability", detail: "Saturday 9:00 with Esi is free" },
        { title: "Booking confirmed", detail: "Reminder set for Friday 18:00" },
      ],
      reply: "You're booked for Saturday at 9:00 with Esi. I'll remind you on Friday evening.",
    },
  },
  {
    id: "leads",
    chip: "Keep every lead",
    icon: Magnet,
    tone: TONES.lime,
    title: "Never lose a lead",
    problem: "Interested customers are forgotten in long chat lists.",
    outcome: "Leads are captured automatically, tagged by intent, and followed up on a schedule you control.",
    example: {
      customer: "How much for 50 printed T-shirts for our church harvest?",
      steps: [
        { title: "Lead captured", detail: "Tagged: bulk order" },
        { title: "Follow-up scheduled", detail: "Thursday 10:00" },
      ],
      reply: "Thanks! Bulk prices depend on the print, so I've passed this to our team. They'll message you on Thursday morning.",
    },
  },
];

const JUMP_CHIPS = SOLUTIONS.map((solution) => ({ href: `#${solution.id}`, label: solution.chip, icon: solution.icon, tone: solution.tone }));

/** Today, drawn in grey on a dashed card; an arrow; then the same moment with Sunleon, in the result's colour. */
function SolutionStory({ solution, index }: { solution: Solution; index: number }) {
  return (
    <article id={solution.id} className={cn("scroll-mt-28 border-t py-14 first:border-t-0 first:pt-0 lg:py-16", solution.tone)}>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        <h2 className="font-display text-4xl leading-[1.02] font-normal tracking-[-0.012em] sm:text-5xl">{solution.title}</h2>
      </div>
      <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1.25fr)] lg:gap-4">
        <div className="flex flex-col rounded-[1.75rem] border-2 border-dashed border-foreground/12 p-6 sm:p-7">
          <p className="text-sm font-medium text-muted-foreground">Today</p>
          <ProblemDrawing problem={solution.id} className="mx-auto my-auto h-40 w-auto py-5 text-foreground/75" />
          <p className="font-display text-2xl leading-snug text-foreground/75 italic">{solution.problem}</p>
        </div>
        <PenArrow className="mx-auto h-10 w-20 rotate-90 self-center text-sun lg:rotate-0" />
        <div className={cn(TONE_WASH, "flex flex-col rounded-[1.75rem] p-6 sm:p-7")}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden="true" className="size-2 rounded-full bg-(--tone) ring-1 ring-foreground/25" /> With Sunleon
            </p>
            <span className="rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-(--shadow-hairline)">Example</span>
          </div>
          <div className="mt-5">
            <ExampleChat script={solution.example} />
          </div>
          <p className="mt-6 border-t border-foreground/10 pt-5 text-[15px] leading-relaxed text-foreground/85">{solution.outcome}</p>
        </div>
      </div>
    </article>
  );
}

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title={
          <>
            Start from the result{" "}
            <span className="italic">
              you <PenUnderlined>need.</PenUnderlined>
            </span>
          </>
        }
        footer={<JumpChips label="Jump to a result" chips={JUMP_CHIPS} />}
      >
        Sunleon pairs the conversation with the customer records, orders and bookings it needs to finish the job.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        {SOLUTIONS.map((solution, index) => (
          <SolutionStory key={solution.id} solution={solution} index={index} />
        ))}
      </section>
      <CtaBand />
    </>
  );
}
