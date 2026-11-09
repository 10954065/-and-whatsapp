"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, CheckCheck, ChevronLeft, Image as ImageIcon, Mic, Phone, Plus, Smile, Sticker, Video } from "lucide-react";
import type { ChatScript, ChatStep } from "@/components/marketing/chat-scripts";
import { cn } from "@/lib/utils";

type VisibleMessage = Exclude<ChatStep, { kind: "action" }> & { index: number };

export interface ChatScreenProps {
  script: ChatScript;
  messages: VisibleMessage[];
  isTyping: boolean;
  /** Index of the latest business reply; customer messages before it count as read. */
  lastReplyIndex: number;
}

const bubbleMotion = {
  initial: { opacity: 0, y: 14, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, bounce: 0.28, duration: 0.5 },
};

export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative w-[292px] shrink-0 rounded-[3.1rem] bg-[#1d1a16] p-[10px] ring-1 ring-white/15 shadow-[0_0_0_1px_rgb(255_255_255/0.06)_inset,0_2px_3px_rgb(0_0_0/0.2),0_50px_90px_-30px_rgb(40_25_10/0.55)]",
        className,
      )}
    >
      <span className="absolute top-28 -left-[3px] h-8 w-[3px] rounded-l-sm bg-[#2b2621]" />
      <span className="absolute top-40 -left-[3px] h-12 w-[3px] rounded-l-sm bg-[#2b2621]" />
      <span className="absolute top-36 -right-[3px] h-16 w-[3px] rounded-r-sm bg-[#2b2621]" />
      <div className="relative h-[590px] overflow-hidden rounded-[2.45rem] bg-white text-[#111b21]">
        <span className="absolute top-2.5 left-1/2 z-30 h-[25px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
        {children}
        <span className="absolute bottom-1.5 left-1/2 z-30 h-[4px] w-28 -translate-x-1/2 rounded-full bg-black/85" />
      </div>
    </div>
  );
}

function StatusBar({ time }: { time: string }) {
  return (
    <div className="flex h-11 items-end justify-between px-7 pb-1.5 text-[12.5px] font-semibold tracking-tight">
      <span>{time}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4" rx="0.8" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.8" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.8" />
          <rect x="13.5" y="0" width="3" height="11" rx="0.8" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
          <path d="M7.5 2.2c2.1 0 4 .8 5.5 2.1l1.2-1.3A9.6 9.6 0 0 0 7.5.4 9.6 9.6 0 0 0 .8 3l1.2 1.3a7.8 7.8 0 0 1 5.5-2.1Zm0 3.4c1.2 0 2.3.5 3.2 1.2l1.2-1.3a6.3 6.3 0 0 0-8.8 0l1.2 1.3a4.6 4.6 0 0 1 3.2-1.2Zm0 3.4c.4 0 .8.2 1 .4L7.5 10.6 6.5 9.4c.3-.2.6-.4 1-.4Z" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
          <path d="M23 4v4c.8-.3 1.3-1.1 1.3-2S23.8 4.3 23 4Z" fill="currentColor" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-[3px]", className)} aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="size-[6px] rounded-full bg-current motion-safe:animate-[typing-dot_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${dot * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function BusinessAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#1d1a16] font-semibold text-[#f6b383]",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ WhatsApp (iOS) */

export function WhatsAppScreen({ script, messages, isTyping, lastReplyIndex }: ChatScreenProps) {
  const firstTime = messages[0]?.time ?? script.steps.find((step) => step.kind === "customer")?.time ?? "09:41";
  return (
    <div className="flex h-full flex-col">
      <div className="bg-[#f6f6f6]/95 shadow-[0_0.5px_0_rgb(0_0_0/0.18)]">
        <StatusBar time={firstTime} />
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <ChevronLeft className="size-6 text-[#007aff]" strokeWidth={2.4} />
          <BusinessAvatar initials={script.business.initials} className="size-8 text-[11px]" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-semibold">{script.business.name}</p>
            <p className="text-[11px] text-[#667781]">{isTyping ? "typing…" : "Business account"}</p>
          </div>
          <Video className="size-[19px] text-[#007aff]" />
          <Phone className="mr-1.5 ml-3 size-[17px] text-[#007aff]" />
        </div>
      </div>
      <div
        className="relative flex flex-1 flex-col justify-end gap-1 overflow-hidden px-2.5 pt-3 pb-2 [mask-image:linear-gradient(to_bottom,transparent,black_28px)]"
        style={{
          backgroundColor: "#efe7de",
          backgroundImage: "radial-gradient(rgb(120 90 60 / 0.07) 1px, transparent 1.2px)",
          backgroundSize: "14px 14px",
        }}
      >
        <p className="mx-auto mb-1 rounded-md bg-white/90 px-2 py-0.5 text-[10.5px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgb(0_0_0/0.1)]">
          Today
        </p>
        <p className="mx-auto mb-2 max-w-[88%] rounded-lg bg-[#fff3c4] px-2.5 py-1.5 text-center text-[10.5px] leading-snug text-[#54656f]">
          {script.business.name} uses an assistant to reply. Ask for a person any time.
        </p>
        {messages.map((message) => {
          const isOwn = message.kind === "customer";
          return (
            <motion.div
              key={message.index}
              layout="position"
              {...bubbleMotion}
              style={{ originX: isOwn ? 1 : 0, originY: 1 }}
              className={cn("max-w-[80%]", isOwn ? "self-end" : "self-start")}
            >
              {message.kind === "link" ? (
                <div className="w-52 overflow-hidden rounded-[12px] rounded-bl-[4px] bg-white p-1 shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]">
                  <div className="rounded-[9px] bg-[#f5f6f6] p-2.5">
                    <p className="text-[10px] font-semibold tracking-wide text-[#0ba4db] uppercase">checkout.paystack.com</p>
                    <p className="mt-0.5 text-[13px] font-semibold">{message.title}</p>
                    <p className="text-[11px] text-[#667781]">{message.subtitle}</p>
                  </div>
                  <p className="px-1.5 pt-1 pb-0.5 text-right text-[10px] text-[#667781]">{message.time}</p>
                </div>
              ) : (
                <p
                  className={cn(
                    "rounded-[12px] px-2.5 py-1.5 text-[13px] leading-[1.32] shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]",
                    isOwn ? "rounded-br-[4px] bg-[#d9fdd3]" : "rounded-bl-[4px] bg-white",
                  )}
                >
                  {message.text}
                  <span className="float-right mt-1.5 ml-2 inline-flex translate-y-[3px] items-center gap-0.5 text-[10px] text-[#667781]">
                    {message.time}
                    {isOwn ? (
                      <CheckCheck
                        className={cn("size-3.5 transition-colors duration-500", message.index < lastReplyIndex || isTyping ? "text-[#53bdeb]" : "text-[#8696a0]")}
                      />
                    ) : null}
                  </span>
                </p>
              )}
            </motion.div>
          );
        })}
        <AnimatePresence>
          {isTyping ? (
            <motion.div
              key="typing"
              layout="position"
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              style={{ originX: 0, originY: 1 }}
              className="self-start rounded-[12px] rounded-bl-[4px] bg-white px-3 py-2.5 text-[#8696a0] shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]"
            >
              <TypingDots />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2.5 bg-[#f6f6f6] px-3 pt-2 pb-6 text-[#007aff]">
        <Plus className="size-5" />
        <span className="flex h-8 flex-1 items-center justify-end rounded-full border border-black/10 bg-white px-2.5">
          <Sticker className="size-4 text-[#8696a0]" />
        </span>
        <Camera className="size-5" />
        <Mic className="size-5" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Instagram direct messages */

export function InstagramScreen({ script, messages, isTyping, lastReplyIndex }: ChatScreenProps) {
  const firstTime = messages[0]?.time ?? "14:05";
  const lastOwnIndex = [...messages].reverse().find((message) => message.kind === "customer")?.index ?? -1;
  const isSeen = isTyping || lastOwnIndex < lastReplyIndex;
  return (
    <div className="flex h-full flex-col bg-white">
      <StatusBar time={firstTime} />
      <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-2.5 shadow-[0_0.5px_0_rgb(0_0_0/0.1)]">
        <ChevronLeft className="size-6" strokeWidth={2.2} />
        <span className="rounded-full bg-[conic-gradient(from_200deg,#f5a524,#ef6b1f,#d9480f,#f5a524)] p-[2px]">
          <BusinessAvatar initials={script.business.initials} className="size-8 border-2 border-white text-[10.5px]" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">{script.business.handle}</p>
          <p className="text-[11px] text-[#737373]">{isTyping ? "Typing…" : "Active now"}</p>
        </div>
        <Phone className="size-[19px]" strokeWidth={1.8} />
        <Video className="mr-1 ml-3 size-[22px]" strokeWidth={1.8} />
      </div>
      <div className="relative flex flex-1 flex-col justify-end gap-1 overflow-hidden px-3 pt-3 pb-2 [mask-image:linear-gradient(to_bottom,transparent,black_28px)]">
        <div className="mb-3 flex flex-col items-center text-center">
          <BusinessAvatar initials={script.business.initials} className="size-16 text-lg" />
          <p className="mt-2 text-[14px] font-semibold">{script.business.name}</p>
          <p className="text-[11px] text-[#737373]">{script.business.handle} · Instagram</p>
          <span className="mt-2 rounded-lg bg-[#efefef] px-3 py-1 text-[11.5px] font-semibold">View profile</span>
          <p className="mt-4 text-[10.5px] font-medium text-[#737373]">Today {firstTime}</p>
        </div>
        {messages.map((message) => {
          const isOwn = message.kind === "customer";
          const text = message.kind === "link" ? `${message.title} · ${message.subtitle}` : message.text;
          return (
            <motion.div
              key={message.index}
              layout="position"
              {...bubbleMotion}
              style={{ originX: isOwn ? 1 : 0, originY: 1 }}
              className={cn("flex max-w-[82%] items-end gap-1.5", isOwn ? "self-end" : "self-start")}
            >
              {!isOwn ? <BusinessAvatar initials={script.business.initials} className="size-6 text-[8.5px]" /> : null}
              <p
                className={cn(
                  "rounded-[20px] px-3 py-2 text-[13px] leading-[1.32]",
                  isOwn ? "bg-[#3797f0] text-white" : "bg-[#efefef] text-[#0c1014]",
                )}
              >
                {text}
              </p>
            </motion.div>
          );
        })}
        {isSeen && lastOwnIndex >= 0 ? (
          <motion.p
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="-mt-0.5 self-end pr-1 text-[10.5px] text-[#737373]"
          >
            Seen
          </motion.p>
        ) : null}
        <AnimatePresence>
          {isTyping ? (
            <motion.div
              key="typing"
              layout="position"
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              style={{ originX: 0, originY: 1 }}
              className="flex items-end gap-1.5 self-start"
            >
              <BusinessAvatar initials={script.business.initials} className="size-6 text-[8.5px]" />
              <span className="rounded-[20px] bg-[#efefef] px-3.5 py-3 text-[#8e8e8e]">
                <TypingDots />
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="px-3 pt-1.5 pb-6">
        <div className="flex h-10 items-center gap-2 rounded-full bg-[#efefef] pr-3 pl-1.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#3797f0] text-white">
            <Camera className="size-4" />
          </span>
          <span className="flex-1 text-[13px] text-[#737373]">Message…</span>
          <Mic className="size-[18px]" />
          <ImageIcon className="size-[18px]" />
          <Smile className="size-[18px]" />
        </div>
      </div>
    </div>
  );
}
