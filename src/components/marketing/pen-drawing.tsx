"use client";

import { type ReactNode, useId } from "react";
import { motion, stagger, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const EASE_PEN = [0.65, 0, 0.35, 1] as const;

const SCENE: Variants = {
  hidden: {},
  shown: (delay: number) => ({ transition: { delayChildren: stagger(0.05, { startDelay: delay }) } }),
};
const INK: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  shown: { pathLength: 1, opacity: 1, transition: { duration: 0.75, ease: EASE_PEN } },
};
const WASH: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.45, delay: 0.35 } },
};

/** A closed circle path, so circles draw in like any other line. */
export const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** The card colour, for shapes that read as paper. */
export const PAPER = "var(--card)";

export function Line({ d }: { d: string }) {
  return <motion.path d={d} variants={INK} />;
}

/** A shape washed in a colour (the surrounding --tone unless told otherwise), then outlined in ink. */
export function Shape({ d, fill = "var(--tone)" }: { d: string; fill?: string }) {
  return (
    <>
      <motion.path d={d} fill={fill} stroke="none" variants={WASH} />
      <Line d={d} />
    </>
  );
}

/**
 * A dotted path that draws in like a pen line. The dots can't animate their own length, so a solid
 * copy of the path, drawn in, masks them.
 */
export function Trail({ d }: { d: string }) {
  const maskId = useId();
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
        <motion.path d={d} stroke="white" strokeWidth={8} variants={INK} />
      </mask>
      <path d={d} strokeDasharray="0.5 7" mask={`url(#${maskId})`} />
    </>
  );
}

/** A word written on the drawing, faded in with the colour wash. */
export function Label({ x, y, children, anchor = "start" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <motion.text x={x} y={y} textAnchor={anchor} fill="currentColor" stroke="none" fontSize={17} className="font-display italic" variants={WASH}>
      {children}
    </motion.text>
  );
}

/** A soft shadow on the ground under a drawing. */
export function Ground() {
  return <motion.path d="M22 92a58 3.5 0 1 0 116 0a58 3.5 0 1 0 -116 0Z" fill="currentColor" fillOpacity={0.07} stroke="none" variants={WASH} />;
}

/** Steam and sparkles keep moving after the drawing is done, unless the visitor prefers less motion. */
export function Ambient({ children, kind }: { children: ReactNode; kind: "steam" | "twinkle" }) {
  const animation = kind === "steam" ? "motion-safe:animate-[steam_2.8s_ease-in-out_infinite]" : "motion-safe:animate-[twinkle_2.4s_ease-in-out_infinite]";
  return <g className={animation}>{children}</g>;
}

/** An ink drawing, drawn line by line the first time it scrolls into view. Set --tone on it or an ancestor for the wash. */
export function PenDrawing({
  children,
  className,
  delay = 0,
  viewBox = "0 0 160 100",
  hasGround = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  viewBox?: string;
  hasGround?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      variants={SCENE}
      custom={delay}
      initial={shouldReduceMotion ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "-60px" }}
      className={cn("overflow-visible", className)}
    >
      {hasGround ? <Ground /> : null}
      {children}
    </motion.svg>
  );
}
