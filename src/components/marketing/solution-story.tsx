"use client";

import type { ReactNode } from "react";
import { motion, stagger, useReducedMotion, type Variants } from "motion/react";
import { LogoMark } from "@/components/brand/logo";
import { Ambient, Line, PAPER, PenDrawing, ring, Shape } from "@/components/marketing/pen-drawing";
import { cn } from "@/lib/utils";

export type ProblemDrawingName = "sell" | "support" | "bookings" | "leads";

/** A small question mark centred on (cx, cy). */
const question = (cx: number, cy: number) => `M${cx - 2.5} ${cy - 2.5}a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M${cx} ${cy + 4}v.2`;

const PROBLEMS: Record<ProblemDrawingName, () => ReactNode> = {
  // A phone full of unanswered questions, and the clock running.
  sell: () => (
    <>
      <Shape d="M58 12H102a8 8 0 0 1 8 8V84a8 8 0 0 1-8 8H58a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Line d="M74 19H86" />
      <Shape d="M62 28h28a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4Z" />
      <Line d="M63 35H84" />
      <Shape d="M62 48h22a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4Z" />
      <Line d="M63 55H78" />
      <Shape d="M62 68h32a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4Z" />
      <Line d="M63 75H90" />
      <Shape d={ring(106, 16, 8)} />
      <Line d="M106 12V16.5M106 20V20.2" />
      <Shape d={ring(130, 70, 14)} fill={PAPER} />
      <Line d="M130 61V70L136 74" />
    </>
  ),
  // The same question, again and again, late into the night.
  support: () => (
    <>
      <Line d="M128 14A11 11 0 1 0 141 28A9 9 0 0 1 128 14ZM146 40L147 43L150 44L147 45L146 48L145 45L142 44L145 43Z" />
      <Shape d="M36 20H72a8 8 0 0 1 8 8v4a8 8 0 0 1-8 8H44l-8 7v-7a8 8 0 0 1-8-8v-4a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Line d={`${question(40, 30)}M50 30H72`} />
      <Shape d="M54 44H90a8 8 0 0 1 8 8v4a8 8 0 0 1-8 8H62l-8 7v-7a8 8 0 0 1-8-8v-4a8 8 0 0 1 8-8Z" />
      <Line d={`${question(58, 54)}M68 54H90`} />
      <Shape d="M72 68H108a8 8 0 0 1 8 8v4a8 8 0 0 1-8 8H80l-8 7v-7a8 8 0 0 1-8-8v-4a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Line d={`${question(76, 78)}M86 78H108`} />
    </>
  ),
  // Two bookings in one slot, and messages bouncing back and forth.
  bookings: () => (
    <>
      <Shape d="M32 22H86a6 6 0 0 1 6 6V82a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Shape d="M32 22H86a6 6 0 0 1 6 6V36H26V28a6 6 0 0 1 6-6Z" />
      <Line d="M40 16V28M78 16V28M34 48H44M54 48H64M74 48H84M34 78H44M54 78H64M74 78H84M34 63H42" />
      <Shape d="M48 56h16v10H48Z" />
      <Shape d="M55 61h16v10H55Z" />
      <Ambient kind="twinkle">
        <Line d="M76 55l4-3M78 63h5M76 71l4 3" />
      </Ambient>
      <Shape d="M104 26h30a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6h-30a6 6 0 0 1-6-6v-4a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Line d="M106 34H126" />
      <Line d="M114 45V53M110 49L114 53L118 49M130 53V45M126 49L130 45L134 49" />
      <Shape d="M108 56h30a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6h-30a6 6 0 0 1-6-6v-4a6 6 0 0 1 6-6Z" />
      <Line d="M112 64H132M114 82V82.2M121 82V82.2M128 82V82.2" />
    </>
  ),
  // A long list of chats, and one interested customer slipping out of it.
  leads: () => (
    <>
      <Shape d="M36 10H92a6 6 0 0 1 6 6V86a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Line
        d={`${ring(40, 20, 3.5)}M48 20H86${ring(40, 32, 3.5)}M48 32H78${ring(40, 56, 3.5)}M48 56H84${ring(40, 68, 3.5)}M48 68H74${ring(40, 80, 3.5)}M48 80H82`}
      />
      <Line d="M96 44l6 2M96 50l5 4" />
      <g transform="rotate(14 120 58)">
        <Shape d="M106 50h30a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5h-30a5 5 0 0 1-5-5v-4a5 5 0 0 1 5-5Z" />
        <Line d={`${ring(110, 57, 3.5)}M117 57H134`} />
      </g>
      <Ambient kind="twinkle">
        <Line d="M136 30L137.5 34.5L142 36L137.5 37.5L136 42L134.5 37.5L130 36L134.5 34.5Z" />
      </Ambient>
    </>
  ),
};

/** How a business gets by today, drawn in grey. */
export function ProblemDrawing({ problem, className }: { problem: ProblemDrawingName; className?: string }) {
  const Drawing = PROBLEMS[problem];
  return (
    <PenDrawing className={cn("[--tone:color-mix(in_oklch,var(--foreground)_13%,var(--paper))]", className)}>
      <Drawing />
    </PenDrawing>
  );
}

/** A hand-drawn arrow from "Today" to "With Sunleon". It points down when the two are stacked. */
export function PenArrow({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg viewBox="0 0 80 40" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <motion.path
        d="M5 26C20 9 45 6 70 18M59 9L71 18L58 23"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}

export interface ExampleChatScript {
  customer: string;
  /** What Sunleon did behind the scenes, in order. */
  steps: Array<{ title: string; detail: string }>;
  reply: string;
}

const CHAT: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(0.35, { startDelay: 0.4 }) } },
};
const LINE: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.25, duration: 0.5 } },
};

/** A short example conversation that plays in, one line at a time, the first time it scrolls into view. */
export function ExampleChat({ script }: { script: ExampleChatScript }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.ol
      aria-label="Example conversation"
      variants={CHAT}
      initial={shouldReduceMotion ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "-80px" }}
      className="grid gap-2.5"
    >
      <motion.li
        variants={LINE}
        style={{ originX: 0 }}
        className="w-fit max-w-[88%] rounded-[18px] rounded-bl-[6px] bg-card px-4 py-2.5 text-[15px] leading-snug shadow-(--shadow-hairline)"
      >
        <span className="sr-only">Customer: </span>
        {script.customer}
      </motion.li>
      {script.steps.map((step) => (
        <motion.li
          key={step.title}
          variants={LINE}
          className="flex w-fit max-w-full items-center gap-2.5 rounded-2xl bg-card/70 py-1.5 pr-3.5 pl-1.5 shadow-(--shadow-hairline)"
        >
          <LogoMark className="size-6 rounded-[7px]" />
          <span className="text-[13px] leading-snug">
            <span className="font-semibold">{step.title}</span>
            <span className="text-muted-foreground"> · {step.detail}</span>
          </span>
        </motion.li>
      ))}
      <motion.li
        variants={LINE}
        style={{ originX: 1 }}
        className="ml-auto w-fit max-w-[88%] rounded-[18px] rounded-br-[6px] bg-[color-mix(in_oklch,var(--tone)_38%,var(--card))] px-4 py-2.5 text-[15px] leading-snug shadow-(--shadow-hairline) dark:bg-[color-mix(in_oklch,var(--tone)_45%,var(--card))]"
      >
        <span className="sr-only">Sunleon: </span>
        {script.reply}
      </motion.li>
    </motion.ol>
  );
}
