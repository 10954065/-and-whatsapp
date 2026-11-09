import Link from "next/link";
import { cn } from "@/lib/utils";

/** The sunrise mark: a sun clearing the horizon. Fixed colours so it reads the same on every surface. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="#1d1a16" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#ffffff" strokeOpacity="0.08" />
      <path d="M8 19.5a8 8 0 0 1 16 0Z" fill="#ef6b1f" />
      <rect x="7" y="21.75" width="18" height="2" rx="1" fill="#ef6b1f" fillOpacity="0.6" />
      <rect x="10.5" y="25.25" width="11" height="2" rx="1" fill="#ef6b1f" fillOpacity="0.32" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  inverted = false,
}: {
  href?: string;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group/logo inline-flex items-center gap-2.5 rounded-lg outline-offset-4", className)}
      aria-label="SUNLEON AI home"
    >
      <LogoMark className="transition-transform duration-300 ease-(--ease-out-strong) group-hover/logo:-rotate-6" />
      <span className="flex items-baseline gap-1">
        <span className={cn("font-display text-[1.45rem] leading-none", inverted ? "text-white" : "text-foreground")}>
          Sunleon
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold tracking-[0.08em]",
            inverted ? "text-white/55" : "text-muted-foreground",
          )}
        >
          AI
        </span>
      </span>
    </Link>
  );
}
