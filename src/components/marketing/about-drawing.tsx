"use client";

import type { ReactNode } from "react";
import { Ambient, Label, Line, PAPER, PenDrawing, ring, Shape, Trail } from "@/components/marketing/pen-drawing";
import { TONES } from "@/config/tones";

export type ValueDrawingName = "truth" | "control" | "local";

const VALUES: Record<ValueDrawingName, () => ReactNode> = {
  // A price tag looked at closely, and found to be right.
  truth: () => (
    <>
      <Shape d="M40 30h44l14 16-14 16H40a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Line d={`${ring(86, 46, 3.5)}M44 41H70M44 50H62`} />
      <Shape d={ring(104, 62, 15)} />
      <Line d="M97 62L102 67L111 57M115 73L128 86" />
    </>
  ),
  // Switches the owner sets: on, off, and how far.
  control: () => (
    <>
      <Shape d="M36 16H124a8 8 0 0 1 8 8V82a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8V24a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Shape d="M44 26h22a8 8 0 0 1 0 16H44a8 8 0 0 1 0-16Z" />
      <Shape d={ring(66, 34, 5.5)} fill={PAPER} />
      <Shape d="M44 48h22a8 8 0 0 1 0 16H44a8 8 0 0 1 0-16Z" fill={PAPER} />
      <Shape d={ring(44, 56, 5.5)} fill={PAPER} />
      <Line d="M84 34H118M84 56H110M40 76H120" />
      <Shape d={ring(94, 76, 5)} />
    </>
  ),
  // A phone with a customer's message, and cedis.
  local: () => (
    <>
      <Shape d="M44 14H72a6 6 0 0 1 6 6V84a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Line d="M54 20H62" />
      <Shape d="M46 30h18a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H46a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4Z" fill="var(--whatsapp)" />
      <Shape d="M52 48h18a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H52a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4Z" />
      <Shape d={ring(130, 70, 12)} />
      <Shape d={ring(110, 56, 17)} />
      <Line d={`${ring(110, 56, 12.5)}M115 51a7 7 0 1 0 0 10M110 46V66`} />
      <Ambient kind="twinkle">
        <Line d="M136 26L137.5 30.5L142 32L137.5 33.5L136 38L134.5 33.5L130 32L134.5 30.5Z" />
      </Ambient>
    </>
  ),
};

/** A pen drawing for one of the values on the About page. */
export function ValueDrawing({ value, className, delay = 0 }: { value: ValueDrawingName; className?: string; delay?: number }) {
  const Drawing = VALUES[value];
  return (
    <PenDrawing delay={delay} className={className}>
      <Drawing />
    </PenDrawing>
  );
}

/** A map pin whose point is at (x, y + 28), with its round head centred on (x, y + 11). */
const pin = (x: number, y: number) => `M${x} ${y}c-6.6 0-11 4.4-11 11 0 7.7 11 17 11 17s11-9.3 11-17c0-6.6-4.4-11-11-11Z`;

/**
 * From a one-chair salon in Kumasi to shopfronts by the sea in Accra, as the About story says.
 * Not to scale; Kumasi sits up and to the left of Accra, as on a map.
 */
export function RouteDrawing({ className }: { className?: string }) {
  return (
    <PenDrawing viewBox="0 0 240 260" hasGround={false} className={className}>
      <g className={TONES.lilac}>
        <Shape d="M24 16h8a5 5 0 0 1 5 5v31H19V21a5 5 0 0 1 5-5Z" />
        <Shape d="M19 52h38a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H19Z" />
        <Line d="M30 41H55a3.5 3.5 0 0 1 0 7H47V52M60 63l8 11h7M39 64V76" />
        <Shape d="M25 79a14 4 0 0 1 28 0a14 4 0 0 1-28 0Z" />
        <Shape d="M80 14h16a5 5 0 0 1 5 5v34a5 5 0 0 1-5 5H80a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5Z" fill={PAPER} />
        <Line d="M81 28l8-7M81 37l13-12" />
        <Shape d={pin(43, 90)} />
        <Shape d={ring(43, 101, 4)} fill={PAPER} />
      </g>
      <Label x={60} y={107}>
        Kumasi
      </Label>
      <Trail d="M43 120C46 156 92 130 114 148S142 160 149 160" />
      <Shape d={ring(198, 46, 15)} fill="var(--sun)" />
      <Ambient kind="twinkle">
        <Line d="M198 23V17M198 75V69M175 46H169M227 46H221M181 29l-4-4M215 29l4-4M181 63l-4 4M215 63l4 4" />
      </Ambient>
      <g className={TONES.teal}>
        <Shape d={pin(150, 129)} />
        <Shape d={ring(150, 140, 4)} fill={PAPER} />
        <Shape d="M48 208H96V238H48Z" fill={PAPER} />
        <Shape d="M42 198H102V204a7.5 7.5 0 0 1-15 0a7.5 7.5 0 0 1-15 0a7.5 7.5 0 0 1-15 0a7.5 7.5 0 0 1-15 0Z" />
        <Line d="M66 238V224h12v14" />
        <Shape d="M114 192H202V238H114Z" fill={PAPER} />
        <Shape d="M110 176H206V184a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0Z" />
        <Line d="M126 176V184M142 176V184M158 176V184M174 176V184M190 176V184" />
        <Line d="M150 238V214h16v24M122 202h20v16H122ZM176 202h20v16H176Z" />
      </g>
      <Label x={166} y={146}>
        Accra
      </Label>
      <Line d="M24 248c8-5 16 5 24 0s16 5 24 0 16 5 24 0 16 5 24 0 16 5 24 0 16 5 24 0 16 5 24 0 16 5 24 0M60 256c8-5 16 5 24 0s16 5 24 0 16 5 24 0 16 5 24 0" />
    </PenDrawing>
  );
}
