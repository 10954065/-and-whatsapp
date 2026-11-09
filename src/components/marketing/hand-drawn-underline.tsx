"use client";

import { motion, useReducedMotion } from "motion/react";

/** A pen stroke under a phrase, drawn once when the page loads. */
export function HandDrawnUnderline({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg viewBox="0 0 300 18" fill="none" preserveAspectRatio="none" aria-hidden="true" className={className}>
      <motion.path
        d="M3 13.5C52 6.5 118 3.6 189 5.2c38 .9 74 3.3 108 7.3"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        initial={{ pathLength: shouldReduceMotion ? 1 : 0, opacity: shouldReduceMotion ? 1 : 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}
