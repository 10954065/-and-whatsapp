import type { AiRunTrigger, BusinessStatus, ConversationControl } from "@/generated/prisma/enums";

export type PreflightBlock =
  | "provider_not_configured"
  | "platform_disabled"
  | "business_inactive"
  | "emergency_stop"
  | "agent_disabled"
  | "human_control"
  | "outside_hours"
  | "daily_message_limit"
  | "daily_budget"
  | "monthly_budget"
  | "plan_limit";

export interface PreflightInput {
  trigger: AiRunTrigger;
  providerConfigured: boolean;
  platformEnabled: boolean;
  businessStatus: BusinessStatus;
  agent: {
    enabled: boolean;
    emergencyStop: boolean;
    businessHoursOnly: boolean;
    outOfHoursMessage: string | null;
    dailyMessageLimit: number;
    dailySpendLimitMicros: number;
    monthlySpendLimitMicros: number;
  };
  conversationControl: ConversationControl | null;
  isOpenNow: boolean;
  messagesToday: number;
  spendTodayMicros: number;
  spendMonthMicros: number;
  aiMessagesThisMonth: number;
  planMonthlyAiMessages: number;
}

export type PreflightResult =
  | { allowed: true }
  | { allowed: false; reason: PreflightBlock; autoReply?: string };

export const PREFLIGHT_LABELS: Record<PreflightBlock, string> = {
  provider_not_configured: "The AI provider is not configured on this platform yet.",
  platform_disabled: "AI replies are paused platform-wide by SUNLEON AI.",
  business_inactive: "This workspace is not active.",
  emergency_stop: "The emergency stop is on.",
  agent_disabled: "The assistant is not activated.",
  human_control: "A team member has taken over this conversation.",
  outside_hours: "The AI only replies during opening hours.",
  daily_message_limit: "The daily AI message limit has been reached.",
  daily_budget: "Today's AI spending limit has been reached.",
  monthly_budget: "This month's AI spending limit has been reached.",
  plan_limit: "The plan's monthly AI message allowance has been used.",
};

/** Every check that must pass before a single token is spent. Order matters. */
export function preflight(input: PreflightInput): PreflightResult {
  const isTest = input.trigger === "TEST_CONSOLE";
  if (!input.providerConfigured) return { allowed: false, reason: "provider_not_configured" };
  if (!input.platformEnabled) return { allowed: false, reason: "platform_disabled" };
  if (input.businessStatus !== "ACTIVE") return { allowed: false, reason: "business_inactive" };
  if (input.agent.emergencyStop) return { allowed: false, reason: "emergency_stop" };
  if (!isTest) {
    if (!input.agent.enabled) return { allowed: false, reason: "agent_disabled" };
    if (input.conversationControl === "HUMAN") return { allowed: false, reason: "human_control" };
    if (input.agent.businessHoursOnly && !input.isOpenNow) {
      return { allowed: false, reason: "outside_hours", autoReply: input.agent.outOfHoursMessage ?? undefined };
    }
    if (input.messagesToday >= input.agent.dailyMessageLimit) return { allowed: false, reason: "daily_message_limit" };
  }
  if (input.spendTodayMicros >= input.agent.dailySpendLimitMicros) return { allowed: false, reason: "daily_budget" };
  if (input.spendMonthMicros >= input.agent.monthlySpendLimitMicros) return { allowed: false, reason: "monthly_budget" };
  if (input.aiMessagesThisMonth >= input.planMonthlyAiMessages) return { allowed: false, reason: "plan_limit" };
  return { allowed: true };
}

export const SAFE_HOLDING_REPLY =
  "Thanks for your patience. Let me confirm that with the team and get right back to you.";

const MONEY_PATTERN =
  /(?:GH₵|GHS|GHC|GH¢|₵|¢|\$|USD|NGN|₦|KES|£|€)\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(?:cedis?|ghana cedis|GHS|pesewas)\b/gi;
const PAYMENT_CLAIM =
  /\b(payment|paid|momo|mobile money)\b[^.!?\n]{0,40}\b(received|confirmed|successful|verified|has gone through|went through)\b|\b(received|confirmed) your payment\b/i;
const MEDICAL_ADVICE =
  /\b(diagnos(is|e|ed)|prescri(be|ption)|dosage|\d+\s?mg\b|you (probably|likely|might) have (a|an)\b|take (this|these|two|one) (pill|tablet|capsule|medicine))/i;

function numbersIn(text: string): Set<number> {
  const values = new Set<number>();
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const value = Number(match[0].replaceAll(",", ""));
    if (Number.isFinite(value)) values.add(Math.round(value * 100) / 100);
  }
  return values;
}

export interface PostcheckInput {
  reply: string;
  /** Business facts, retrieved knowledge and tool results available in this run. */
  verifiedText: string;
  paymentVerified: boolean;
}

export interface PostcheckResult {
  ok: boolean;
  flags: string[];
  reply: string;
}

/**
 * Last line of defence before a reply leaves the platform: blocks prices that do not
 * appear in verified sources, unverified payment confirmations and medical advice.
 */
export function postcheck({ reply, verifiedText, paymentVerified }: PostcheckInput): PostcheckResult {
  const flags: string[] = [];
  const verifiedNumbers = numbersIn(verifiedText);
  for (const match of reply.matchAll(MONEY_PATTERN)) {
    const raw = (match[1] ?? match[2] ?? "").replaceAll(",", "");
    const value = Math.round(Number(raw) * 100) / 100;
    if (Number.isFinite(value) && !verifiedNumbers.has(value)) {
      flags.push("unverified_price");
      break;
    }
  }
  if (!paymentVerified && PAYMENT_CLAIM.test(reply)) flags.push("unverified_payment_claim");
  if (MEDICAL_ADVICE.test(reply)) flags.push("medical_advice");
  if (flags.length) return { ok: false, flags, reply: SAFE_HOLDING_REPLY };
  return { ok: true, flags, reply };
}

/** En dash, em dash, horizontal bar, or two or more hyphens used as punctuation. */
const PUNCTUATION_DASH = "(?:[–—―]|-{2,})";

/** Applied in order; later rules rely on earlier ones having handled lines, lists and ranges. */
const DASH_RULES: [RegExp, string][] = [
  [/^[ \t]*(?:[-–—―][ \t]*){3,}$/gm, ""], // divider lines: --- or ———
  [/^([ \t]*)-[ \t]+/gm, "$1• "], // "- item" lists
  [new RegExp(`^[ \\t]*${PUNCTUATION_DASH}[ \\t]*`, "gm"), ""], // a dash opening a line ("— Ama")
  [new RegExp(`(?:[ \\t]*${PUNCTUATION_DASH}|[ \\t]+-)[ \\t]*$`, "gm"), ""], // a dash closing a line
  [new RegExp(`(\\d[\\w.:]*)[ \\t]*${PUNCTUATION_DASH}[ \\t]*(?=\\d)`, "g"), "$1 to "], // 9–5, 10am — 2pm
  [/(\d[\w.:]*)[ \t]+-[ \t]+(?=\d)/g, "$1 to "], // 9am - 5pm
  [/(\p{L})–(?=\p{L})/gu, "$1 to "], // Mon–Fri
  [new RegExp(`[ \\t]*${PUNCTUATION_DASH}[ \\t]*`, "g"), ", "], // "great — thanks"
  [/(\S)[ \t]+-[ \t]+(?=\S)/g, "$1, "], // "great - thanks"
  [/([.!?;:,])[ \t]*,/g, "$1"], // tidy "!," and ",,"
  [/,[ \t]*([.!?;:])/g, "$1"], // tidy ", ."
  [/\n{3,}/g, "\n\n"],
];

/**
 * Removes dashes used as punctuation so replies read like a person typed them: em and en
 * dashes, "--" and a spaced " - " become commas, ranges become "to", "- item" lists become
 * bullets and divider lines go. Hyphens inside words, phone numbers, dates and links stay.
 */
export function removeDashes(text: string): string {
  return DASH_RULES.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text).trim();
}

/** Channel message limits (WhatsApp text 4096 chars; Instagram text 1000 bytes). */
export function clampForChannel(text: string, channel: "WHATSAPP" | "INSTAGRAM" | "SANDBOX"): string {
  const limit = channel === "INSTAGRAM" ? 950 : 4_000;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}
