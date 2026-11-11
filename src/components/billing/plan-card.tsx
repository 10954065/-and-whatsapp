"use client";

import { useId, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Nfc } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import type { CardFinish } from "./plan-card-format";

export type BillingInterval = "MONTHLY" | "YEARLY";

export interface PlanCardFront {
  finish: CardFinish;
  /** The large embossed line: the price on plan lists, the plan name on the current-plan card. */
  headline: string;
  headlineNote?: string;
  allowance: string;
  holderLabel: string;
  holder: string;
  /** Renders the holder as a heading, so the card names its plan for screen readers. */
  headingLevel?: 2 | 3;
  tag?: string;
  dateLabel?: string;
  date?: string;
}

export interface PlanCardBack {
  headline: string;
  headlineNote: string;
  note?: string;
  /** Written on the signature strip; a heading when `headingLevel` is set. */
  signature: string;
  headingLevel?: 2 | 3;
  finePrint: string;
}

interface FinishStyle {
  face: CSSProperties;
  muted: string;
  rings: string;
  emboss: string;
  glyph: string;
  chip: [string, string, string];
  tag: CSSProperties;
  stripe: string;
}

const INK = "#1d1a16";
const PAPER = "#f3efe7";
const SUN = "#ef6b1f";
const EDGE = "0 2px 6px rgb(0 0 0 / 0.12)";

const FINISH: Record<CardFinish, FinishStyle> = {
  paper: {
    face: {
      background: "radial-gradient(120% 95% at 100% 100%, oklch(0.88 0.07 62 / 0.55), transparent 60%), linear-gradient(135deg, oklch(0.99 0.01 86), oklch(0.925 0.028 76))",
      color: INK,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.9), inset 0 0 0 1px rgb(29 26 22 / 0.08), ${EDGE}`,
    },
    muted: "rgb(29 26 22 / 0.58)",
    rings: "rgb(150 90 30 / 0.11)",
    emboss: "0 1px 0 rgb(255 255 255 / 0.85), 0 -1px 0 rgb(29 26 22 / 0.08)",
    glyph: SUN,
    chip: ["#f4e2b0", "#c99e52", "#ead19a"],
    tag: { background: INK, color: PAPER },
    stripe: "linear-gradient(180deg, #2a2621, #15130f 55%, #221e1a)",
  },
  sun: {
    face: {
      background: "radial-gradient(120% 90% at 0% 0%, oklch(0.86 0.12 80 / 0.85), transparent 55%), linear-gradient(135deg, oklch(0.77 0.16 60), oklch(0.67 0.19 45) 55%, oklch(0.56 0.175 37))",
      color: INK,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 0 0 1px rgb(255 255 255 / 0.12), ${EDGE}`,
    },
    muted: "rgb(29 26 22 / 0.66)",
    rings: "rgb(255 255 255 / 0.16)",
    emboss: "0 1px 0 rgb(255 255 255 / 0.35), 0 -1px 0 rgb(0 0 0 / 0.12)",
    glyph: INK,
    chip: ["#f1ece2", "#bdb5a6", "#e6dfd2"],
    tag: { background: "rgb(29 26 22 / 0.88)", color: "#ffd9b8" },
    stripe: "linear-gradient(180deg, #2b211a, #120d0a 55%, #241b15)",
  },
  ink: {
    face: {
      background: "radial-gradient(110% 80% at 100% 100%, oklch(0.68 0.185 46 / 0.34), transparent 55%), linear-gradient(140deg, oklch(0.33 0.012 62), oklch(0.2 0.01 62) 55%, oklch(0.13 0.008 62))",
      color: PAPER,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 0 0 1px rgb(255 255 255 / 0.06), ${EDGE}`,
    },
    muted: "rgb(243 239 231 / 0.6)",
    rings: "rgb(255 255 255 / 0.055)",
    emboss: "0 -1px 0 rgb(0 0 0 / 0.6), 0 1px 0 rgb(255 255 255 / 0.1)",
    glyph: SUN,
    chip: ["#f4e2b0", "#b88c45", "#e8cd92"],
    tag: { background: SUN, color: INK },
    stripe: "linear-gradient(180deg, #050505, #000 55%, #0d0c0b)",
  },
};

const TILT_DEG = 10;
const FOLLOW = { stiffness: 240, damping: 24, mass: 0.6 };

interface CardLight {
  glare: MotionValue<string>;
  glareOpacity: MotionValue<number>;
  holo: MotionValue<string>;
}

/** Tilt toward the pointer, with glare and hologram colours that follow it. Mouse only: touch keeps scrolling. */
function useCardTilt(isEnabled: boolean) {
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const hover = useMotionValue(0);
  const x = useSpring(pointerX, FOLLOW);
  const y = useSpring(pointerY, FOLLOW);
  const lift = useSpring(hover, FOLLOW);
  const glareX = useTransform(x, [0, 1], [0, 100]);
  const glareY = useTransform(y, [0, 1], [0, 100]);
  const holoAngle = useTransform([x, y], ([px, py]: number[]) => px * 220 + py * 120);
  const light: CardLight = {
    glare: useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / 0.55), transparent 50%)`,
    glareOpacity: useTransform(lift, [0, 1], [0, 0.9]),
    holo: useMotionTemplate`conic-gradient(from ${holoAngle}deg, #ffb3d9, #ffe9a3, #b4f5d0, #a9dcff, #d6b8ff, #ffb3d9)`,
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isEnabled || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
    hover.set(1);
  };
  const onPointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
    hover.set(0);
  };
  return {
    rotateX: useTransform(y, [0, 1], [TILT_DEG, -TILT_DEG]),
    rotateY: useTransform(x, [0, 1], [-TILT_DEG, TILT_DEG]),
    lift: useTransform(lift, [0, 1], [0, -6]),
    shadowOpacity: useTransform(lift, [0, 1], [0.5, 0.85]),
    shadowScale: useTransform(lift, [0, 1], [1, 0.9]),
    light,
    onPointerMove,
    onPointerLeave,
  };
}

/** The brand's sunrise, used as the card's network mark. */
function SunriseGlyph({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" className={cn("h-auto shrink-0", className)} style={{ color }}>
      <path d="M4 8a8 8 0 0 1 16 0Z" fill="currentColor" />
      <rect x="3" y="10.25" width="18" height="2" rx="1" fill="currentColor" fillOpacity="0.6" />
      <rect x="6.5" y="13.75" width="11" height="2" rx="1" fill="currentColor" fillOpacity="0.32" />
    </svg>
  );
}

function Chip({ colors }: { colors: [string, string, string] }) {
  const gradientId = `chip-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <svg viewBox="0 0 50 38" aria-hidden="true" className="h-auto w-[12cqw] shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="0.55" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="49" height="37" rx="7" fill={`url(#${gradientId})`} stroke="rgb(0 0 0 / 0.18)" />
      <g fill="none" stroke="rgb(70 45 10 / 0.42)" strokeWidth="1.2">
        <path d="M0.5 13h14a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-14" />
        <path d="M49.5 13h-14a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h14" />
        <path d="M18.5 19h13M25 0.5V13M25 25v12.5" />
      </g>
    </svg>
  );
}

function Hologram({ background }: { background: MotionValue<string> }) {
  return (
    <motion.span
      aria-hidden="true"
      className="relative block h-[8cqw] w-[11.5cqw] shrink-0 overflow-hidden rounded-[1.4cqw] opacity-85 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.45)]"
      style={{ background }}
    >
      <SunriseGlyph className="absolute inset-0 m-auto w-[6.5cqw] mix-blend-overlay" color="#ffffff" />
    </motion.span>
  );
}

function CardField({ label, muted, className, children }: { label: string; muted: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[clamp(7px,2.3cqw,10px)] tracking-[0.2em] uppercase" style={{ color: muted }}>
        {label}
      </p>
      <div className="mt-[0.6cqw]">{children}</div>
    </div>
  );
}

function CardFace({
  finish,
  isBack = false,
  isHidden,
  light,
  sheenDelay,
  children,
}: {
  finish: CardFinish;
  isBack?: boolean;
  isHidden: boolean;
  light: CardLight;
  sheenDelay: string;
  children: ReactNode;
}) {
  const style = FINISH[finish];
  const rings = `repeating-radial-gradient(circle at 105% 120%, transparent 0 1.6cqw, ${style.rings} 1.6cqw calc(1.6cqw + 1px))`;
  const ringsMask = "linear-gradient(115deg, transparent 25%, black 80%)";
  return (
    <div aria-hidden={isHidden || undefined} className={cn("absolute inset-0 overflow-hidden rounded-[4.8cqw] backface-hidden", isBack && "rotate-y-180")} style={style.face}>
      {/* Fine security rings, like the guilloche printed on real cards. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: rings, maskImage: ringsMask, WebkitMaskImage: ringsMask }} />
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[45%] animate-[plan-card-sheen_9s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.22),transparent)]"
        style={{ animationDelay: sheenDelay }}
      />
      <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ background: light.glare, opacity: light.glareOpacity }} />
    </div>
  );
}

function FrontContent({ front, light }: { front: PlanCardFront; light: CardLight }) {
  const style = FINISH[front.finish];
  const Holder = front.headingLevel === 2 ? "h2" : front.headingLevel === 3 ? "h3" : "p";
  return (
    <div className="relative flex h-full flex-col p-[6.2cqw]">
      <div className="flex items-start justify-between gap-[3cqw]">
        <span className="flex items-center gap-[1.8cqw] text-[3.1cqw] font-semibold tracking-[0.2em] uppercase">
          <SunriseGlyph className="w-[6cqw]" color={style.glyph} /> Sunleon AI
        </span>
        {front.tag ? (
          <span className="rounded-full px-[2.6cqw] py-[0.9cqw] text-[2.9cqw] leading-none font-semibold" style={style.tag}>
            {front.tag}
          </span>
        ) : null}
      </div>
      <div className="mt-[4.5cqw] flex items-center gap-[3cqw]">
        <Chip colors={style.chip} />
        <Nfc aria-hidden="true" className="size-[6.4cqw]" strokeWidth={1.5} style={{ color: style.muted }} />
      </div>
      <div className="mt-auto">
        <p className="flex items-baseline gap-[1.8cqw]">
          <span className="font-display text-[11.5cqw] leading-[0.95]" style={{ textShadow: style.emboss }}>
            {front.headline}
          </span>
          {front.headlineNote ? (
            <span className="truncate text-[3.4cqw]" style={{ color: style.muted }}>
              {front.headlineNote}
            </span>
          ) : null}
        </p>
        <p className="mt-[2cqw] truncate font-mono text-[3.1cqw] tracking-[0.14em] uppercase" style={{ textShadow: style.emboss }}>
          {front.allowance}
        </p>
        <div className="mt-[3.6cqw] flex items-end gap-[5cqw]">
          <CardField label={front.holderLabel} muted={style.muted} className="flex-1">
            <Holder className="truncate text-[4.3cqw] leading-tight font-semibold tracking-[0.06em] uppercase">{front.holder}</Holder>
          </CardField>
          {front.date ? (
            <CardField label={front.dateLabel ?? ""} muted={style.muted}>
              <p className="font-mono text-[4cqw] leading-tight font-semibold">{front.date}</p>
            </CardField>
          ) : null}
          <Hologram background={light.holo} />
        </div>
      </div>
    </div>
  );
}

function BackContent({ back, finish, light }: { back: PlanCardBack; finish: CardFinish; light: CardLight }) {
  const style = FINISH[finish];
  const Signature = back.headingLevel === 2 ? "h2" : back.headingLevel === 3 ? "h3" : "p";
  return (
    <div className="relative flex h-full flex-col">
      <div className="mt-[6cqw] h-[11cqw] shrink-0" style={{ background: style.stripe }} />
      <div className="flex flex-1 flex-col px-[6.2cqw] pt-[3.6cqw] pb-[5.2cqw]">
        <div className="flex items-center gap-[3cqw]">
          <div
            className="flex h-[9cqw] min-w-0 flex-1 items-center rounded-[1cqw] px-[3cqw]"
            style={{ background: "repeating-linear-gradient(-45deg, #fbf6ec 0 0.9cqw, #efe4d0 0.9cqw 1.8cqw)", boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}
          >
            <Signature className="truncate font-display text-[5.4cqw] italic" style={{ color: INK }}>
              {back.signature}
            </Signature>
          </div>
          <Hologram background={light.holo} />
        </div>
        <div className="mt-auto">
          <p className="flex items-baseline gap-[1.8cqw]">
            <span className="font-display text-[10.5cqw] leading-[0.95]" style={{ textShadow: style.emboss }}>
              {back.headline}
            </span>
            <span className="text-[3.4cqw]" style={{ color: style.muted }}>
              {back.headlineNote}
            </span>
          </p>
          {/* Sans, not mono: the mono face has no cedi sign. */}
          {back.note ? <p className="mt-[1.8cqw] truncate text-[3cqw] font-semibold tracking-widest uppercase">{back.note}</p> : null}
          <p className="mt-[2.2cqw] truncate text-[clamp(7px,2.4cqw,10.5px)]" style={{ color: style.muted }}>
            {back.finePrint}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A plan drawn as a payment card: tilts toward the pointer, catches the light, and flips to show its yearly price. */
export function PlanCard({
  front,
  back,
  isFlipped = false,
  index = 0,
  className,
}: {
  front: PlanCardFront;
  back?: PlanCardBack;
  isFlipped?: boolean;
  index?: number;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const tilt = useCardTilt(!shouldReduceMotion);
  const sheenDelay = `${index * 1.1}s`;
  const showsBack = Boolean(back) && isFlipped;
  return (
    <motion.div
      className={cn("@container relative perspective-distant", className)}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 32, rotateX: 14 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", duration: 0.9, bounce: 0, delay: index * 0.09 }}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-[10%] bottom-[-5%] h-[16%] rounded-[50%] bg-black/35 blur-xl dark:bg-black/70"
        style={{ opacity: tilt.shadowOpacity, scaleX: tilt.shadowScale }}
      />
      <motion.div
        className="relative aspect-[1.586] w-full transform-3d"
        style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, y: tilt.lift }}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
      >
        <motion.div
          className="absolute inset-0 transform-3d"
          initial={false}
          animate={{ rotateY: showsBack ? 180 : 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", duration: 0.8, bounce: 0.15, delay: index * 0.07 }}
        >
          <CardFace finish={front.finish} isHidden={showsBack} light={tilt.light} sheenDelay={sheenDelay}>
            <FrontContent front={front} light={tilt.light} />
          </CardFace>
          {back ? (
            <CardFace finish={front.finish} isBack isHidden={!showsBack} light={tilt.light} sheenDelay={sheenDelay}>
              <BackContent back={back} finish={front.finish} light={tilt.light} />
            </CardFace>
          ) : null}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const INTERVALS: { value: BillingInterval; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

function IntervalToggle({ value, onChange, bonusLabel, className }: { value: BillingInterval; onChange: (value: BillingInterval) => void; bonusLabel?: string | null; className?: string }) {
  const pillId = useId();
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <div role="group" aria-label="Billing period" className="inline-flex rounded-full bg-foreground/6 p-1">
        {INTERVALS.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                "pressable relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isSelected ? (
                <motion.span layoutId={pillId} className="absolute inset-0 rounded-full bg-card shadow-[var(--shadow-hairline),var(--shadow-soft)]" transition={{ type: "spring", duration: 0.4, bounce: 0 }} />
              ) : null}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
      {bonusLabel ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="size-1.5 rounded-full bg-sun" aria-hidden="true" />
          {bonusLabel} when you pay yearly
        </span>
      ) : null}
    </div>
  );
}

export interface DeckPlan {
  id: string;
  front: PlanCardFront;
  back: PlanCardBack;
  details?: ReactNode;
  actions?: Partial<Record<BillingInterval, ReactNode>>;
}

/** Plan cards with a Monthly/Yearly switch: switching flips every card, one after another, to its other side. */
export function PlanDeck({
  plans,
  bonusLabel,
  isCentered = false,
  gridClassName,
}: {
  plans: DeckPlan[];
  bonusLabel?: string | null;
  isCentered?: boolean;
  gridClassName?: string;
}) {
  const [interval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  return (
    <div>
      <IntervalToggle value={interval} onChange={setBillingInterval} bonusLabel={bonusLabel} className={cn(isCentered && "justify-center")} />
      <div className={cn("mt-10 grid items-start gap-x-6 gap-y-14", gridClassName)}>
        {plans.map((plan, index) => (
          <div key={plan.id} className="flex min-w-0 flex-col">
            <PlanCard front={plan.front} back={plan.back} isFlipped={interval === "YEARLY"} index={index} />
            {plan.details}
            {plan.actions?.[interval] ?? null}
          </div>
        ))}
      </div>
    </div>
  );
}
