import type { TokenUsage } from "@/modules/ai/pricing";

/**
 * Provider-neutral shapes for one model call. Each adapter translates these to and from
 * its provider's wire format, so the orchestrator never handles a provider SDK type.
 */
export type AiProviderKind = "anthropic" | "openai-compatible";

export interface LlmToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's input object. */
  inputSchema: Record<string, unknown>;
}

/** The provider's own record of an assistant turn, replayed only to the provider that produced it. */
export interface ProviderTurn {
  provider: AiProviderKind;
  raw: unknown;
}

export type LlmMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[]; providerTurn?: ProviderTurn }
  | { role: "tool"; toolCallId: string; content: string; isError: boolean };

export type LlmStopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface LlmRequest {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  maxOutputTokens: number;
  /** A hint; providers without an effort control ignore it. */
  effort: "low" | "medium";
  /** Opaque end-user id for provider abuse monitoring, sent where the provider supports it. */
  endUserId: string;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  stopReason: LlmStopReason;
  usage: TokenUsage;
  providerTurn: ProviderTurn;
}

/** The single seam between SUNLEON AI and a model provider (swappable in tests). */
export interface LlmClient {
  create(request: LlmRequest): Promise<LlmResponse>;
}

/** A provider rejected or failed the request. `status` is the HTTP status when there was one. */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}
