"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** A chat bubble that pops in the first time it scrolls into view. */
export function BubbleReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.p
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.55, delay }}
      style={{ originX: 0, originY: 1 }}
      className={cn("w-fit max-w-[92%] rounded-[18px] rounded-bl-[6px] bg-card px-4 py-2.5 text-[15px] leading-snug shadow-[var(--shadow-hairline),0_1px_1px_rgb(0_0_0/0.04)]", className)}
    >
      {children}
    </motion.p>
  );
}
