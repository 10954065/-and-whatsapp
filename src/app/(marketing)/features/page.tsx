import type { Metadata } from "next";
import { Bot, Boxes, CalendarClock, Inbox, LineChart, Lock, ShoppingBag, Users, Workflow } from "lucide-react";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";

export const metadata: Metadata = { title: "Features" };

const GROUPS = [
  {
    icon: Bot,
    title: "AI employee",
    items: [
      "Natural conversations in your brand's tone",
      "Answers only from your verified business knowledge",
      "Smart model routing keeps routine replies affordable",
      "Escalates to your team when it is unsure or asked",
    ],
  },
  {
    icon: Inbox,
    title: "Unified inbox",
    items: ["WhatsApp and Instagram in one timeline", "Human takeover and hand-back", "Assignment, tags, notes and status", "Customer history beside every chat"],
  },
  {
    icon: Users,
    title: "CRM & leads",
    items: ["Customer profiles with channel identities", "Lead pipeline from new to won", "Follow-up reminders", "Conservative identity matching — no surprise merges"],
  },
  {
    icon: ShoppingBag,
    title: "Orders & payments",
    items: ["Authorised orders created from chat", "Paystack payments verified server-side", "Payment and fulfilment tracked separately", "Discount limits you control"],
  },
  {
    icon: Boxes,
    title: "Products & inventory",
    items: ["Catalogue with variants and SKUs", "Transactional stock updates", "Stock movement history", "Low-stock alerts"],
  },
  {
    icon: CalendarClock,
    title: "Appointments",
    items: ["Services, staff and working hours", "Real availability checks", "Database-level double-booking protection", "Cancellations, rescheduling and reminders"],
  },
  {
    icon: Workflow,
    title: "Automation studio",
    items: ["Triggers for messages, leads, orders, payments and bookings", "Conditions on channel, tags, value and business hours", "Versioned workflows with run history", "Retries and loop prevention"],
  },
  {
    icon: LineChart,
    title: "Analytics",
    items: ["Response times and AI-handled share", "Lead conversion and verified revenue", "Channel performance", "AI token usage and estimated cost"],
  },
  {
    icon: Lock,
    title: "Security & privacy",
    items: ["Strict workspace isolation, enforced in the database", "Encrypted integration credentials", "Two-factor authentication and audit logs", "Designed around Ghana's Data Protection Act"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero eyebrow="Features" title={<>Built to run real conversations — and real operations.</>}>
        Every feature works from your own persisted data. Nothing is simulated, and nothing is guessed.
      </PageHero>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-20 md:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map(({ icon: Icon, title, items }) => (
          <article key={title} className="rounded-3xl border bg-card p-7 transition-shadow hover:shadow-[0_24px_48px_-28px_color-mix(in_oklch,var(--violet)_60%,transparent)]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-bold">{title}</h2>
            <ul className="mt-4 grid gap-2.5 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <CtaBand />
    </>
  );
}
