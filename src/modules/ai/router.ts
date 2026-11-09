export type ModelTier = "fast" | "standard" | "advanced";
export const MODEL_TIERS: ModelTier[] = ["fast", "standard", "advanced"];

const ADVANCED_SIGNALS =
  /\b(complain|complaint|refund|lawyer|legal action|sue|fraud|scam|chargeback|disappointed|unacceptable|terrible|worst|furious)\b/i;
const MULTI_STEP_SIGNALS = /\b(and also|as well as|another question|second question|compare|difference between)\b/i;

export interface RoutingInput {
  text: string;
  historyLength: number;
  override?: string | null;
}

export interface RoutingDecision {
  tier: ModelTier;
  reason: string;
}

/**
 * Cheapest suitable tier first. The fast model handles greetings, FAQs and routine tool
 * use; the standard model takes long or multi-part conversations; the advanced model is
 * reserved for complaints and disputes where careful reasoning and tone matter most.
 */
export function routeTier({ text, historyLength, override }: RoutingInput): RoutingDecision {
  if (override && (MODEL_TIERS as string[]).includes(override)) {
    return { tier: override as ModelTier, reason: "business override" };
  }
  if (ADVANCED_SIGNALS.test(text)) return { tier: "advanced", reason: "complaint or dispute language" };
  const questionCount = (text.match(/\?/g) ?? []).length;
  if (text.length > 600 || questionCount > 2 || MULTI_STEP_SIGNALS.test(text) || historyLength > 16) {
    return { tier: "standard", reason: "long or multi-part conversation" };
  }
  return { tier: "fast", reason: "routine enquiry" };
}

/** Customer chat responds well at low effort; complaints get a little more thought. */
export const TIER_EFFORT: Record<ModelTier, "low" | "medium"> = {
  fast: "low",
  standard: "low",
  advanced: "medium",
};
