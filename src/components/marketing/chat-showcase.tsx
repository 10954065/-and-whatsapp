"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react";
import { LogoMark } from "@/components/brand/logo";
import { HERO_SCRIPTS, type ChatScript, type ChatStep } from "@/components/marketing/chat-scripts";
import { InstagramScreen, PhoneFrame, WhatsAppScreen } from "@/components/marketing/phone-chat";
import { cn } from "@/lib/utils";

const FIRST_MESSAGE_DELAY_MS = 500;
const TYPING_LEAD_MS = 450;
const ACTION_DELAY_MS = 650;
const HOLD_AFTER_END_MS = 4500;

const customerDelay = (text: string) => Math.min(800 + text.length * 16, 1900);
const typingDuration = (step: ChatStep) => (step.kind === "business" ? Math.min(900 + step.text.length * 14, 2300) : 750);

/** Steps through a script with human-feeling pauses; pauses whenever `isPlaying` is false. */
function useChatPlayback(steps: ChatStep[], isPlaying: boolean, onFinished?: () => void) {
  const [shown, setShown] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const timers: number[] = [];
    const next = steps[shown];
    if (!next) {
      if (onFinished) timers.push(window.setTimeout(onFinished, HOLD_AFTER_END_MS));
    } else if (next.kind === "business" || next.kind === "link") {
      timers.push(window.setTimeout(() => setIsTyping(true), TYPING_LEAD_MS));
      timers.push(
        window.setTimeout(() => {
          setIsTyping(false);
          setShown((count) => count + 1);
        }, TYPING_LEAD_MS + typingDuration(next)),
      );
    } else {
      const delay = shown === 0 ? FIRST_MESSAGE_DELAY_MS : next.kind === "customer" ? customerDelay(next.text) : ACTION_DELAY_MS;
      timers.push(window.setTimeout(() => setShown((count) => count + 1), delay));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [shown, isPlaying, steps, onFinished]);

  return { shown, isTyping };
}

function splitSteps(steps: ChatStep[], visible: number) {
  const messages: Array<Exclude<ChatStep, { kind: "action" }> & { index: number }> = [];
  const actions: Array<Extract<ChatStep, { kind: "action" }> & { index: number }> = [];
  let lastReplyIndex = -1;
  steps.slice(0, visible).forEach((step, index) => {
    if (step.kind === "action") actions.push({ ...step, index });
    else messages.push({ ...step, index });
    if (step.kind === "business" || step.kind === "link") lastReplyIndex = index;
  });
  return { messages, actions, lastReplyIndex };
}

function ActivityStack({ actions, className }: { actions: Array<{ index: number; title: string; detail: string }>; className?: string }) {
  const latest = actions.slice(-3).reverse();
  return (
    <ol className={cn("grid gap-2", className)} aria-label="What happened behind the scenes">
      <AnimatePresence initial={false} mode="popLayout">
        {latest.map((action, position) => (
          <motion.li
            key={action.index}
            layout
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1 - position * 0.28, x: 0, scale: 1 - position * 0.035 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            className="material flex w-64 items-start gap-3 rounded-[18px] p-3 shadow-[var(--shadow-hairline),var(--shadow-soft)]"
          >
            <LogoMark className="size-8 rounded-[8px]" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
                Sunleon <span className="normal-case tracking-normal">now</span>
              </p>
              <p className="text-[13px] leading-snug font-semibold">{action.title}</p>
              <p className="text-[12px] leading-snug text-muted-foreground">{action.detail}</p>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function ChatPlayer({
  script,
  isPlaying,
  onFinished,
  activityClassName = "lg:absolute lg:top-24 lg:-left-[17rem] xl:-left-[17.5rem]",
}: {
  script: ChatScript;
  isPlaying: boolean;
  onFinished?: () => void;
  activityClassName?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const { shown, isTyping } = useChatPlayback(script.steps, isPlaying && !shouldReduceMotion, onFinished);
  const visible = shouldReduceMotion ? script.steps.length : shown;
  const { messages, actions, lastReplyIndex } = splitSteps(script.steps, visible);
  const Screen = script.channel === "whatsapp" ? WhatsAppScreen : InstagramScreen;

  return (
    <div className="relative flex flex-col items-center gap-6 lg:block lg:w-fit">
      <div aria-hidden="true">
        <PhoneFrame>
          <Screen script={script} messages={messages} isTyping={isTyping} lastReplyIndex={lastReplyIndex} />
        </PhoneFrame>
      </div>
      <ActivityStack actions={actions} className={activityClassName} />
      <ol className="sr-only">
        {script.steps.map((step, index) => (
          <li key={index}>
            {step.kind === "customer" ? `${script.customerName}: ${step.text}` : null}
            {step.kind === "business" ? `${script.business.name}: ${step.text}` : null}
            {step.kind === "link" ? `${script.business.name} sends a link: ${step.title}` : null}
            {step.kind === "action" ? `Behind the scenes: ${step.title}, ${step.detail}` : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

const CHANNEL_LABELS = { whatsapp: "WhatsApp", instagram: "Instagram" } as const;
const CHANNEL_DOTS = { whatsapp: "bg-[#25d366]", instagram: "bg-[#e1306c]" } as const;

/** Hero showcase: alternates between a WhatsApp and an Instagram conversation. */
export function ChatShowcase({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.35 });
  const [active, setActive] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const script = HERO_SCRIPTS[active];
  const advance = useCallback(() => setActive((index) => (index + 1) % HERO_SCRIPTS.length), []);

  return (
    <figure
      ref={ref}
      className={cn("flex flex-col items-center gap-5", className)}
      aria-label={`Example conversation. ${script.summary}`}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <LayoutGroup id="channel-switch">
        <div role="tablist" aria-label="Example channel" className="flex rounded-full bg-foreground/[0.06] p-1">
          {HERO_SCRIPTS.map((entry, index) => {
            const isActive = index === active;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(index)}
                className="pressable relative flex h-8 items-center gap-2 rounded-full px-4 text-[13px] font-medium"
              >
                {isActive ? (
                  <motion.span
                    layoutId="channel-thumb"
                    className="absolute inset-0 rounded-full bg-card shadow-[var(--shadow-hairline),0_2px_6px_-2px_rgb(0_0_0/0.15)]"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                ) : null}
                <span className={cn("relative size-2 rounded-full", CHANNEL_DOTS[entry.channel])} />
                <span className={cn("relative", isActive ? "text-foreground" : "text-muted-foreground")}>{CHANNEL_LABELS[entry.channel]}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <ChatPlayer key={script.id} script={script} isPlaying={isInView && !isHovering} onFinished={advance} />
      <figcaption className="max-w-xs text-center text-xs text-muted-foreground">
        Example: {script.summary.charAt(0).toLowerCase() + script.summary.slice(1)}
      </figcaption>
    </figure>
  );
}

/** A single conversation that replays while it is on screen. */
export function LoopingChat({ script, className, activityClassName }: { script: ChatScript; className?: string; activityClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.4 });
  const [round, setRound] = useState(0);
  const replay = useCallback(() => setRound((value) => value + 1), []);

  // Start again from the top whenever the conversation scrolls back into view.
  useEffect(() => {
    if (!isInView) return;
    return () => setRound((value) => value + 1);
  }, [isInView]);

  return (
    <figure ref={ref} className={className} aria-label={`Example conversation. ${script.summary}`}>
      <ChatPlayer key={`${script.id}-${round}`} script={script} isPlaying={isInView} onFinished={replay} activityClassName={activityClassName} />
    </figure>
  );
}
