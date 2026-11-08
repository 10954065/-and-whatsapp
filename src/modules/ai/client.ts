import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { env } from "@/lib/env";

/** The single seam between SUNLEON AI and the model provider (swappable in tests). */
export interface LlmClient {
  create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage>;
}

let client: Anthropic | undefined;

export function isAnthropicConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

export const anthropicLlm: LlmClient = {
  async create(params) {
    client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
    return client.beta.messages.create(params);
  },
};

export { Anthropic };
