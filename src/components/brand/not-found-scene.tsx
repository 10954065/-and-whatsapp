"use client";

import { SunCharacter } from "@/components/brand/sun-character";
import { SunSky } from "@/components/brand/sun-sky";
import { cn } from "@/lib/utils";

/** The sun's width; the digits stand on the horizon, which sits a quarter of that width above the bottom. */
const SUN_WIDTH = "w-[clamp(9.5rem,26vw,19rem)]";
const ON_HORIZON = "mb-[calc(clamp(9.5rem,26vw,19rem)/4)]";

const DIGIT =
  "relative z-10 font-display text-[clamp(6rem,18vw,14.5rem)] leading-[0.72] text-[#fde3cc] [text-shadow:0_0_42px_rgb(245_154_76/0.45)] select-none";

/** "4 0 4" on a dusk horizon, with the sun as the 0, looking left and right for the missing page. */
export function NotFoundScene({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-[clamp(15rem,38vw,25rem)] overflow-hidden rounded-[2rem] bg-[#1d1a16] shadow-[0_30px_70px_-35px_rgb(59_29_74/0.8)]",
        className,
      )}
    >
      <SunSky mood="lost" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
        <span className={cn(DIGIT, ON_HORIZON)}>4</span>
        <SunCharacter mood="lost" className={cn(SUN_WIDTH, "shrink-0")} />
        <span className={cn(DIGIT, ON_HORIZON)}>4</span>
      </div>
    </div>
  );
}
