import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Lock } from "lucide-react";
import { HANDOVER_SCRIPT } from "@/components/marketing/chat-scripts";
import { ChatShowcase, LoopingChat } from "@/components/marketing/chat-showcase";
import { HandDrawnUnderline } from "@/components/marketing/hand-drawn-underline";
import { CtaBand } from "@/components/marketing/marketing-blocks";
import { ReceiptStory } from "@/components/marketing/receipt-story";
import { Button } from "@/components/ui/button";
import { INDUSTRY_OPTIONS } from "@/config/industries";
import { organizationJsonLd, pageMetadata } from "@/config/seo";
import { env } from "@/lib/env";

export const metadata: Metadata = pageMetadata("/");

const CAPABILITIES = [
  { title: "One inbox for both apps", body: "WhatsApp and Instagram in one list, with each customer's orders, bookings and notes beside the chat. Take over any conversation with one tap." },
  { title: "Orders and stock", body: "Live stock checks, real order numbers and payment links. An order is marked paid only after Paystack verifies it." },
  { title: "Bookings", body: "Checks real staff hours and existing appointments, so two customers never get the same slot. Reminders go out on their own." },
  { title: "Leads and follow-ups", body: "Notices when someone is ready to buy, tags them, and reminds your team to follow up before they go cold." },
  { title: "Automations", body: "Simple rules for new leads, payments and bookings, with versions you can roll back and loop protection built in." },
  { title: "Numbers you can trust", body: "Response times, conversations handled, conversions and verified revenue, all counted from your own records." },
];

const RULES: Array<{ label: string; value: "on" | "off" | "locked" | string }> = [
  { label: "Never quote a price that isn't in my list", value: "locked" },
  { label: "Ask me before any refund or big discount", value: "on" },
  { label: "Hand over when a customer is upset", value: "on" },
  { label: "Reply only during opening hours", value: "off" },
  { label: "Daily spending limit", value: "GH₵ 20" },
];

function RuleValue({ value }: { value: string }) {
  if (value === "locked") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-white/45">
        <Lock className="size-3.5" aria-hidden="true" /> Always on
      </span>
    );
  }
  if (value === "on" || value === "off") {
    const isOn = value === "on";
    return (
      <span className={`flex h-6 w-[42px] shrink-0 items-center rounded-full p-0.5 ${isOn ? "bg-[#34c759]" : "bg-white/15"}`}>
        <span className={`size-5 rounded-full bg-white shadow-sm ${isOn ? "translate-x-[18px]" : ""}`} />
        <span className="sr-only">{isOn ? "On" : "Off"}</span>
      </span>
    );
  }
  return <span className="text-[13px] text-white/55 tabular-nums">{value}</span>;
}

export default function HomePage() {
  // Static data from our own config; "<" is escaped so the JSON can never close the script tag.
  const structuredData = JSON.stringify(organizationJsonLd(env().APP_URL)).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <section className="grain relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute top-24 right-[-14rem] hidden size-[46rem] rounded-full bg-sun-soft lg:block" />
        <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-28 left-1/2 hidden h-px bg-foreground/10 lg:block" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pt-14 pb-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 lg:pt-20 lg:pb-28">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="size-2 rounded-full bg-sun" aria-hidden="true" />
              For shops, salons, clinics and agents across Ghana
            </p>
            <h1 className="mt-7 font-display text-[3.6rem] leading-[0.92] font-normal tracking-[-0.02em] sm:text-[5rem] lg:text-[6rem]">
              The front desk that{" "}
              <span className="relative inline-block italic text-sun-ink">
                never closes.
                <HandDrawnUnderline className="absolute -bottom-2 left-0 w-full text-sun" />
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Sunleon replies to your customers on WhatsApp and Instagram within seconds, using your real prices, stock
              and opening hours. It takes orders and bookings, and passes anything tricky to you.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <Link href="/register">
                  Start your free trial <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 px-5">
                <Link href="#how-it-works">See how a sale happens</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">14 days free · No card needed · Priced in cedis</p>
          </div>
          <ChatShowcase className="lg:pl-64 xl:pl-72" />
        </div>
      </section>

      <section aria-label="Where it works" className="border-y bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-10 gap-y-3 px-6 py-6 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Works where your customers already are</span>
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#25d366]" aria-hidden="true" />WhatsApp Business</span>
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#e1306c]" aria-hidden="true" />Instagram messages</span>
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#0ba4db]" aria-hidden="true" />Paystack: MoMo and card</span>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-16">
        <div className="mx-auto max-w-7xl px-6 pt-24 lg:pt-32">
          <h2 className="max-w-3xl font-display text-5xl leading-[0.98] font-normal tracking-[-0.015em] sm:text-6xl">
            How a message <span className="italic">becomes a sale.</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">Follow one order from the first hello to the delivery run.</p>
          <div className="mt-6 lg:-mt-10">
            <ReceiptStory />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
        <div className="flex flex-col justify-between gap-6 border-b pb-10 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-5xl leading-[0.98] font-normal tracking-[-0.015em] sm:text-6xl">
            Everything your front desk does, <span className="italic">done properly.</span>
          </h2>
          <Link href="/features" className="link-underline inline-flex items-center gap-1.5 text-sm font-medium">
            All features <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ol>
          {CAPABILITIES.map((capability, index) => (
            <li key={capability.title} className="group grid gap-3 border-b py-8 md:grid-cols-[5rem_minmax(0,22rem)_1fr] md:items-baseline md:gap-8">
              <span className="font-mono text-sm text-muted-foreground transition-colors group-hover:text-sun-ink">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-3xl font-normal tracking-[-0.01em] transition-transform duration-300 ease-out-strong group-hover:translate-x-1.5 sm:text-4xl">
                {capability.title}
              </h3>
              <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">{capability.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="in-charge" className="scroll-mt-16 px-3 sm:px-6">
        <div className="grain relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#1d1a16] px-6 py-20 text-[#f3efe7] sm:px-12 lg:px-16 lg:py-24">
          <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="max-w-xl">
              <h2 className="font-display text-5xl leading-[0.98] font-normal tracking-[-0.015em] sm:text-6xl">
                Busy is fine. <span className="italic text-[#f6b383]">You stay in charge.</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-white/65">
                You decide what Sunleon may do on its own. Refunds, complaints and anything unusual come straight to a
                person, and every action is written down so you can see exactly what happened.
              </p>
              <figure aria-label="Example rules a business can set" className="mt-10 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                <ul className="divide-y divide-white/10">
                  {RULES.map((rule) => (
                    <li key={rule.label} className="flex items-center justify-between gap-4 px-5 py-3.5 text-[15px]">
                      {rule.label}
                      <RuleValue value={rule.value} />
                    </li>
                  ))}
                </ul>
              </figure>
            </div>
            <LoopingChat
              script={HANDOVER_SCRIPT}
              className="mx-auto lg:mr-64 xl:mr-72"
              activityClassName="lg:absolute lg:top-28 lg:left-full lg:ml-8 [&_li]:bg-white/90 [&_li]:text-[#1d1a16] [&_p]:text-[#1d1a16] [&_p:last-child]:text-[#1d1a16]/60"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
        <h2 className="text-sm font-medium text-muted-foreground">Ready-made setups for</h2>
        <ul className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {INDUSTRY_OPTIONS.filter((industry) => industry.value !== "GENERAL").map((industry, index, list) => (
            <li key={industry.value} className="flex items-baseline gap-5">
              <Link
                href="/industries"
                className="font-display text-4xl leading-tight tracking-[-0.01em] transition-colors duration-200 hover:text-sun-ink hover:italic sm:text-5xl lg:text-6xl"
              >
                {industry.label}
              </Link>
              {index < list.length - 1 ? <span className="size-2 translate-y-[-0.5rem] rounded-full bg-sun" aria-hidden="true" /> : null}
            </li>
          ))}
        </ul>
      </section>

      <CtaBand />
    </>
  );
}
