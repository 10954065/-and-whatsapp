import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Lock, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** iOS-style large title with an optional context line above it. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-2">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-sun" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.032em] sm:text-[2.35rem]">{title}</h1>
        {description ? <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-foreground/15 px-6 py-14 text-center", className)}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-sun-soft text-sun-ink">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Icons are neutral; a tone is a state (something needs attention), never decoration. */
const TONES = {
  default: "bg-foreground/[0.06] text-foreground/70",
  warning: "bg-warning/15 text-warning",
} as const;

/** A widget-style number: label, large figure, optional hint, optionally a link. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={cn("flex size-8 items-center justify-center rounded-full", TONES[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {href ? <ChevronRight className="size-4 text-foreground/30 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
      </div>
      <p className="mt-5 text-[2.1rem] leading-none font-semibold tracking-[-0.035em]">{value}</p>
      <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">{label}</p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );
  const className = "surface group block rounded-[1.25rem] p-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(className, "pressable transition-shadow hover:shadow-[var(--shadow-hairline),var(--shadow-lifted)]")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * Key numbers as one card split by hairlines: the container shows through 1px gaps.
 * Two columns on phones (the odd last cell spans both), one row from lg up.
 */
export function MetricStrip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] bg-border shadow-[var(--shadow-hairline),var(--shadow-soft)] lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1"
    >
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  icon: Icon,
  href,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  href?: string;
  /** A short line under the figure, e.g. "0 suspended · 103 total". */
  hint?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icon className="hidden size-4 shrink-0 text-foreground/40 sm:block" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {href ? (
          <ChevronRight
            className="hidden size-4 shrink-0 text-foreground/25 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-foreground/60 sm:block"
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span className="mt-3 block text-[2rem] leading-none font-semibold tracking-[-0.035em]">{value}</span>
      {hint ? <span className="mt-2 block truncate text-xs text-muted-foreground">{hint}</span> : null}
    </>
  );
  const className = "group block bg-card px-4 pt-4 pb-5 sm:px-5";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors duration-150 outline-none hover:bg-[color-mix(in_oklch,var(--card),var(--foreground)_3%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A headed card for a list or a form. `aside` sits at the right of the header (a count, a button). */
export function Panel({
  title,
  href,
  linkLabel,
  aside,
  children,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface flex h-full min-w-0 flex-col overflow-hidden rounded-[1.25rem]", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside}
        {href ? (
          <Link
            href={href}
            className="-mr-1.5 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {linkLabel ?? "See all"} <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function PanelEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2.5 px-6 pt-1 pb-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-foreground/5 text-foreground/45">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** A state shown as a coloured dot beside its label: colour never stands alone. */
export function StatusLabel({ dot, label, className }: { dot: string; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] text-muted-foreground", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

export function AccessDenied({ what = "this page" }: { what?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access"
      description={`Your role in this workspace doesn't include access to ${what}. Ask an owner or admin if you need it.`}
      action={
        <Button asChild variant="outline">
          <Link href="/app/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
