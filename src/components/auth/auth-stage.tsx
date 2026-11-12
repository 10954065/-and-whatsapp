"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { LogoMark } from "@/components/brand/logo";
import { SunCharacter, type SunMood } from "@/components/brand/sun-character";
import { SunSky } from "@/components/brand/sun-sky";

/** What the person is typing into: ordinary text the sun may watch, or a secret it looks away from. */
type Attention = "text" | "secret" | null;

interface AuthStage {
  mood: SunMood;
  look: number;
  strength: number;
  attend: (attention: Attention, look?: number) => void;
  setStrength: (strength: number) => void;
  setPending: (isPending: boolean) => void;
  /** The sign-in or sign-up was refused. */
  fail: () => void;
  /** It worked: play the sunrise, then open `destination`. `quiet` skips the celebration. */
  celebrate: (destination: string, quiet?: boolean) => void;
}

const SAD_MS = 2_800;
const WIPE_DELAY_MS = 700;
const NAVIGATE_DELAY_MS = 1_250;

/** Screens where the sun takes the stage; the other auth screens keep the chat demo. */
const CHARACTER_PATHS = new Set(["/login", "/register"]);

const CAPTIONS: Record<SunMood, string> = {
  idle: "Good to see you.",
  watching: "I'm listening.",
  hiding: "I won't look.",
  pending: "One moment…",
  sad: "Hmm, that didn't work.",
  happy: "There you are.",
  lost: "Where did it go?",
};

const StageContext = createContext<AuthStage | null>(null);

export function useAuthStage(): AuthStage {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("useAuthStage must be used inside AuthStageProvider.");
  return stage;
}

export function AuthStageProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [attention, setAttention] = useState<Attention>(null);
  const [look, setLook] = useState(0);
  const [strength, setStrength] = useState(0);
  const [isPending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<"sad" | "happy" | null>(null);
  const [isWiping, setIsWiping] = useState(false);
  const sadTimer = useRef<number | undefined>(undefined);
  const successTimers = useRef<number[]>([]);

  useEffect(
    () => () => {
      window.clearTimeout(sadTimer.current);
      successTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const stage: AuthStage = {
    mood: outcome ?? (isPending ? "pending" : attention === "secret" ? "hiding" : attention === "text" ? "watching" : "idle"),
    look,
    strength,
    attend: (next, nextLook) => {
      setAttention(next);
      if (nextLook !== undefined) setLook(nextLook);
    },
    setStrength,
    setPending,
    fail: () => {
      setOutcome("sad");
      window.clearTimeout(sadTimer.current);
      sadTimer.current = window.setTimeout(() => setOutcome(null), SAD_MS);
    },
    celebrate: (destination, quiet = false) => {
      router.prefetch(destination);
      if (quiet || reduceMotion) {
        router.push(destination);
        return;
      }
      window.clearTimeout(sadTimer.current);
      setOutcome("happy");
      successTimers.current = [
        window.setTimeout(() => setIsWiping(true), WIPE_DELAY_MS),
        window.setTimeout(() => router.push(destination), NAVIGATE_DELAY_MS),
      ];
    },
  };

  return (
    <StageContext.Provider value={stage}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      {isWiping ? (
        // Sunrise: the sun's colour opens from where the sun sits, then settles to paper for the next screen.
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 animate-[sunrise-wipe_650ms_var(--ease-out-strong)_both] bg-sun [--wipe-at:50%_24%] lg:[--wipe-at:75%_64%]"
        >
          <div className="grid size-full animate-[sunrise-settle_380ms_ease-out_430ms_both] place-items-center bg-background">
            <LogoMark className="size-12" />
          </div>
        </div>
      ) : null}
    </StageContext.Provider>
  );
}

/** The dark panel beside the form. `children` is what the screens without the sun show there. */
export function AuthAside({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mood, look, strength } = useAuthStage();
  const hasCharacter = CHARACTER_PATHS.has(pathname);

  return (
    <aside className="grain relative hidden overflow-hidden bg-[#1d1a16] text-[#f3efe7] lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-10 lg:p-12">
      {hasCharacter ? (
        <>
          <SunSky mood={mood} />
          <div className="relative mt-[11vh] mb-auto grid justify-items-center gap-4">
            <p className="max-w-sm text-center font-display text-4xl leading-[1.05] tracking-[-0.01em]">
              Every customer answered. <span className="text-[#f6b383] italic">Every booking kept.</span>
            </p>
            {/* Decorative: the form itself announces errors to screen readers. */}
            <p aria-hidden="true" className="h-5 text-sm text-[#f6b383]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mood}
                  className="block"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                >
                  {CAPTIONS[mood]}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
          <SunCharacter mood={mood} look={look} strength={strength} className="absolute bottom-0 left-1/2 w-[min(38rem,62vh)] -translate-x-1/2" />
        </>
      ) : (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-72 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-sun/90" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-28 left-0 h-3 bg-[#1d1a16]/45" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-14 left-0 h-3 bg-[#1d1a16]/30" />
          <p className="relative max-w-sm text-center font-display text-4xl leading-[1.05] tracking-[-0.01em]">
            Every customer answered. <span className="text-[#f6b383] italic">Every booking kept.</span>
          </p>
          {children}
        </>
      )}
    </aside>
  );
}

/** The sun above the form on screens too narrow for the side panel. */
export function AuthMobileSun() {
  const pathname = usePathname();
  const { mood, look, strength } = useAuthStage();
  if (!CHARACTER_PATHS.has(pathname)) return null;
  return (
    <div aria-hidden="true" className="relative mb-6 h-36 shrink-0 overflow-hidden rounded-[1.75rem] bg-[#1d1a16] shadow-[0_18px_40px_-22px_rgb(59_29_74/0.7)] lg:hidden">
      <SunSky mood={mood} />
      <SunCharacter mood={mood} look={look} strength={strength} className="absolute bottom-0 left-1/2 w-48 -translate-x-1/2" />
    </div>
  );
}
