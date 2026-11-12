"use client";

import { useId } from "react";
import { motion, type Transition } from "motion/react";

export type SunMood = "idle" | "watching" | "hiding" | "pending" | "sad" | "happy" | "lost";

const INK = "#1d1a16";
const CENTER_X = 200;
const HORIZON_Y = 300;
const SUN_RADIUS = 108;
const RAY_COUNT = 12;

/** Where the sun's centre rests for each mood. The ground hides everything below the horizon. */
const SUN_Y: Record<SunMood, number> = { idle: 246, watching: 232, hiding: 356, pending: 246, sad: 254, happy: 166, lost: 240 };

const SUN_FILL: Record<SunMood, string> = {
  idle: "#ef6b1f",
  watching: "#ef6b1f",
  hiding: "#e2631c",
  pending: "#ef6b1f",
  sad: "#b56f43",
  happy: "#ff8a3d",
  lost: "#ef6b1f",
};

/** Mouth curves share one shape (move, quadratic curve) so they morph into each other. */
const MOUTH: Record<SunMood, string> = {
  idle: "M -20 26 Q 0 38 20 26",
  watching: "M -18 27 Q 0 37 18 27",
  hiding: "M -12 28 Q 0 30 12 28",
  pending: "M -12 29 Q 0 33 12 29",
  sad: "M -19 36 Q 0 22 19 36",
  happy: "M -30 20 Q 0 52 30 20",
  lost: "M -12 32 Q 3 25 14 31",
};

const EYE_OPENNESS: Record<SunMood, number> = { idle: 1, watching: 1.08, hiding: 0.12, pending: 0.9, sad: 0.72, happy: 0, lost: 1.1 };
const GLOW: Record<SunMood, number> = { idle: 0.34, watching: 0.4, hiding: 0.1, pending: 0.34, sad: 0.06, happy: 0.9, lost: 0.42 };
const RAYS: Record<SunMood, number> = { idle: 0.55, watching: 0.65, hiding: 0.18, pending: 0.55, sad: 0.1, happy: 1, lost: 0.6 };

/** The lost sun searches: its eyes hold left, glance right, hold, and come back. */
const SEARCH: Transition = { duration: 4.2, times: [0, 0.36, 0.46, 0.84, 1], ease: "easeInOut", repeat: Infinity };

/** Short streaks under the cloud: x position and start delay in seconds. */
const RAIN: [number, number][] = [
  [262, 0],
  [284, 0.45],
  [306, 0.2],
  [328, 0.65],
  [348, 0.3],
];

function browFor(mood: SunMood, side: number) {
  if (mood === "sad") return { opacity: 1, rotate: side * 17, y: 0 };
  // Puzzled: the left brow lifts, the right one stays level.
  if (mood === "lost") return side === -1 ? { opacity: 1, rotate: -12, y: -6 } : { opacity: 1, rotate: 3, y: 0 };
  return { opacity: 0, rotate: 0, y: 0 };
}

const SETTLE: Transition = { type: "spring", duration: 0.7, bounce: 0.18 };
const RISE: Transition = { type: "spring", duration: 0.9, bounce: 0.34 };
const SINK: Transition = { duration: 0.8, ease: [0.32, 0.72, 0, 1] };
const FACE: Transition = { duration: 0.28, ease: [0.23, 1, 0.32, 1] };

function moveFor(mood: SunMood): Transition {
  if (mood === "happy") return RISE;
  if (mood === "sad") return SINK;
  return SETTLE;
}

interface SunCharacterProps {
  mood: SunMood;
  /** Where the eyes point, from -1 (left) to 1 (right). */
  look?: number;
  /** Password strength from 0 to 1; a stronger password makes the hiding sun glow more. */
  strength?: number;
  className?: string;
}

/** The SUNLEON sun as a character: it watches what you type, looks away from passwords and reacts to the result. */
export function SunCharacter({ mood, look = 0, strength = 0, className }: SunCharacterProps) {
  const isHappy = mood === "happy";
  const isSad = mood === "sad";
  const isLost = mood === "lost";
  const boost = mood === "hiding" ? strength * 0.5 : 0;
  const glowId = useId();

  return (
    <svg viewBox="0 0 400 400" aria-hidden="true" className={className} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="#ff9a4d" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#ef6b1f" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ef6b1f" stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.g initial={{ y: 430 }} animate={{ y: SUN_Y[mood] }} transition={moveFor(mood)}>
        <motion.circle cx={CENTER_X} cy={0} r={230} fill={`url(#${glowId})`} initial={false} animate={{ opacity: GLOW[mood] + boost, scale: isHappy ? 1.18 : 1 }} transition={SETTLE} />

        {/* One ring of light leaves the sun when the sign-in succeeds. */}
        <motion.circle
          cx={CENTER_X}
          cy={0}
          r={SUN_RADIUS}
          fill="none"
          stroke="#ffb27a"
          strokeWidth={3}
          initial={false}
          animate={isHappy ? { scale: [1, 2.3], opacity: [0.7, 0] } : { scale: 1, opacity: 0 }}
          transition={isHappy ? { duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.15 } : { duration: 0 }}
        />

        <motion.g initial={false} animate={{ opacity: RAYS[mood] + boost, scale: isHappy ? 1.14 : isSad ? 0.9 : 1 }} transition={SETTLE}>
          <g className="origin-center animate-[spin_60s_linear_infinite] [transform-box:fill-box] motion-reduce:animate-none">
            {Array.from({ length: RAY_COUNT }, (_, index) => (
              <line
                key={index}
                x1={CENTER_X}
                y1={-(SUN_RADIUS + 16)}
                x2={CENTER_X}
                y2={-(SUN_RADIUS + (index % 2 === 0 ? 44 : 30))}
                stroke="#f6b383"
                strokeWidth={5}
                strokeLinecap="round"
                transform={`rotate(${(360 / RAY_COUNT) * index} ${CENTER_X} 0)`}
              />
            ))}
          </g>
        </motion.g>

        <motion.circle cx={CENTER_X} cy={0} r={SUN_RADIUS} initial={false} animate={{ fill: SUN_FILL[mood] }} transition={{ duration: 0.5 }} />

        <motion.g
          initial={false}
          animate={isLost ? { x: [-9, -9, 9, 9, -9], y: 0 } : { x: look * 9, y: mood === "watching" ? 3 : 0 }}
          transition={isLost ? SEARCH : SETTLE}
        >
          {[-1, 1].map((side) => (
            <g key={side} transform={`translate(${CENTER_X + side * 36} -16)`}>
              <motion.line
                x1={-13}
                y1={-25}
                x2={13}
                y2={-25}
                stroke={INK}
                strokeWidth={5}
                strokeLinecap="round"
                initial={false}
                animate={browFor(mood, side)}
                transition={FACE}
              />
              {/* Blink: a slow loop on its own layer, so it never fights the mood's eye shape. */}
              <motion.g animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4.6, times: [0, 0.93, 0.965, 1], repeat: Infinity, delay: side === 1 ? 0.03 : 0 }}>
                <motion.ellipse rx={9} ry={13} fill={INK} initial={false} animate={{ scaleY: EYE_OPENNESS[mood], opacity: isHappy ? 0 : 1 }} transition={FACE} />
              </motion.g>
              <motion.path d="M -12 4 Q 0 -12 12 4" fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" initial={false} animate={{ opacity: isHappy ? 1 : 0 }} transition={FACE} />
            </g>
          ))}
        </motion.g>

        {[-1, 1].map((side) => (
          <motion.circle key={side} cx={CENTER_X + side * 62} cy={18} r={13} fill="#ff5a36" initial={false} animate={{ opacity: isHappy ? 0.32 : 0, scale: isHappy ? 1 : 0.6 }} transition={FACE} />
        ))}

        <motion.path
          fill="none"
          stroke={INK}
          strokeWidth={5.5}
          strokeLinecap="round"
          transform={`translate(${CENTER_X} 0)`}
          initial={false}
          animate={{ d: MOUTH[mood] }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        />
      </motion.g>

      {/* A cloud drifts across when the sign-in is refused. */}
      <motion.g initial={false} animate={{ x: isSad ? 0 : 240, opacity: isSad ? 1 : 0 }} transition={isSad ? { duration: 0.9, ease: [0.32, 0.72, 0, 1] } : { duration: 0.5 }}>
        <g fill="#4d463d">
          <circle cx={268} cy={196} r={30} />
          <circle cx={304} cy={186} r={38} />
          <circle cx={342} cy={200} r={27} />
          <rect x={244} y={196} width={124} height={32} rx={16} />
        </g>
        {isSad ? (
          <g stroke="#9fb4cc" strokeWidth={3} strokeLinecap="round">
            {RAIN.map(([x, delay]) => (
              <line key={x} x1={x} y1={236} x2={x - 4} y2={250} className="animate-[rain-fall_0.9s_linear_infinite]" style={{ animationDelay: `${delay}s` }} />
            ))}
          </g>
        ) : null}
      </motion.g>

      <rect x={-600} y={HORIZON_Y} width={1600} height={400} fill={INK} />
      <motion.g initial={false} animate={{ opacity: isHappy ? 1 : isSad ? 0.4 : 0.75 }} transition={SETTLE}>
        <rect x={56} y={HORIZON_Y + 14} width={288} height={7} rx={3.5} fill="#ef6b1f" fillOpacity={0.6} />
        <rect x={110} y={HORIZON_Y + 34} width={180} height={7} rx={3.5} fill="#ef6b1f" fillOpacity={0.32} />
      </motion.g>
    </svg>
  );
}
