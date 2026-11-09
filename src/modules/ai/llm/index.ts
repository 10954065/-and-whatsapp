import { aiProviderSettings, type AiProviderSettings } from "@/lib/env";
import { createAnthropicClient } from "@/modules/ai/llm/anthropic";
import { createOpenAiCompatibleClient } from "@/modules/ai/llm/openai-compatible";
import type { LlmClient } from "@/modules/ai/llm/types";
import type { ModelTier } from "@/modules/ai/router";

export type { LlmClient, LlmMessage, LlmRequest, LlmResponse, LlmToolCall, LlmToolDefinition } from "@/modules/ai/llm/types";
export { LlmProviderError } from "@/modules/ai/llm/types";

let cached: { signature: string; client: LlmClient } | undefined;

export function isAiConfigured(): boolean {
  return aiProviderSettings().missing.length === 0;
}

function createClient(settings: AiProviderSettings): LlmClient | null {
  if (!settings.apiKey) return null;
  if (settings.provider === "anthropic") return createAnthropicClient({ apiKey: settings.apiKey, baseUrl: settings.baseUrl });
  return settings.baseUrl ? createOpenAiCompatibleClient({ apiKey: settings.apiKey, baseUrl: settings.baseUrl }) : null;
}

/** The configured provider's client, or null until the AI is configured. */
export function getLlmClient(): LlmClient | null {
  const settings = aiProviderSettings();
  if (settings.missing.length > 0) return null;
  const signature = [settings.provider, settings.baseUrl ?? "", settings.apiKey ?? ""].join("|");
  if (cached?.signature !== signature) {
    const client = createClient(settings);
    if (!client) return null;
    cached = { signature, client };
  }
  return cached.client;
}

/** The model id for a routing tier. */
export function modelForTier(tier: ModelTier): string {
  const model = aiProviderSettings().models[tier];
  if (!model) throw new Error("No AI model is configured (set AI_MODEL).");
  return model;
}

/** "Anthropic", or the OpenAI-compatible host, e.g. "OpenAI-compatible (openrouter.ai)". */
export function aiProviderLabel(): string {
  const settings = aiProviderSettings();
  if (settings.provider === "anthropic") return "Anthropic";
  const host = settings.baseUrl && URL.canParse(settings.baseUrl) ? new URL(settings.baseUrl).host : "custom endpoint";
  return `OpenAI-compatible (${host})`;
}
