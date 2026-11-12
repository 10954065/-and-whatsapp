"use client";

import { Ambient, Label, Line, PAPER, PenDrawing, ring, Shape, Trail } from "@/components/marketing/pen-drawing";
import { TONES } from "@/config/tones";

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
