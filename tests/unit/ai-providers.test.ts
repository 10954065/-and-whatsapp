import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiProviderSettings, env, resetEnvCache } from "@/lib/env";
import { aiProviderLabel, getLlmClient, isAiConfigured, LlmProviderError, modelForTier, type LlmRequest } from "@/modules/ai/llm";
import { createAnthropicClient } from "@/modules/ai/llm/anthropic";
import { createOpenAiCompatibleClient } from "@/modules/ai/llm/openai-compatible";
import { estimateCostMicros } from "@/modules/ai/pricing";
import { executeTool, toolDefinitions } from "@/modules/ai/tools";
import type { ToolContext } from "@/modules/ai/tools/types";

const AI_KEYS = [
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
  "AI_MODEL_FAST",
  "AI_MODEL_STANDARD",
  "AI_MODEL_ADVANCED",
  "AI_MODEL_PRICES",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL_FAST",
  "ANTHROPIC_MODEL_STANDARD",
  "ANTHROPIC_MODEL_ADVANCED",
];

function setEnv(values: Record<string, string>) {
  Object.assign(process.env, values);
  resetEnvCache();
}

afterEach(() => {
  for (const key of AI_KEYS) delete process.env[key];
  resetEnvCache();
});

const TOOL = { name: "capture_lead", description: "Record a lead.", inputSchema: { type: "object", properties: { interest: { type: "string" } } } };

function request(overrides: Partial<LlmRequest> = {}): LlmRequest {
  return {
    model: "test-model",
    system: "You are the assistant.",
    messages: [{ role: "user", content: "Hi" }],
    tools: [TOOL],
    maxOutputTokens: 1_024,
    effort: "low",
    endUserId: "biz_1",
    ...overrides,
  };
}

describe("AI provider settings", () => {
  it("defaults to Anthropic with Claude models and waits for a key", () => {
    expect(aiProviderSettings()).toMatchObject({
      provider: "anthropic",
      models: { fast: "claude-haiku-5-5", standard: "claude-sonnet-5-5", advanced: "claude-opus-5-5" },
      missing: ["AI_API_KEY"],
    });
    expect(isAiConfigured()).toBe(false);
    expect(getLlmClient()).toBeNull();
  });

  it("accepts AI_API_KEY, or the older ANTHROPIC_API_KEY, for Anthropic", () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-ant-legacy" });
    expect(aiProviderSettings().apiKey).toBe("sk-ant-legacy");
    setEnv({ AI_API_KEY: "sk-ant-new" });
    expect(aiProviderSettings().apiKey).toBe("sk-ant-new");
    expect(getLlmClient()).not.toBeNull();
    expect(aiProviderLabel()).toBe("Anthropic");
  });

  it("still honours the older ANTHROPIC_MODEL_* names for Anthropic, below the AI_MODEL_* settings", () => {
    setEnv({ ANTHROPIC_MODEL_FAST: "claude-pinned", ANTHROPIC_MODEL_ADVANCED: "claude-old-advanced", AI_MODEL_ADVANCED: "claude-new-advanced" });
    expect(aiProviderSettings().models).toEqual({ fast: "claude-pinned", standard: "claude-sonnet-5-5", advanced: "claude-new-advanced" });
    setEnv({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k" });
    expect(aiProviderSettings()).toMatchObject({ missing: ["AI_MODEL"] });
  });

  it("needs a key and a model for an OpenAI-compatible provider, and defaults to OpenAI's endpoint", () => {
    setEnv({ AI_PROVIDER: "openai-compatible", ANTHROPIC_API_KEY: "sk-ant-ignored" });
    expect(aiProviderSettings()).toMatchObject({ baseUrl: "https://api.openai.com/v1", missing: ["AI_API_KEY", "AI_MODEL"] });
    setEnv({ AI_API_KEY: "sk-test", AI_MODEL: "gpt-5-mini" });
    expect(isAiConfigured()).toBe(true);
    expect(aiProviderLabel()).toBe("OpenAI-compatible (api.openai.com)");
  });

  it("uses AI_MODEL for every tier unless a tier is set, and falls back to the cheaper tier", () => {
    setEnv({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "base-model", AI_MODEL_ADVANCED: "big-model" });
    expect([modelForTier("fast"), modelForTier("standard"), modelForTier("advanced")]).toEqual(["base-model", "base-model", "big-model"]);
    delete process.env.AI_MODEL;
    delete process.env.AI_MODEL_ADVANCED;
    setEnv({ AI_MODEL_FAST: "only-model" });
    expect([modelForTier("standard"), modelForTier("advanced")]).toEqual(["only-model", "only-model"]);
  });

  it("strips a trailing slash from the base URL and labels the host", () => {
    setEnv({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "https://openrouter.ai/api/v1/" });
    expect(aiProviderSettings().baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(aiProviderLabel()).toBe("OpenAI-compatible (openrouter.ai)");
  });

  it("prices configured models, charging unpriced cache tokens at the input rate", () => {
    setEnv({ AI_MODEL_PRICES: JSON.stringify({ "gpt-5-mini": { input: 0.25, output: 2 } }) });
    expect(estimateCostMicros("gpt-5-mini", { inputTokens: 1_000, outputTokens: 1_000, cacheReadTokens: 1_000, cacheWriteTokens: 0 })).toBe(2_500);
  });

  it("rejects malformed price configuration at startup", () => {
    setEnv({ AI_MODEL_PRICES: "{not json" });
    expect(() => env()).toThrow(/AI_MODEL_PRICES: must be valid JSON/);
    setEnv({ AI_MODEL_PRICES: JSON.stringify({ "gpt-5-mini": { input: "cheap" } }) });
    expect(() => env()).toThrow(/AI_MODEL_PRICES/);
  });
});

describe("tool schemas across providers", () => {
  const testContext: ToolContext = {
    businessId: "biz_1",
    conversationId: null,
    customerId: null,
    aiRunId: "run_1",
    mode: "test",
    timezone: "Africa/Accra",
    currency: "GHS",
    maxDiscountPercent: 0,
  };

  it("lets optional fields be null and keeps required ones strict", () => {
    const [captureLead] = toolDefinitions(["capture_lead"]);
    const properties = captureLead.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(captureLead.inputSchema.required).toEqual(["interest"]);
    expect(properties.interest).toMatchObject({ type: "string" });
    expect(properties.estimated_value).toMatchObject({
      anyOf: [{ type: "integer" }, { type: "null" }],
      description: expect.stringContaining("pesewas"),
    });
    expect(captureLead.inputSchema).not.toHaveProperty("$schema");
  });

  it("treats null as not provided when the model fills an unknown optional field", async () => {
    const policy = { permitted: ["capture_lead"], approvalRequired: [] };
    const nulled = await executeTool("capture_lead", { interest: "Kente midi dress, size M", estimated_value: null }, testContext, policy);
    expect(nulled.status).toBe("EXECUTED");
    const missing = await executeTool("capture_lead", { interest: null }, testContext, policy);
    expect(missing).toMatchObject({ status: "FAILED", outcome: { message: expect.stringContaining("interest") } });
  });
});

describe("Anthropic adapter", () => {
  function anthropicWith(response: Partial<BetaMessage>) {
    const calls: MessageCreateParamsNonStreaming[] = [];
    const client = createAnthropicClient({
      apiKey: "sk-ant",
      transport: {
        async create(params) {
          calls.push(params);
          return {
            content: [{ type: "text", text: "Hello!" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 },
            ...response,
          } as unknown as BetaMessage;
        },
      },
    });
    return { client, calls };
  }

  it("sends caching, effort and the safety fallback, and no sampling parameters", async () => {
    const { client, calls } = anthropicWith({});
    await client.create(request({ model: "claude-sonnet-5-5", effort: "medium" }));
    expect(calls[0]).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: 1_024,
      tool_choice: { type: "auto" },
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      metadata: { user_id: "biz_1" },
      fallbacks: "default",
      tools: [{ name: "capture_lead", input_schema: TOOL.inputSchema }],
    });
    expect(calls[0]).not.toHaveProperty("temperature");
    await client.create(request({ model: "claude-haiku-5-5" }));
    expect(calls[1]).not.toHaveProperty("fallbacks");
  });

  it("replays its own assistant turns and groups tool results into one user turn", async () => {
    const { client, calls } = anthropicWith({});
    const raw = [{ type: "tool_use", id: "toolu_1", name: "capture_lead", input: { interest: "dress" } }];
    await client.create(
      request({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "", toolCalls: [{ id: "toolu_1", name: "capture_lead", input: {} }], providerTurn: { provider: "anthropic", raw } },
          { role: "tool", toolCallId: "toolu_1", content: "Saved.", isError: false },
          { role: "tool", toolCallId: "toolu_2", content: "Not allowed.", isError: true },
        ],
      }),
    );
    expect(calls[0].messages).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: raw },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_1", content: "Saved.", is_error: false },
          { type: "tool_result", tool_use_id: "toolu_2", content: "Not allowed.", is_error: true },
        ],
      },
    ]);
  });

  it("maps replies, tool calls, stop reasons and usage", async () => {
    const { client } = anthropicWith({
      content: [
        { type: "text", text: "Let me note that." },
        { type: "tool_use", id: "toolu_9", name: "capture_lead", input: { interest: "dress" } },
      ] as BetaMessage["content"],
      stop_reason: "tool_use",
    });
    expect(await client.create(request())).toMatchObject({
      text: "Let me note that.",
      toolCalls: [{ id: "toolu_9", name: "capture_lead", input: { interest: "dress" } }],
      stopReason: "tool_use",
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheWriteTokens: 2 },
    });
  });

  it("turns SDK API errors into provider errors with the HTTP status", async () => {
    const client = createAnthropicClient({
      apiKey: "bad",
      transport: { create: async () => Promise.reject(new Anthropic.APIError(401, undefined, "invalid x-api-key", new Headers())) },
    });
    const failure = await client.create(request()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(LlmProviderError);
    expect(failure).toMatchObject({ status: 401, message: expect.stringContaining("invalid x-api-key") });
  });
});

describe("OpenAI-compatible adapter", () => {
  type Reply = { status?: number; body: unknown; headers?: Record<string, string> };

  function provider(replies: Reply[], baseUrl = "https://llm.example.test/v1") {
    const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: reply.headers });
    });
    const client = createOpenAiCompatibleClient({ apiKey: "sk-test", baseUrl, fetch: fetchStub as typeof fetch, retryDelayMs: 0 });
    return { client, calls, fetchStub };
  }

  const completion = (message: Record<string, unknown>, finish = "stop", usage: Record<string, unknown> = { prompt_tokens: 100, completion_tokens: 20 }) => ({
    choices: [{ message: { role: "assistant", ...message }, finish_reason: finish }],
    usage,
  });

  it("sends a standard chat completion with the key, system prompt and tools", async () => {
    const { client, calls } = provider([{ body: completion({ content: "Hello!" }) }]);
    const reply = await client.create(request());
    expect(calls[0].url).toBe("https://llm.example.test/v1/chat/completions");
    expect(calls[0].headers.authorization).toBe("Bearer sk-test");
    expect(calls[0].body).toEqual({
      model: "test-model",
      messages: [
        { role: "system", content: "You are the assistant." },
        { role: "user", content: "Hi" },
      ],
      tools: [{ type: "function", function: { name: "capture_lead", description: "Record a lead.", parameters: TOOL.inputSchema } }],
      tool_choice: "auto",
      max_tokens: 1_024,
    });
    expect(reply).toMatchObject({ text: "Hello!", toolCalls: [], stopReason: "end_turn", usage: { inputTokens: 100, outputTokens: 20 } });
  });

  it("uses max_completion_tokens on OpenAI's own endpoint and omits tools when there are none", async () => {
    const { client, calls } = provider([{ body: completion({ content: "Hi" }) }], "https://api.openai.com/v1");
    await client.create(request({ tools: [] }));
    expect(calls[0].body).toMatchObject({ max_completion_tokens: 1_024 });
    expect(calls[0].body).not.toHaveProperty("max_tokens");
    expect(calls[0].body).not.toHaveProperty("tools");
    expect(calls[0].body).not.toHaveProperty("tool_choice");
  });

  it("parses tool calls and replays them exactly, provider extras included", async () => {
    const rawCall = {
      id: "call_abc",
      type: "function",
      function: { name: "capture_lead", arguments: '{"interest":"kente dress"}' },
      extra_content: { google: { thought_signature: "sig-1" } },
    };
    const { client, calls } = provider([{ body: completion({ content: null, tool_calls: [rawCall] }, "tool_calls") }, { body: completion({ content: "Noted!" }) }]);
    const first = await client.create(request());
    expect(first).toMatchObject({ stopReason: "tool_use", toolCalls: [{ id: "call_abc", name: "capture_lead", input: { interest: "kente dress" } }] });

    await client.create(
      request({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: first.text, toolCalls: first.toolCalls, providerTurn: first.providerTurn },
          { role: "tool", toolCallId: "call_abc", content: "Invalid input: interest", isError: true },
        ],
      }),
    );
    expect(calls[1].body.messages).toEqual([
      { role: "system", content: "You are the assistant." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: null, tool_calls: [rawCall] },
      { role: "tool", tool_call_id: "call_abc", content: "Error: Invalid input: interest" },
    ]);
  });

  it("builds standard tool calls for turns another provider produced", async () => {
    const { client, calls } = provider([{ body: completion({ content: "Done" }) }]);
    await client.create(
      request({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "", toolCalls: [{ id: "toolu_1", name: "capture_lead", input: { interest: "dress" } }], providerTurn: { provider: "anthropic", raw: [] } },
          { role: "tool", toolCallId: "toolu_1", content: "Saved.", isError: false },
        ],
      }),
    );
    expect((calls[0].body.messages as unknown[])[2]).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [{ id: "toolu_1", type: "function", function: { name: "capture_lead", arguments: '{"interest":"dress"}' } }],
    });
  });

  it("treats tool calls as tool use even when the provider says stop, and keeps bad JSON for the schema check", async () => {
    const { client, calls } = provider([{ body: completion({ tool_calls: [{ function: { name: "capture_lead", arguments: "{oops" } }] }, "stop") }]);
    const reply = await client.create(request());
    expect(reply.stopReason).toBe("tool_use");
    expect(reply.toolCalls[0]).toMatchObject({ name: "capture_lead", input: "{oops", id: expect.stringMatching(/^call_/) });

    // The broken arguments are never sent back: strict providers reject invalid JSON in history.
    await client.create(request({ messages: [{ role: "assistant", content: "", toolCalls: reply.toolCalls, providerTurn: reply.providerTurn }] }));
    const replayed = (calls[1].body.messages as { tool_calls?: { function: { arguments: string } }[] }[])[1];
    expect(replayed.tool_calls?.[0].function.arguments).toBe("{}");
  });

  it("gives repeated tool-call ids a fresh id so each call is answered and recorded once", async () => {
    const duplicate = { id: "call_1", type: "function", function: { name: "capture_lead", arguments: "{}" } };
    const { client } = provider([{ body: completion({ tool_calls: [duplicate, duplicate] }, "tool_calls") }]);
    const [first, second] = (await client.create(request())).toolCalls;
    expect(first.id).toBe("call_1");
    expect(second.id).not.toBe("call_1");
  });

  it("maps refusals, filters, truncation, text parts and cached tokens", async () => {
    const replies = [
      { body: completion({ content: null, refusal: "I can't help with that." }) },
      { body: completion({ content: "partial" }, "content_filter") },
      { body: completion({ content: "cut off" }, "length") },
      { body: completion({ content: [{ type: "reasoning", text: "thinking" }, { type: "text", text: "Akwaaba!" }] }) },
      { body: completion({ content: "cached" }, "stop", { prompt_tokens: 1_000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 800 } }) },
    ];
    const { client } = provider(replies);
    expect((await client.create(request())).stopReason).toBe("refusal");
    expect((await client.create(request())).stopReason).toBe("refusal");
    expect((await client.create(request())).stopReason).toBe("max_tokens");
    expect((await client.create(request())).text).toBe("Akwaaba!");
    expect((await client.create(request())).usage).toEqual({ inputTokens: 200, outputTokens: 10, cacheReadTokens: 800, cacheWriteTokens: 0 });
  });

  it("retries rate limits and server errors, then succeeds", async () => {
    const { client, fetchStub } = provider([
      { status: 429, body: { error: { message: "Rate limit" } } },
      { status: 503, body: { error: { message: "Overloaded" } } },
      { body: completion({ content: "Finally" }) },
    ]);
    expect((await client.create(request())).text).toBe("Finally");
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  it("asks again when the provider rejects the model's own tool call", async () => {
    const rejected = { error: { message: "Tool call validation failed: parameters for tool capture_lead did not match schema", code: "tool_use_failed" } };
    const { client, fetchStub } = provider([{ status: 400, body: rejected }, { body: completion({ content: "Noted, thank you!" }) }]);
    expect((await client.create(request())).text).toBe("Noted, thank you!");
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("fails fast on a bad key with the provider's own message", async () => {
    const { client, fetchStub } = provider([{ status: 401, body: { error: { message: "Incorrect API key provided" } } }]);
    const failure = await client.create(request()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(LlmProviderError);
    expect(failure).toMatchObject({ status: 401, message: "Provider error 401: Incorrect API key provided" });
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget and reports the last error", async () => {
    const { client, fetchStub } = provider([{ status: 503, body: "upstream unavailable" }]);
    await expect(client.create(request())).rejects.toMatchObject({ status: 503, message: 'Provider error 503: "upstream unavailable"' });
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  it("reports unreachable providers and responses that are not chat completions", async () => {
    const offline = createOpenAiCompatibleClient({
      apiKey: "k",
      baseUrl: "https://llm.example.test/v1",
      retryDelayMs: 0,
      fetch: (async () => Promise.reject(new TypeError("fetch failed"))) as typeof fetch,
    });
    await expect(offline.create(request())).rejects.toMatchObject({ status: null, message: "Provider unreachable: fetch failed" });

    const { client } = provider([{ body: { unexpected: true } }]);
    await expect(client.create(request())).rejects.toBeInstanceOf(LlmProviderError);

    const htmlPage = createOpenAiCompatibleClient({
      apiKey: "k",
      baseUrl: "https://llm.example.test/v1",
      fetch: (async () => new Response("<html>Login</html>", { status: 200 })) as typeof fetch,
    });
    await expect(htmlPage.create(request())).rejects.toMatchObject({ status: 200, message: "Provider error 200: the response body was not JSON." });
  });
});
