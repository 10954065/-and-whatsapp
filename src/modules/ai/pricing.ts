/**
 * Anthropic first-party prices in USD per million tokens (verified 2026-10).
 * Cache writes use the 5-minute TTL rate (1.25× input). Haiku 5.5's cache-read rate is
 * not separately published in our reference, so 10% of input is used as an estimate.
 * Costs are recorded as *estimates* in micro-USD and labelled as such in the UI.
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** Unknown models are priced conservatively at the Opus rate so budgets never under-count. */
const UNKNOWN_MODEL_PRICE = MODEL_PRICING["claude-opus-5-5"];

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

export function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    cacheReadTokens: total.cacheReadTokens + next.cacheReadTokens,
    cacheWriteTokens: total.cacheWriteTokens + next.cacheWriteTokens,
  };
}

/** USD per MTok equals micro-USD per token, so cost = Σ tokens × price. */
export function estimateCostMicros(model: string, usage: TokenUsage): number {
  const price = MODEL_PRICING[model] ?? UNKNOWN_MODEL_PRICE;
  return Math.ceil(
    usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite,
  );
}

export function formatUsd(micros: number): string {
  const dollars = micros / 1_000_000;
  return dollars < 0.01 && dollars > 0 ? `<$0.01` : `$${dollars.toFixed(dollars < 1 ? 3 : 2)}`;
}
