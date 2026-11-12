"use client";

import type { ReactNode } from "react";
import { Ambient, Line, PAPER, PenDrawing, ring, Shape } from "@/components/marketing/pen-drawing";

export type FeatureDrawingName = "assistant" | "inbox" | "crm" | "orders" | "products" | "appointments" | "automation" | "analytics" | "security";

/** A column with a rounded top, standing on the baseline at y=88. */
const bar = (x: number, top: number) => `M${x} 88V${top + 3}a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3V88Z`;

const DRAWINGS: Record<FeatureDrawingName, () => ReactNode> = {
  assistant: () => (
    <>
      <Ambient kind="twinkle">
        <Line d="M130 14L132 20L138 22L132 24L130 30L128 24L122 22L128 20ZM148 38L149 41L152 42L149 43L148 46L147 43L144 42L147 41Z" />
      </Ambient>
      <Shape d="M42 24H100a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H62L44 86l4-16h-6a12 12 0 0 1-12-12V36a12 12 0 0 1 12-12Z" />
      <Shape d={`${ring(56, 47, 3.5)}${ring(71, 47, 3.5)}${ring(86, 47, 3.5)}`} fill="currentColor" />
      <Shape d="M106 66H132a10 10 0 0 1 0 20H130l4 7-12-7H106a10 10 0 0 1 0-20Z" fill={PAPER} />
      <Line d="M106 76H124" />
    </>
  ),
  inbox: () => (
    <>
      <Shape d="M30 58H58L64 68H96L102 58H130V84a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8Z" />
      <Shape d="M44 18H80a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H58l-8 7v-7h-6a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Line d="M46 27H76M46 34H66" />
      <Shape d={ring(88, 18, 5)} fill="var(--whatsapp)" />
      <Shape d="M84 32H116a8 8 0 0 1 8 8v6a8 8 0 0 1-8 8h-6v7l-8-7H84a8 8 0 0 1-8-8v-6a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Line d="M86 41H114M86 47H104" />
      <Shape d={ring(124, 32, 5)} fill="var(--instagram)" />
    </>
  ),
  crm: () => (
    <>
      <Shape d="M34 26H110a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8Z" fill={PAPER} />
      <Shape d={ring(50, 46, 11)} />
      <Line d={`${ring(50, 43, 4)}M43 53a7 6 0 0 1 14 0`} />
      <Line d="M70 42H102M70 50H92M34 64H110" />
      <Line d={`${ring(44, 75, 3.5)}M48 75H60${ring(64, 75, 3.5)}M68 75H80`} />
      <Shape d={ring(85, 75, 5)} />
      <Line d="M82.5 75L84.5 77L88 73" />
      <Shape d="M108 12h26l10 10-10 10h-26a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z" />
      <Line d={`${ring(134, 22, 2.5)}M110 22H124`} />
    </>
  ),
  orders: () => (
    <>
      <Shape d="M50 14H110V82l-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5V14Z" fill={PAPER} />
      <Line d="M60 26H100M60 38H82M92 38H100M60 47H78M92 47H100M60 58H100M60 69H74M88 69H100" />
      <g transform="rotate(-12 120 64)">
        <Shape d={ring(120, 64, 15)} />
        <Line d={`${ring(120, 64, 10.5)}M114 64L118 68L126 59`} />
      </g>
    </>
  ),
  products: () => (
    <>
      <Shape d="M36 54H80V90H36Z" />
      <Line d="M52 54V64H64V54" />
      <Shape d="M82 54H126V90H82Z" fill={PAPER} />
      <Line d="M90 74H104V84H90ZM110 74V84M114 74V84M119 74V84" />
      <Shape d="M58 20H104V54H58Z" />
      <Line d="M75 20V30H87V20" />
      <Shape d="M118 22h16a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-16l-6-8Z" fill={PAPER} />
      <Line d={`${ring(118.5, 30, 1.8)}M124 30H133`} />
    </>
  ),
  appointments: () => (
    <>
      <Shape d="M40 26H104a6 6 0 0 1 6 6V84a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Shape d="M40 26H104a6 6 0 0 1 6 6V42H34V32a6 6 0 0 1 6-6Z" />
      <Line d="M50 20V32M94 20V32" />
      <Line d="M44 54H54M80 54H90M44 78H54M62 78H72M80 78H90" />
      <Shape d="M60 61h16v10H60Z" />
      <Line d="M64 66L67 69L72 63M44 66H54M80 66H90M62 54H72" />
      <Ambient kind="twinkle">
        <Line d="M101 52L97 49M143 52L147 49M99 62H94M145 62H150" />
      </Ambient>
      <Shape d="M110 72V62a12 12 0 0 1 24 0V72l4 6H106Z" />
      <Line d="M118 82a4 4 0 0 0 8 0M122 50V46" />
    </>
  ),
  automation: () => (
    <>
      <Shape d={ring(34, 50, 12)} />
      <Line d="M36 41L29 52H35L32 60L40 48H34Z" />
      <Line d="M48 50H62M58 46L62 50L58 54" />
      <Shape d="M80 34L96 50L80 66L64 50Z" fill={PAPER} />
      <Line d="M75 47a5 5 0 1 1 6 4.5V54M81 59V59.5" />
      <Line d="M96 50C104 50 104 31 112 31M108 27L112 31L108 35M96 50C104 50 104 69 112 69M108 65L112 69L108 73" />
      <Shape d="M117 22H138a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H117a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" />
      <Line d="M119 31H136" />
      <Shape d="M117 60H138a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H117a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" fill={PAPER} />
      <Line d="M119 69H130" />
    </>
  ),
  analytics: () => (
    <>
      <Shape d={bar(36, 64)} fill={PAPER} />
      <Shape d={bar(60, 54)} />
      <Shape d={bar(84, 60)} fill={PAPER} />
      <Shape d={bar(108, 34)} />
      <Line d="M26 88H134" />
      <Line d="M44 50L68 40L92 46L116 22" />
      <Shape d={ring(116, 22, 3.5)} fill="currentColor" />
      <Ambient kind="twinkle">
        <Line d="M136 10L137.5 14.5L142 16L137.5 17.5L136 22L134.5 17.5L130 16L134.5 14.5Z" />
      </Ambient>
    </>
  ),
  security: () => (
    <>
      <Shape d="M98 16L128 26V50C128 68 114 80 98 86C82 80 68 68 68 50V26Z" />
      <Line d="M87 50L95 58L110 42" />
      <Line d="M42 50V40a14 14 0 0 1 28 0V50" />
      <Shape d="M34 50H78a4 4 0 0 1 4 4V84a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V54a4 4 0 0 1 4-4Z" fill={PAPER} />
      <Line d={`${ring(56, 64, 4)}M56 68V76`} />
    </>
  ),
};

/** A pen drawing for one group of features, drawn line by line the first time it scrolls into view. */
export function FeatureDrawing({ feature, className, delay = 0 }: { feature: FeatureDrawingName; className?: string; delay?: number }) {
  const Drawing = DRAWINGS[feature];
  return (
    <PenDrawing delay={delay} className={className}>
      <Drawing />
    </PenDrawing>
  );
}
