"use client";

import { motion } from "motion/react";
import type { SunMood } from "@/components/brand/sun-character";
import { cn } from "@/lib/utils";

type Sky = "dawn" | "listening" | "night" | "overcast" | "morning" | "dusk";

/** Each sky from its top down to the horizon. Every top stays dark, so light text reads on all of them. */
const SKIES: Record<Sky, string> = {
  dawn: "linear-gradient(180deg, #1a1538 0%, #3b1d4a 36%, #8a2f4f 60%, #e2603f 80%, #f39a4a 100%)",
  listening: "linear-gradient(180deg, #1c1a44 0%, #43215a 34%, #a3375a 58%, #ef6d42 78%, #f8aa55 100%)",
  night: "linear-gradient(180deg, #080a1a 0%, #11132d 45%, #23193d 75%, #3d2342 100%)",
  overcast: "linear-gradient(180deg, #1b1e26 0%, #2a2f39 45%, #474a53 75%, #675b57 100%)",
  morning: "linear-gradient(180deg, #11295a 0%, #2c5a98 34%, #7a8cc0 55%, #f3a07a 78%, #ffd27a 100%)",
  dusk: "linear-gradient(180deg, #141938 0%, #2c2256 38%, #6a2e62 62%, #d5544a 84%, #f59a4c 100%)",
};

const SKY_FOR: Record<SunMood, Sky> = {
  idle: "dawn",
  pending: "dawn",
  watching: "listening",
  hiding: "night",
  sad: "overcast",
  happy: "morning",
  lost: "dusk",
};

/** Fixed stars as [left %, top %, size px, delay s], so the server and the browser draw the same sky. */
const STARS: [number, number, number, number][] = [
  [7, 14, 2, 0],
  [15, 38, 1.5, 1.1],
  [23, 9, 1.5, 2.3],
  [31, 27, 2, 0.6],
  [39, 52, 1.5, 1.8],
  [46, 16, 2.5, 0.3],
  [54, 41, 1.5, 2.6],
  [61, 7, 2, 1.4],
  [68, 30, 1.5, 0.9],
  [74, 55, 2, 2.1],
  [81, 19, 1.5, 0.2],
  [88, 44, 2, 1.6],
  [93, 11, 1.5, 2.8],
  [12, 62, 1.5, 1.3],
  [86, 68, 1.5, 0.5],
];

/** The sky behind the sun. It changes with the sun's mood and shows stars at night and at dusk. */
export function SunSky({ mood, className }: { mood: SunMood; className?: string }) {
  const sky = SKY_FOR[mood];
  const hasStars = sky === "night" || sky === "dusk";

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {(Object.keys(SKIES) as Sky[]).map((key) => (
        <motion.div
          key={key}
          className="absolute inset-0"
          style={{ backgroundImage: SKIES[key] }}
          initial={false}
          animate={{ opacity: key === sky ? 1 : 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
      ))}
      <motion.div className="absolute inset-x-0 top-0 h-3/4" initial={false} animate={{ opacity: hasStars ? 1 : 0 }} transition={{ duration: 0.9 }}>
        {STARS.map(([left, top, size, delay]) => (
          <span
            key={`${left}-${top}`}
            className="absolute animate-[twinkle_3.4s_ease-in-out_infinite] rounded-full bg-white"
            style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s` }}
          />
        ))}
      </motion.div>
    </div>
  );
}
