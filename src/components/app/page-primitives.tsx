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

const TONES = {
  default: "bg-foreground/[0.06] text-foreground/70",
  sun: "bg-sun-soft text-sun-ink",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
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
      <p className="mt-5 text-[2.1rem] leading-none font-semibold tracking-[-0.035em] tabular-nums">{value}</p>
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
