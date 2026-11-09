"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface StoryStep {
  title: string;
  body: string;
  lines: Array<{ time?: string; label: string; value?: string; strong?: boolean }>;
}

const STEPS: StoryStep[] = [
  {
    title: "A customer asks",
    body: "Efua messages at 9:41 while you're busy with someone in the shop. She gets a reply in seconds, in her own words, not a menu of numbers.",
    lines: [{ time: "09:41", label: "WhatsApp · Efua", value: "Midi dress, M?" }],
  },
  {
    title: "It checks before it answers",
    body: "Prices and stock come from your own product list. If something isn't in your records, the question goes to your team instead of being guessed.",
    lines: [
      { time: "09:41", label: "Stock checked", value: "M · 3 left" },
      { time: "09:41", label: "Price quoted", value: "GH₵ 450.00" },
    ],
  },
  {
    title: "The order writes itself",
    body: "Delivery is added, an order number is created, and a Paystack link goes out so she can pay with MoMo or card.",
    lines: [
      { time: "09:43", label: "Order #1042", value: "GH₵ 450.00" },
      { label: "Delivery, Osu", value: "GH₵ 30.00" },
      { label: "Total", value: "GH₵ 480.00", strong: true },
    ],
  },
  {
    title: "Paid means paid",
    body: "An order is only marked paid once Paystack confirms the money arrived. Then your team sees a delivery job, not a screenshot to check.",
    lines: [
      { time: "09:47", label: "MoMo payment", value: "verified" },
      { time: "16:00", label: "Out for delivery", value: "Osu" },
    ],
  },
];

function StepBlock({ step, index, isActive, onEnter }: { step: StoryStep; index: number; isActive: boolean; onEnter: (index: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const isInView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (isInView) onEnter(index);
  }, [isInView, index, onEnter]);
  return (
    <li ref={ref} className="flex min-h-[38vh] items-center lg:min-h-[64vh]">
      <div className={cn("transition-opacity duration-500", isActive ? "opacity-100" : "lg:opacity-35")}>
        <p className="font-mono text-xs text-sun-ink">0{index + 1}</p>
        <h3 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.01em] sm:text-5xl">{step.title}</h3>
        <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted-foreground">{step.body}</p>
      </div>
    </li>
  );
}

function Receipt({ active }: { active: number }) {
  const lines = STEPS.slice(0, active + 1).flatMap((step, stepIndex) => step.lines.map((line, lineIndex) => ({ ...line, key: `${stepIndex}-${lineIndex}` })));
  const isPaid = active === STEPS.length - 1;
  return (
    <div className="drop-shadow-[0_24px_40px_rgb(60_40_20/0.18)] dark:drop-shadow-[0_24px_40px_rgb(0_0_0/0.6)]">
      <div className="relative mx-auto w-full max-w-sm bg-card px-7 pt-8 pb-12 font-mono text-[13px] [mask:conic-gradient(from_-45deg_at_bottom,#0000,#000_1deg_90deg,#0000_91deg)_50%/14px_100%]">
        <p className="text-center text-[11px] tracking-[0.3em] text-muted-foreground uppercase">Adwoa&apos;s Closet</p>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">Oxford Street, Osu · Accra</p>
        <div className="my-5 border-t border-dashed border-foreground/25" />
        <ul className="grid gap-2.5">
          <AnimatePresence initial={false}>
            {lines.map((line) => (
              <motion.li
                key={line.key}
                layout
                initial={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className={cn("flex items-baseline gap-3", line.strong && "mt-1 border-t border-dashed border-foreground/25 pt-3 font-semibold")}
              >
                <span className="w-10 shrink-0 text-muted-foreground">{line.time ?? ""}</span>
                <span className="flex-1">{line.label}</span>
                <span className="text-right">{line.value}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="my-5 border-t border-dashed border-foreground/25" />
        <p className="text-center text-[11px] text-muted-foreground">Thank you for shopping with us</p>
        <AnimatePresence>
          {isPaid ? (
            <motion.span
              key="stamp"
              initial={{ opacity: 0, scale: 1.6, rotate: -2 }}
              animate={{ opacity: 0.9, scale: 1, rotate: -9 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", bounce: 0.35, duration: 0.45 }}
              className="absolute top-24 right-6 rounded-md border-[3px] border-sun-ink px-3 py-1 font-sans text-2xl font-black tracking-[0.12em] text-sun-ink mix-blend-multiply dark:mix-blend-screen"
            >
              PAID
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ReceiptStory() {
  const [active, setActive] = useState(0);
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-20">
      <ol>
        {STEPS.map((step, index) => (
          <StepBlock key={step.title} step={step} index={index} isActive={active === index} onEnter={setActive} />
        ))}
      </ol>
      <div>
        <div className="lg:sticky lg:top-[calc(50vh-15rem)]" aria-hidden="true">
          <Receipt active={active} />
        </div>
      </div>
    </div>
  );
}
