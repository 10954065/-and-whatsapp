import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, CalendarCheck, PackageCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-violet/15 blur-[120px]" />
      <div className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-24">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-4 text-4xl leading-[1.08] font-extrabold sm:text-5xl">{title}</h1>
        {children ? <div className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{children}</div> : null}
      </div>
    </section>
  );
}

export function CtaBand({ title = "Give every customer a fast, accurate answer.", body }: { title?: string; body?: string }) {
  return (
    <section className="px-6 py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-navy px-8 py-14 text-white sm:px-14">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute -right-20 -bottom-32 size-[420px] rounded-full bg-violet/50 blur-[110px]" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl leading-tight font-bold sm:text-4xl">{title}</h2>
            <p className="mt-3 text-white/70">
              {body ?? "Start a 14-day free trial. Set up your business, teach your AI employee, and test it before a single customer sees it."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 bg-white px-5 text-navy hover:bg-white/90">
              <Link href="/register">
                Start free trial <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-11 px-5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface Bubble {
  from: "customer" | "ai";
  text: string;
}

const BUBBLES: Bubble[] = [
  { from: "customer", text: "Hi! Do you still have the kente-print midi dress in size M?" },
  { from: "ai", text: "Good afternoon! Yes — 3 left in size M at GH₵ 450. Would you like delivery in Accra or pick-up at East Legon?" },
  { from: "customer", text: "Delivery to Osu please, I'll pay with MoMo." },
  { from: "ai", text: "Done ✨ I've created order #1042. Your Paystack payment link is on the way — I'll confirm as soon as the payment is verified." },
];

const ACTIONS = [
  { icon: PackageCheck, label: "Checked stock", detail: "Midi dress · M · 3 in stock" },
  { icon: ShoppingBag, label: "Created order #1042", detail: "Awaiting verified payment" },
  { icon: CalendarCheck, label: "Follow-up scheduled", detail: "If unpaid in 2 hours" },
];

/** Product illustration for the marketing hero (static, clearly decorative content). */
export function ConversationPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("relative", className)} aria-label="Illustration of the AI employee handling a WhatsApp order">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-linear-to-tr from-violet/25 via-azure/15 to-transparent blur-3xl" />
      <div className="relative rounded-[1.75rem] border bg-card/90 p-4 shadow-[0_40px_80px_-30px_color-mix(in_oklch,var(--navy)_45%,transparent)] backdrop-blur sm:p-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#25D366]/15 text-sm font-bold text-[#128C7E]">EA</span>
            <div>
              <p className="text-sm font-semibold">Efua A.</p>
              <p className="text-xs text-muted-foreground">WhatsApp · handled by Ama (AI)</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" /> AI active
          </span>
        </div>
        <ol className="grid gap-2.5 py-4">
          {BUBBLES.map((bubble, index) => (
            <li
              key={index}
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5",
                bubble.from === "customer"
                  ? "justify-self-start rounded-bl-md bg-muted"
                  : "justify-self-end rounded-br-md bg-primary text-primary-foreground",
              )}
            >
              {bubble.text}
            </li>
          ))}
        </ol>
        <div className="grid gap-2 rounded-2xl border border-dashed bg-muted/40 p-3">
          {ACTIONS.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-center gap-3 text-xs">
              <span className="flex size-7 items-center justify-center rounded-lg bg-background text-primary ring-1 ring-border">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="font-semibold">{label}</span>
              <span className="ml-auto text-muted-foreground">{detail}</span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" /> Prices, stock and payments come from your real records — never guessed.
      </figcaption>
    </figure>
  );
}
