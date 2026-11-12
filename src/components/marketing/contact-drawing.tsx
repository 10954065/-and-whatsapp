"use client";

import { Line, PAPER, PenDrawing, Shape, Trail } from "@/components/marketing/pen-drawing";

/** A paper plane gliding in from the left on a dotted trail, for the contact form. */
export function PaperPlaneDrawing({ className }: { className?: string }) {
  return (
    <PenDrawing viewBox="0 0 140 80" hasGround={false} className={className}>
      <Trail d="M4 70C22 76 32 54 48 54S62 46 66 40" />
      <Shape d="M96 44L134 10L108 72Z" />
      <Shape d="M64 34L134 10L96 44Z" fill={PAPER} />
      <Line d="M96 44L99 58L106 54" />
    </PenDrawing>
  );
}
