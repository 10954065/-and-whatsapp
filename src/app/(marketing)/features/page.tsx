import type { Metadata } from "next";
import {
  Bot,
  CalendarCheck,
  ChartColumn,
  ContactRound,
  Inbox,
  type LucideIcon,
  Package,
  ReceiptText,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { CtaBand, JumpChips, PageHero, PenUnderlined } from "@/components/marketing/marketing-blocks";
import { pageMetadata } from "@/config/seo";
import { TONES } from "@/config/tones";

export const metadata: Metadata = pageMetadata("/features");

interface FeatureGroup {
  id: string;
  title: string;
  /** The shorter name on the jump chip. */
  chip: string;
  icon: LucideIcon;
  tone: string;
  items: string[];
}

const GROUPS: FeatureGroup[] = [
  {
    id: "assistant",
    title: "The assistant",
    chip: "Assistant",
    icon: Bot,
    tone: TONES.sun,
    items: [
      "Natural conversations in your brand's tone",
      "Answers only from your verified business knowledge",
      "Smart model routing keeps routine replies affordable",
      "Escalates to your team when it is unsure or asked",
    ],
  },
  {
    id: "inbox",
    title: "Unified inbox",
    chip: "Inbox",
    icon: Inbox,
    tone: TONES.mint,
    items: ["WhatsApp and Instagram in one timeline", "Human takeover and hand-back", "Assignment, tags, notes and status", "Customer history beside every chat"],
  },
  {
    id: "crm",
    title: "CRM & leads",
    chip: "CRM & leads",
    icon: ContactRound,
    tone: TONES.lilac,
    items: ["Customer profiles with channel identities", "Lead pipeline from new to won", "Follow-up reminders", "Careful identity matching, so no surprise merges"],
  },
  {
    id: "orders",
    title: "Orders & payments",
    chip: "Orders",
    icon: ReceiptText,
    tone: TONES.gold,
    items: ["Authorised orders created from chat", "Paystack payments verified server-side", "Payment and fulfilment tracked separately", "Discount limits you control"],
  },
  {
    id: "products",
    title: "Products & inventory",
    chip: "Products",
    icon: Package,
    tone: TONES.clay,
    items: ["Catalogue with variants and SKUs", "Transactional stock updates", "Stock movement history", "Low-stock alerts"],
  },
  {
    id: "appointments",
    title: "Appointments",
    chip: "Appointments",
    icon: CalendarCheck,
    tone: TONES.rose,
    items: ["Services, staff and working hours", "Real availability checks", "Database-level double-booking protection", "Cancellations, rescheduling and reminders"],
  },
  {
    id: "automation",
    title: "Automation studio",
    chip: "Automation",
    icon: Workflow,
    tone: TONES.sky,
    items: ["Triggers for messages, leads, orders, payments and bookings", "Conditions on channel, tags, value and business hours", "Versioned workflows with run history", "Retries and loop prevention"],
  },
  {
    id: "analytics",
    title: "Analytics",
    chip: "Analytics",
    icon: ChartColumn,
    tone: TONES.indigo,
    items: ["Response times and AI-handled share", "Lead conversion and verified revenue", "Channel performance", "AI token usage and estimated cost"],
  },
  {
    id: "security",
    title: "Security & privacy",
    chip: "Security",
    icon: ShieldCheck,
    tone: TONES.teal,
    items: ["Strict workspace isolation, enforced in the database", "Encrypted integration credentials", "Two-factor authentication and audit logs", "Designed around Ghana's Data Protection Act"],
  },
];

const JUMP_CHIPS = GROUPS.map((group) => ({ href: `#${group.id}`, label: group.chip, icon: group.icon, tone: group.tone }));

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title={
          <>
            Built to run real conversations{" "}
            <span className="italic">
              and real <PenUnderlined>operations.</PenUnderlined>
            </span>
          </>
        }
        footer={<JumpChips label="Jump to a feature" chips={JUMP_CHIPS} />}
      >
        Every feature works from your own saved records. Nothing is simulated, and nothing is guessed.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        {GROUPS.map(({ id, title, items }, index) => (
          <article
            key={id}
            id={id}
            className="grid scroll-mt-28 gap-6 border-t py-10 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12"
          >
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="font-display text-4xl font-normal tracking-[-0.01em]">{title}</h2>
            </div>
            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-sun" aria-hidden="true" />
                  <span className="text-foreground/85">{item}</span>
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
