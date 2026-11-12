"use client";

import type { ReactNode } from "react";
import { Ambient, Line, PAPER, PenDrawing, ring, Shape } from "@/components/marketing/pen-drawing";
import { INDUSTRY_TONES } from "@/config/tones";
import type { Industry } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const DRAWINGS: Record<Industry, () => ReactNode> = {
  RESTAURANT: () => (
    <>
      <Ambient kind="steam">
        <Line d="M64 28C60 24 68 20 64 14M80 25C76 21 84 17 80 11M96 28C92 24 100 20 96 14" />
      </Ambient>
      <Shape d="M46 56C50 42 64 36 80 37C97 36 110 43 114 56Z" />
      <Line d="M84 41C86 35 92 32 97 33C96 38 90 42 84 41Z" />
      <Shape d="M36 56H124C124 76 104 88 80 88C56 88 36 76 36 56Z" fill={PAPER} />
      <Line d="M48 66C62 71 98 71 112 66" />
      <Line d="M66 88L69 93H91L94 88" />
    </>
  ),
  RETAIL: () => (
    <>
      <Line d="M56 46V40C56 31 62 26 70 26C78 26 84 31 84 40V46" />
      <Shape d="M40 46H100L106 90H34Z" />
      <Line d="M40 54H100M60 70H80" />
      <Shape d="M116 34h20a6 6 0 0 1 6 6v44a6 6 0 0 1-6 6h-20a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6Z" fill={PAPER} />
      <Shape d="M117 39h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z" />
      <Line d={ring(121.5, 46.5, 2.5)} />
    </>
  ),
  FASHION: () => (
    <>
      <Line d="M80 30V25C80 21 83 18 86 18C89 18 91 21 90 24" />
      <Line d="M80 30L44 42H116Z" />
      <Shape d="M50 40L80 33L110 40L132 80H104L100 91H60L56 80H28Z" />
      <Line d="M70 36C72 46 88 46 90 36" />
      <Line d="M74 52L80 58L86 52M74 61L80 67L86 61M74 70L80 76L86 70" />
      <Line d="M57 80L63 52M103 80L97 52" />
    </>
  ),
  BEAUTY: () => (
    <>
      <Ambient kind="twinkle">
        <Line d="M30 28L32 34L38 36L32 38L30 44L28 38L22 36L28 34ZM132 20L133.5 24.5L138 26L133.5 27.5L132 32L130.5 27.5L126 26L130.5 24.5Z" />
      </Ambient>
      <Shape d="M48 50H112V82C112 87 108 90 103 90H57C52 90 48 87 48 82Z" />
      <Shape d="M44 38H116C118 38 120 40 120 42V50H40V42C40 40 42 38 44 38Z" fill={PAPER} />
      <Line d="M50 44H110" />
      <Shape d="M63 60H97A3 3 0 0 1 100 63V75A3 3 0 0 1 97 78H63A3 3 0 0 1 60 75V63A3 3 0 0 1 63 60Z" fill={PAPER} />
      <Line d="M72 74C72 67 79 63 87 64C86 71 80 74 72 74ZM72 74L83 67" />
      <Line d="M120 90C122 77 132 71 142 73C140 84 131 90 120 90ZM120 90L134 79" />
    </>
  ),
  SALON_SPA: () => (
    <>
      <g transform="rotate(-10 56 58)">
        <Shape d="M24 44H86A4 4 0 0 1 90 48V54H20V48A4 4 0 0 1 24 44Z" />
        <Line d="M26 54V70M33 54V70M40 54V70M47 54V66M54 54V70M61 54V70M68 54V70M75 54V66M82 54V70" />
      </g>
      <Line d="M28 86C34 82 38 90 44 86C50 82 54 90 60 86C66 82 70 90 76 86" />
      <Shape d="M113 70L136 24C138 21 142 23 141 27L120 72Z" fill={PAPER} />
      <Shape d="M127 70L104 24C102 21 98 23 99 27L120 72Z" fill={PAPER} />
      <Shape d={ring(110, 78, 8)} />
      <Shape d={ring(130, 78, 8)} />
      <Line d={ring(120, 58, 1.5)} />
    </>
  ),
  HEALTHCARE_ADMIN: () => (
    <>
      <Shape d="M42 30H106A6 6 0 0 1 112 36V84A6 6 0 0 1 106 90H42A6 6 0 0 1 36 84V36A6 6 0 0 1 42 30Z" fill={PAPER} />
      <Shape d="M42 30H106A6 6 0 0 1 112 36V46H36V36A6 6 0 0 1 42 30Z" />
      <Line d="M54 24V36M94 24V36" />
      <Line d="M50 58H51M62 58H63M74 58H75M86 58H87M98 58H99M50 70H51M62 70H63M86 70H87M98 70H99M50 81H51M62 81H63M74 81H75" />
      <Line d="M70 69L74 73L81 64" />
      <Shape d={ring(124, 72, 16)} fill={PAPER} />
      <Line d="M124 63V72L130 76" />
    </>
  ),
  HOSPITALITY: () => (
    <>
      <Line d="M124 18A11 11 0 1 0 137 32A9 9 0 0 1 124 18ZM144 42L145 45L148 46L145 47L144 50L143 47L140 46L143 45Z" />
      <Line d="M52 49C56 42 61 37 68 35" />
      <Shape d="M72 22H100A4 4 0 0 1 104 26V42A4 4 0 0 1 100 46H72L64 34Z" fill={PAPER} />
      <Line d={ring(71, 34, 2.5)} />
      <Line d="M80 31H96M80 37H91" />
      <Shape d={ring(44, 60, 13)} />
      <Line d={ring(44, 60, 4)} />
      <Line d="M57 60H108V68M99 60V66M90 60V64" />
    </>
  ),
  REAL_ESTATE: () => (
    <>
      <Line d="M96 40V28H104V46" />
      <Shape d="M48 52L78 32L108 52V90H48Z" />
      <Line d="M40 57L78 29L116 57" />
      <Shape d="M70 90V73A6 6 0 0 1 82 73V90Z" fill={PAPER} />
      <Shape d="M88 62H100V74H88Z" fill={PAPER} />
      <Line d="M94 62V74M88 68H100" />
      <Line d="M114 90C114 84 120 82 124 86C127 82 134 85 132 90" />
      <Shape d="M132 16C139 16 144 21 144 28C144 37 132 48 132 48C132 48 120 37 120 28C120 21 125 16 132 16Z" fill={PAPER} />
      <Shape d={ring(132, 28, 4)} />
    </>
  ),
  EDUCATION: () => (
    <>
      <Shape d="M56 42V53C56 59 104 59 104 53V42L80 50Z" fill={PAPER} />
      <Shape d="M80 18L126 34L80 50L34 34Z" />
      <Line d="M80 34L114 40V56" />
      <Shape d="M111 56H117L119 64H109Z" />
      <Shape d="M42 76C54 70 68 70 80 76C92 70 106 70 118 76V90C106 84 92 84 80 90C68 84 54 84 42 90Z" fill={PAPER} />
      <Line d="M80 76V90M50 81C58 78 66 78 74 81M86 81C94 78 102 78 110 81" />
    </>
  ),
  PROFESSIONAL_SERVICES: () => (
    <>
      <Shape d="M88 18H118L132 32V84H88Z" fill={PAPER} />
      <Line d="M118 18V32H132M96 40H124M96 48H124M96 56H114" />
      <Shape d={ring(119, 71, 8)} />
      <Line d="M115 71L118 74L123 68" />
      <Line d="M48 50V44A4 4 0 0 1 52 40H68A4 4 0 0 1 72 44V50" />
      <Shape d="M30 50H90A6 6 0 0 1 96 56V84A6 6 0 0 1 90 90H30A6 6 0 0 1 24 84V56A6 6 0 0 1 30 50Z" />
      <Line d="M24 66H96" />
      <Shape d="M55 62H65V70H55Z" fill={PAPER} />
    </>
  ),
  GENERAL: () => (
    <>
      <Shape d="M38 20H122V34H38Z" fill={PAPER} />
      <Shape d="M73 31A7 7 0 0 1 87 31Z" />
      <Shape d="M40 48H120V90H40Z" fill={PAPER} />
      <Shape d="M48 58H80V78H48Z" fill={PAPER} />
      <Line d={`${ring(58, 72, 4)}${ring(70, 72, 4)}`} />
      <Line d="M90 90V60H112V90" />
      <Line d="M95 64L101 60L107 64" />
      <Shape d="M94 64H108V72H94Z" />
      <Shape d="M32 34H128V42a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0a8 8 0 0 1-16 0Z" />
      <Line d="M48 34V42M64 34V42M80 34V42M96 34V42M112 34V42" />
    </>
  ),
};

/** A pen drawing of the kind of business, drawn line by line the first time it scrolls into view. */
export function IndustryDrawing({ industry, className, delay = 0 }: { industry: Industry; className?: string; delay?: number }) {
  const Drawing = DRAWINGS[industry];
  return (
    <PenDrawing delay={delay} className={cn(INDUSTRY_TONES[industry], className)}>
      <Drawing />
    </PenDrawing>
  );
}
