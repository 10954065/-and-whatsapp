import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { LlmClient, LlmMessage, LlmRequest, LlmResponse, LlmStopReason } from "@/modules/ai/llm/types";
import { LlmProviderError } from "@/modules/ai/llm/types";

/** The one SDK call this adapter makes; swappable in tests. */
export interface AnthropicTransport {
  create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage>;
}

/** Models that accept the server-side `fallbacks: "default"` safety fallback. */
const FALLBACK_CAPABLE = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export function supportsServerFallback(model: string): boolean {
  return FALLBACK_CAPABLE.has(model);
}

const STOP_REASONS: Record<string, LlmStopReason> = {
  end_turn: "end_turn",
  stop_sequence: "end_turn",
  tool_use: "tool_use",
  max_tokens: "max_tokens",
  refusal: "refusal",
};

/** Tool results become user turns; consecutive results share one turn, as the API expects. */
function toAnthropicMessages(messages: LlmMessage[]): BetaMessageParam[] {
  const output: BetaMessageParam[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      output.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      const toolCalls = message.toolCalls ?? [];
      if (message.providerTurn?.provider === "anthropic") {
        output.push({ role: "assistant", content: message.providerTurn.raw as BetaContentBlockParam[] });
      } else if (toolCalls.length === 0) {
        output.push({ role: "assistant", content: message.content });
      } else {
        const content: BetaContentBlockParam[] = [
          ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
          ...toolCalls.map((call) => ({ type: "tool_use" as const, id: call.id, name: call.name, input: call.input ?? {} })),
        ];
        output.push({ role: "assistant", content });
      }
    } else {
      const result: BetaToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
        is_error: message.isError,
      };
      const last = output.at(-1);
      const lastIsResults = last?.role === "user" && Array.isArray(last.content) && last.content.every((block) => block.type === "tool_result");
      if (last && lastIsResults) output[output.length - 1] = { ...last, content: [...(last.content as BetaContentBlockParam[]), result] };
      else output.push({ role: "user", content: [result] });
    }
  }
  return output;
}

export function toAnthropicParams(request: LlmRequest): MessageCreateParamsNonStreaming {
  return {
    model: request.model,
    max_tokens: request.maxOutputTokens,
    system: request.system,
    messages: toAnthropicMessages(request.messages),
    tools: request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as BetaTool["input_schema"],
    })),
    tool_choice: { type: "auto" },
    output_config: { effort: request.effort },
    cache_control: { type: "ephemeral" },
    metadata: { user_id: request.endUserId },
    ...(supportsServerFallback(request.model)
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  };
}

export function fromAnthropicMessage(message: BetaMessage): LlmResponse {
  return {
    text: message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n")
      .trim(),
    toolCalls: message.content
      .filter((block): block is BetaToolUseBlock => block.type === "tool_use")
      .map((block) => ({ id: block.id, name: block.name, input: block.input })),
    stopReason: STOP_REASONS[message.stop_reason ?? ""] ?? "other",
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    },
    providerTurn: { provider: "anthropic", raw: message.content },
  };
}

/** Claude through the native Messages API: prompt caching, effort and the server-side fallback. */
export function createAnthropicClient(options: { apiKey: string; baseUrl?: string; transport?: AnthropicTransport }): LlmClient {
  let sdk: Anthropic | undefined;
  const transport: AnthropicTransport = options.transport ?? {
    create(params) {
      sdk ??= new Anthropic({ apiKey: options.apiKey, baseURL: options.baseUrl, maxRetries: 2, timeout: 60_000 });
      return sdk.beta.messages.create(params);
    },
  };
  return {
    async create(request) {
      try {
        return fromAnthropicMessage(await transport.create(toAnthropicParams(request)));
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new LlmProviderError(`Provider error ${error.status ?? ""}: ${error.message}`, error.status ?? null);
        }
        throw error;
      }
    },
  };
}
