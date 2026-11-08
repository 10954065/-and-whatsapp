import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarClock,
  Hand,
  Inbox,
  LineChart,
  ShieldCheck,
  ShoppingBag,
  Target,
  Workflow,
} from "lucide-react";
import { ConversationPreview, CtaBand } from "@/components/marketing/marketing-blocks";
import { Button } from "@/components/ui/button";
import { INDUSTRY_OPTIONS } from "@/config/industries";

const STEPS = [
  {
    title: "Teach it your business",
    body: "Add your products, prices, opening hours, policies and FAQs — or upload documents. Pick an industry template to start fast.",
  },
  {
    title: "Connect WhatsApp & Instagram",
    body: "Link your accounts through the official Meta platforms. Test every reply in a private sandbox before going live.",
  },
  {
    title: "Let it work — you stay in charge",
    body: "Your AI employee answers, sells and books. You set the rules, approve big decisions and take over any chat in one click.",
  },
];

const GUARDRAILS = [
  "Never invents prices, stock, availability or payment confirmations",
  "Approval required for refunds and exceptional discounts",
  "Daily and monthly AI spending limits per business",
  "Business-hours rules and escalation keywords",
  "Emergency stop and instant human takeover",
  "Full audit trail of every AI action",
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-violet" /> AI employee for WhatsApp & Instagram
            </p>
            <h1 className="mt-6 text-[2.75rem] leading-[1.03] font-extrabold sm:text-6xl lg:text-[4.25rem]">
              Hire an AI employee that <span className="text-gradient">never misses</span> a customer.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              SUNLEON AI answers enquiries, qualifies leads, takes authorised orders and bookings, and follows up —
              using only what your business has taught it.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-[15px] shadow-[0_14px_32px_-12px_var(--violet)]">
                <Link href="/register">
                  Start your free trial <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[15px]">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">14-day free trial · No card required · Priced in Ghana cedis</p>
          </div>
          <ConversationPreview className="mx-auto w-full max-w-md lg:max-w-none" />
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">How it works</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Live in an afternoon. Trusted for years.</h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border bg-card p-6">
                <span className="font-heading text-5xl font-extrabold text-primary/15">0{index + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">One platform</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Everything your front desk, sales team and shop assistant do.</h2>
          </div>
          <Button asChild variant="link" className="px-0">
            <Link href="/features">
              Explore all features <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-12 grid auto-rows-[minmax(11rem,auto)] gap-4 md:grid-cols-6">
          <article className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-violet/10 via-card to-card p-7 md:col-span-4 md:row-span-2">
            <Inbox className="size-6 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold">One inbox for every conversation</h3>
            <p className="mt-2 max-w-md text-muted-foreground">
              WhatsApp and Instagram messages land in one place, with the customer&apos;s orders, bookings and notes beside
              each chat. See what the AI did, assign chats, and take over instantly.
            </p>
            <div className="mt-8 grid max-w-md gap-2">
              {["Efua A. · WhatsApp · Order #1042 created", "Kojo M. · Instagram · Viewing booked Sat 10:00", "Ama K. · WhatsApp · Escalated to you"].map(
                (row) => (
                  <div key={row} className="rounded-xl border bg-background/80 px-4 py-2.5 text-sm">
                    {row}
                  </div>
                ),
              )}
            </div>
          </article>
          {[
            { icon: BookOpenCheck, title: "Grounded answers", body: "Replies come from your knowledge base, products and policies — with sources checked." },
            { icon: ShoppingBag, title: "Orders & stock", body: "Real-time stock checks and transactional orders. Payment is only marked paid after Paystack verifies it." },
            { icon: CalendarClock, title: "Bookings", body: "Checks real staff availability, prevents double bookings and sends reminders." },
            { icon: Target, title: "Leads & follow-ups", body: "Captures buying intent, tags leads and schedules follow-ups automatically." },
            { icon: Workflow, title: "Automation studio", body: "Visual workflows for new leads, payments, bookings and follow-ups — with loop protection." },
            { icon: LineChart, title: "Real analytics", body: "Response times, AI-handled chats, conversions and verified revenue from your actual data." },
          ].map(({ icon: Icon, title, body }, index) => (
            <article key={title} className={`rounded-3xl border bg-card p-6 ${index < 2 ? "md:col-span-2" : "md:col-span-2"}`}>
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6">
        <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border bg-card p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-bold">Autonomous where it&apos;s safe. Accountable everywhere.</h2>
            <p className="mt-3 text-muted-foreground">
              You decide what your AI employee may do on its own. High-impact actions wait for a human, and every
              action is recorded.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                <Bot className="size-4 text-primary" /> AI handles routine work
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                <Hand className="size-4 text-primary" /> You approve the big calls
              </span>
            </div>
          </div>
          <ul className="grid content-center gap-3">
            {GUARDRAILS.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border bg-background px-4 py-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Industries</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Templates for how your business really works.</h2>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          {INDUSTRY_OPTIONS.map((industry) => (
            <Link
              key={industry.value}
              href="/industries"
              className="rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              {industry.label}
            </Link>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
