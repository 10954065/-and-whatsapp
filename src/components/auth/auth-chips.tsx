import { cn } from "@/lib/utils";

const DOTS = {
  whatsapp: "bg-[#25d366]",
  instagram: "bg-[#e1306c]",
  sun: "bg-sun",
  violet: "bg-[#8b5cf6]",
} as const;

export interface AuthChip {
  label: string;
  tone: keyof typeof DOTS;
}

/** Small coloured facts under a sign-in heading, such as the channels SUNLEON AI answers on. */
export function AuthChips({ chips, className }: { chips: AuthChip[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((chip) => (
        <li key={chip.label} className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground/80">
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOTS[chip.tone])} />
          {chip.label}
        </li>
      ))}
    </ul>
  );
}
