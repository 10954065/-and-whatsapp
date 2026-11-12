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
import { FeatureDrawing, type FeatureDrawingName } from "@/components/marketing/feature-drawing";
import { CtaBand, JumpChips, PageHero, PANEL_HOVER, PenUnderlined, TONE_WASH } from "@/components/marketing/marketing-blocks";
import { pageMetadata } from "@/config/seo";
import { TONES } from "@/config/tones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("/features");

interface FeatureGroup {
  id: FeatureDrawingName;
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

/**
 * The assistant spans two columns. Analytics spans two only on tablets, where the other seven leave it alone in its row.
 * Wide cards lay their drawing beside the text, using a container query on the card's own width.
 */
const SPANS: Partial<Record<FeatureDrawingName, string>> = {
  assistant: "sm:col-span-2",
  analytics: "sm:col-span-2 lg:col-span-1",
};

function FeatureCard({ group, index }: { group: FeatureGroup; index: number }) {
  return (
    <article id={group.id} className={cn("group @container scroll-mt-28", group.tone, SPANS[group.id])}>
      <div className={cn(PANEL_HOVER, TONE_WASH, "h-full p-6 pb-7 @xl:flex-row @xl:items-center @xl:gap-10 @xl:p-8")}>
        <FeatureDrawing
          feature={group.id}
          delay={(index % 3) * 0.08}
          className="h-24 w-auto shrink-0 self-start origin-bottom text-foreground motion-safe:group-hover:animate-[wiggle_0.55s_ease-in-out] @xl:h-32 @xl:self-center"
        />
        <div className="mt-6 @xl:mt-0">
          <p className="font-mono text-xs text-foreground/55">{String(index + 1).padStart(2, "0")}</p>
          <h2 className="mt-1 font-display text-3xl font-normal tracking-[-0.01em]">{group.title}</h2>
          <ul className="mt-4 grid gap-2.5 @xl:grid-cols-2 @xl:gap-x-8">
            {group.items.map((item) => (
              <li key={item} className="flex gap-2.5 text-[15px] leading-snug text-foreground/85">
                <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-[color-mix(in_oklch,var(--tone)_55%,var(--ink))]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

const CARD_GROUPS = GROUPS.filter((group) => group.id !== "security");
const SECURITY = GROUPS.find((group) => group.id === "security");

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
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3 lg:py-28">
        {CARD_GROUPS.map((group, index) => (
          <FeatureCard key={group.id} group={group} index={index} />
        ))}
      </section>
      {SECURITY ? (
        <section className="mx-auto max-w-7xl px-6 pb-20">
          <article
            id={SECURITY.id}
            className="grid scroll-mt-28 gap-6 border-t pt-10 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12"
          >
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-sm text-muted-foreground">09</span>
              <h2 className="font-display text-4xl font-normal tracking-[-0.01em]">{SECURITY.title}</h2>
            </div>
            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {SECURITY.items.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-sun" aria-hidden="true" />
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
      <CtaBand />
    </>
  );
}
