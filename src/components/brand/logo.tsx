import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id="sunleon-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d4bff" />
          <stop offset="1" stopColor="#2f7bff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sunleon-mark)" />
      <path d="M8.5 21a7.5 7.5 0 0 1 15 0" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M16 7.5v3M9 10.6l2 2M23 10.6l-2 2" stroke="white" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.3" fill="white" />
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
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="SUNLEON AI home">
      <LogoMark />
      <span
        className={cn(
          "font-heading text-[15px] font-extrabold tracking-[0.14em]",
          inverted ? "text-white" : "text-foreground",
        )}
      >
        SUNLEON<span className="text-violet"> AI</span>
      </span>
    </Link>
  );
}
