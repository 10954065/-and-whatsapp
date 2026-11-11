import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { LlmClient, LlmMessage, LlmRequest, LlmResponse, LlmStopReason } from "@/modules/ai/llm/types";
import { LlmProviderError } from "@/modules/ai/llm/types";

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 10_000;
/** Error code some providers return when the model's own tool call failed their schema check. */
const TOOL_CALL_REJECTED = "tool_use_failed";

const toolCallSchema = z.looseObject({
  id: z.string().nullish(),
  function: z.looseObject({ name: z.string(), arguments: z.unknown().optional() }),
});

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.looseObject({
          // Most providers return a string; a few return typed parts (text, reasoning, ...).
          content: z.union([z.string(), z.array(z.looseObject({ type: z.string(), text: z.string().optional() }))]).nullish(),
          refusal: z.string().nullish(),
          tool_calls: z.array(toolCallSchema).nullish(),
        }),
        finish_reason: z.string().nullish(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      prompt_tokens_details: z.object({ cached_tokens: z.number().nullish() }).nullish(),
    })
    .nullish(),
});

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** What an assistant turn keeps for replay: the tool calls exactly as the provider sent them. */
interface OpenAiCompatibleTurn {
  toolCalls: unknown[];
}

/** OpenAI's own endpoints reject `max_tokens` on newer models; every other provider expects it. */
function maxTokensField(baseUrl: string): "max_tokens" | "max_completion_tokens" {
  const host = URL.canParse(baseUrl) ? new URL(baseUrl).hostname : "";
  return host === "api.openai.com" || host.endsWith(".openai.azure.com") ? "max_completion_tokens" : "max_tokens";
}

function toChatMessage(message: LlmMessage): ChatMessage {
  if (message.role === "user") return { role: "user", content: message.content };
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId, content: message.isError ? `Error: ${message.content}` : message.content };
  }
  const toolCalls = message.toolCalls ?? [];
  if (toolCalls.length === 0) return { role: "assistant", content: message.content };
  const replay = message.providerTurn?.provider === "openai-compatible" ? (message.providerTurn.raw as OpenAiCompatibleTurn).toolCalls : null;
  return {
    role: "assistant",
    content: message.content || null,
    tool_calls:
      replay ??
      toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.input ?? {}) } })),
  };
}

export function toChatCompletionBody(request: LlmRequest, baseUrl: string): Record<string, unknown> {
  const tools = request.tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  }));
  return {
    model: request.model,
    messages: [{ role: "system", content: request.system } satisfies ChatMessage, ...request.messages.map(toChatMessage)],
    ...(tools.length ? { tools, tool_choice: "auto" } : {}),
    [maxTokensField(baseUrl)]: request.maxOutputTokens,
  };
}

/** Arguments arrive as a JSON string. Invalid JSON is passed on so the tool's schema check reports it to the model. */
function parseArguments(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  if (!raw.trim()) return {};
  return isJson(raw) ? JSON.parse(raw) : raw;
}

function textOf(content: z.infer<typeof completionSchema>["choices"][number]["message"]["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content.trim();
  return content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function stopReasonOf(finish: string | null, refused: boolean, hasToolCalls: boolean): LlmStopReason {
  if (refused || finish === "content_filter") return "refusal";
  if (finish === "length") return "max_tokens";
  // Some providers report "stop" alongside tool calls, so the calls themselves decide.
  if (hasToolCalls) return "tool_use";
  return finish === "stop" || finish === null ? "end_turn" : "other";
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Replayed arguments must be valid JSON: strict providers reject the turn otherwise. */
function replayArguments(raw: unknown): string {
  if (typeof raw !== "string") return JSON.stringify(raw ?? {});
  return isJson(raw) ? raw : "{}";
}

export function fromChatCompletion(body: unknown): LlmResponse {
  const parsed = completionSchema.safeParse(body);
  if (!parsed.success) throw new LlmProviderError("Provider error: the response was not a chat completion.", null);
  const [choice] = parsed.data.choices;
  // Missing or repeated ids get a fresh one, so every call can be answered and recorded once.
  const seenIds = new Set<string>();
  const rawCalls = (choice.message.tool_calls ?? []).map((call) => {
    const id = call.id && !seenIds.has(call.id) ? call.id : `call_${randomUUID()}`;
    seenIds.add(id);
    return { ...call, id };
  });
  const promptTokens = parsed.data.usage?.prompt_tokens ?? 0;
  const cachedTokens = Math.min(parsed.data.usage?.prompt_tokens_details?.cached_tokens ?? 0, promptTokens);
  const turn: OpenAiCompatibleTurn = {
    toolCalls: rawCalls.map((call) => ({
      ...call,
      type: "function",
      function: { ...call.function, arguments: replayArguments(call.function.arguments) },
    })),
  };
  return {
    text: textOf(choice.message.content),
    toolCalls: rawCalls.map((call) => ({ id: call.id, name: call.function.name, input: parseArguments(call.function.arguments) })),
    stopReason: stopReasonOf(choice.finish_reason ?? null, Boolean(choice.message.refusal), rawCalls.length > 0),
    usage: {
      inputTokens: promptTokens - cachedTokens,
      outputTokens: parsed.data.usage?.completion_tokens ?? 0,
      cacheReadTokens: cachedTokens,
      cacheWriteTokens: 0,
    },
    providerTurn: { provider: "openai-compatible", raw: turn },
  };
}

async function errorDetail(response: Response): Promise<{ message: string; code: string | null }> {
  const text = await response.text().catch(() => "");
  try {
    const json = JSON.parse(text) as { error?: string | { message?: unknown; code?: unknown }; message?: unknown };
    const message = typeof json.error === "string" ? json.error : (json.error?.message ?? json.message);
    const code = typeof json.error === "object" && typeof json.error.code === "string" ? json.error.code : null;
    if (typeof message === "string" && message) return { message: message.slice(0, 300), code };
  } catch {
    // Not JSON: fall through to the raw body.
  }
  return { message: text.slice(0, 300) || response.statusText, code: null };
}

function retryAfterMs(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS) : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface OpenAiCompatibleOptions {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  /** False hands a 429 straight back, so a key pool can move to another key at once. */
  retryRateLimits?: boolean;
}

/**
 * Any provider that speaks the OpenAI Chat Completions format (OpenAI, Gemini, OpenRouter,
 * Groq, DeepSeek, Mistral, Ollama, ...). Rate limits and server errors are retried with
 * backoff; everything else surfaces as an LlmProviderError.
 */
export function createOpenAiCompatibleClient(options: OpenAiCompatibleOptions): LlmClient {
  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const fetchImpl = options.fetch ?? fetch;
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const retryRateLimits = options.retryRateLimits ?? true;
  return {
    async create(request) {
      const body = JSON.stringify(toChatCompletionBody(request, options.baseUrl));
      for (let attempt = 0; ; attempt += 1) {
        const canRetry = attempt < maxRetries;
        let response: Response;
        try {
          response = await fetchImpl(url, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
            body,
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (error) {
          if (canRetry) {
            await sleep(retryDelayMs * 2 ** attempt);
            continue;
          }
          throw new LlmProviderError(`Provider unreachable: ${error instanceof Error ? error.message : String(error)}`, null);
        }
        if (response.ok) {
          const json: unknown = await response.json().catch(() => undefined);
          if (json === undefined) throw new LlmProviderError(`Provider error ${response.status}: the response body was not JSON.`, response.status);
          return fromChatCompletion(json);
        }
        if (canRetry && RETRYABLE_STATUSES.has(response.status) && (retryRateLimits || response.status !== 429)) {
          await response.body?.cancel().catch(() => undefined);
          await sleep(retryAfterMs(response) ?? retryDelayMs * 2 ** attempt);
          continue;
        }
        const detail = await errorDetail(response);
        // Groq rejects a reply whose tool call broke the schema; a fresh sample usually gets it right.
        if (canRetry && detail.code === TOOL_CALL_REJECTED) {
          await sleep(retryDelayMs * 2 ** attempt);
          continue;
        }
        throw new LlmProviderError(`Provider error ${response.status}: ${detail.message}`, response.status);
      }
    },
  };
}
