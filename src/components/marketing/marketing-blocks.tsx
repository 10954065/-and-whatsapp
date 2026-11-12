import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { HandDrawnUnderline } from "@/components/marketing/hand-drawn-underline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A card panel that lifts a little under the pointer; hover only fires on devices that can hover. Put `group` on its parent. */
export const PANEL_HOVER =
  "flex flex-col rounded-[1.75rem] transition-[translate,box-shadow,border-color] duration-300 ease-(--ease-out-strong) group-hover:shadow-(--shadow-soft) motion-safe:group-hover:-translate-y-1";

/** A paper card washed in the --tone around it; dark mode uses less of the tone. */
export const TONE_WASH = "bg-[color-mix(in_oklch,var(--tone)_17%,var(--paper))] dark:bg-[color-mix(in_oklch,var(--tone)_11%,var(--paper))]";

/** A word in a hero title with a pen stroke drawn under it. Keep it to one word so it never needs to wrap. */
export function PenUnderlined({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <HandDrawnUnderline className="absolute -bottom-1.5 left-0 w-full text-sun" />
    </span>
  );
}

export interface JumpChip {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A class from TONES that sets --tone for the icon's circle. */
  tone: string;
}

/** Chips that jump to sections further down the page. */
export function JumpChips({ label, chips }: { label: string; chips: readonly JumpChip[] }) {
  return (
    <nav aria-label={label}>
      {/* One row that scrolls sideways on phones, so the content stays near the top; wraps from sm up. */}
      <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {chips.map(({ href, label: chipLabel, icon: Icon, tone }) => (
          <li key={href} className="shrink-0">
            <a
              href={href}
              className={cn(
                "pressable inline-flex h-9 items-center gap-2 rounded-full bg-card/75 py-1 pr-3.5 pl-1.5 text-sm font-medium shadow-(--shadow-hairline) hover:bg-card",
                tone,
              )}
            >
              <span className="grid size-6 place-items-center rounded-full bg-(--tone) text-[#1d1a16] dark:text-foreground">
                <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
              </span>
              {chipLabel}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHero({ eyebrow, title, children, footer }: { eyebrow: string; title: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  return (
    <section className="grain relative overflow-hidden border-b">
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 -right-40 size-136 rounded-full bg-sun-soft" />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-sun" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[0.98] font-normal tracking-[-0.018em] sm:text-7xl">{title}</h1>
        {children ? <div className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{children}</div> : null}
        {footer ? <div className="mt-10">{footer}</div> : null}
      </div>
    </section>
  );
}

export function CtaBand({
  title = "Open all hours, without the overtime.",
  body,
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="px-3 pt-8 pb-24 sm:px-6">
      <div className="grain relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-sun px-6 py-16 text-[#1d1a16] sm:px-12 lg:px-16 lg:py-20">
        <svg aria-hidden="true" viewBox="0 0 400 200" className="pointer-events-none absolute -right-10 -bottom-6 w-120 max-w-[80%] text-[#1d1a16]/12">
          <path d="M40 200a160 160 0 0 1 320 0Z" fill="currentColor" />
          <rect x="10" y="150" width="380" height="10" rx="5" fill="#f3efe7" fillOpacity="0.5" />
          <rect x="60" y="174" width="280" height="10" rx="5" fill="#f3efe7" fillOpacity="0.35" />
        </svg>
        <div className="relative max-w-2xl">
          <h2 className="font-display text-5xl leading-[0.98] font-normal tracking-[-0.015em] sm:text-6xl">{title}</h2>
          <p className="mt-5 max-w-lg text-lg text-[#1d1a16]/75">
            {body ?? "Try it free for 14 days. Teach it your business, test every reply in private, and switch it on when you're happy."}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 bg-[#1d1a16] px-6 text-[#f3efe7] hover:bg-[#1d1a16]/88 dark:bg-[#1d1a16] dark:text-[#f3efe7]">
              <Link href="/register">
                Start free trial <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 px-5 text-[#1d1a16] hover:bg-[#1d1a16]/10 hover:text-[#1d1a16]">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
