import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
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
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet/15 to-azure/15 text-primary ring-1 ring-primary/15">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "violet" | "azure" | "success" | "warning";
}) {
  const toneClass = {
    default: "bg-muted text-foreground",
    violet: "bg-violet/12 text-violet",
    azure: "bg-azure/12 text-azure",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
  }[tone];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[0_1px_0_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-heading text-3xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
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
