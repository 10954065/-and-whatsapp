import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { resetEnvCache } from "@/lib/env";
import { LlmProviderError, type LlmClient, type LlmRequest, type LlmResponse } from "@/modules/ai/llm";
import { runAgent, type AgentRunInput } from "@/modules/ai/orchestrator";
import { createBusinessFor, createUser } from "./helpers";

type Step = { text?: string; tool?: { name: string; input: unknown }; stop?: "end_turn" | "tool_use" | "refusal"; tokens?: number };

/** Scripted stand-in for the model provider: returns one canned response per call. */
function fakeLlm(steps: Step[]): LlmClient & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    async create(request) {
      calls.push(request);
      const step = steps[Math.min(calls.length - 1, steps.length - 1)];
      const tokens = step.tokens ?? 1_000;
      return {
        text: step.text ?? "",
        toolCalls: step.tool ? [{ id: `call_${calls.length}`, name: step.tool.name, input: step.tool.input }] : [],
        stopReason: step.stop ?? (step.tool ? "tool_use" : "end_turn"),
        usage: { inputTokens: tokens, outputTokens: tokens / 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
        providerTurn: { provider: "openai-compatible", raw: { toolCalls: [] } },
      } satisfies LlmResponse;
    },
  };
}

async function setup(options: { enabled?: boolean } = {}) {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Ama's Fashion House");
  await prisma.aiAgent.create({
    data: {
      businessId: business.id,
      enabled: options.enabled ?? true,
      permittedTools: ["search_knowledge", "get_business_info", "escalate_to_human", "capture_lead", "create_follow_up"],
      enabledChannels: ["WHATSAPP"],
    },
  });
  const customer = await prisma.customer.create({ data: { businessId: business.id, displayName: "Efua" } });
  const conversation = await prisma.conversation.create({ data: { businessId: business.id, customerId: customer.id, channel: "WHATSAPP" } });
  const input: AgentRunInput = {
    businessId: business.id,
    conversationId: conversation.id,
    customerId: customer.id,
    channel: "WHATSAPP",
    trigger: "INBOUND_MESSAGE",
    history: [],
    inboundText: "Hello, I'd like to buy the kente dress",
    mode: "live",
  };
  return { business, customer, conversation, input };
}

beforeEach(async () => {
  await prisma.platformSetting.deleteMany({ where: { key: "ai.globalEnabled" } });
});

describe("runAgent", () => {
  it("replies, records the run, usage and counters", async () => {
    const { business, input } = await setup();
    const llm = fakeLlm([{ text: "Hi Efua! Happy to help. Which size are you looking for?" }]);
    const result = await runAgent(input, { llm });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.reply).toContain("Which size");
    expect(llm.calls[0]).toMatchObject({ model: "claude-haiku-5-5", effort: "low", maxOutputTokens: 1_024, endUserId: business.id });
    expect(llm.calls[0].tools.map((tool) => tool.name)).toContain("capture_lead");
    const run = await prisma.aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
    expect(run).toMatchObject({ status: "SUCCEEDED", inputTokens: 1_000, outputTokens: 100, promptVersion: 2 });
    expect(await prisma.aiUsageRecord.count({ where: { businessId: business.id } })).toBe(1);
    expect(await prisma.usageCounter.count({ where: { businessId: business.id, metric: "AI_MESSAGE" } })).toBe(2);
  });

  it("executes permitted write tools inside the tenant and loops back to the model", async () => {
    const { business, customer, input } = await setup();
    const llm = fakeLlm([
      { tool: { name: "capture_lead", input: { interest: "Kente midi dress, size M" } } },
      { text: "Lovely choice! I've noted your interest and the team will follow up." },
    ]);
    const result = await runAgent(input, { llm });

    expect(result.actions).toEqual([expect.objectContaining({ tool: "capture_lead", status: "EXECUTED" })]);
    const lead = await prisma.lead.findFirstOrThrow({ where: { businessId: business.id, customerId: customer.id } });
    expect(lead).toMatchObject({ capturedBy: "AI", interest: "Kente midi dress, size M" });
    expect(llm.calls[1].messages.at(-2)).toMatchObject({ role: "assistant", toolCalls: [{ id: "call_1", name: "capture_lead" }] });
    expect(llm.calls[1].messages.at(-1)).toMatchObject({ role: "tool", toolCallId: "call_1", isError: false });
  });

  it("denies tools the business has not permitted", async () => {
    const { input, business } = await setup();
    await prisma.aiAgent.update({ where: { businessId: business.id }, data: { permittedTools: [] } });
    const llm = fakeLlm([{ tool: { name: "capture_lead", input: { interest: "dress" } } }, { text: "The team will help you." }]);
    const result = await runAgent(input, { llm });
    expect(result.actions[0]).toMatchObject({ tool: "capture_lead", status: "DENIED" });
    expect(await prisma.lead.count({ where: { businessId: business.id } })).toBe(0);
  });

  it("routes approval-required tools to an approval request instead of executing", async () => {
    const { input, business } = await setup();
    await prisma.aiAgent.update({ where: { businessId: business.id }, data: { approvalRequiredTools: ["capture_lead"] } });
    const llm = fakeLlm([{ tool: { name: "capture_lead", input: { interest: "dress" } } }, { text: "A team member will confirm shortly." }]);
    const result = await runAgent(input, { llm });
    expect(result.actions[0].status).toBe("PENDING_APPROVAL");
    expect(await prisma.lead.count({ where: { businessId: business.id } })).toBe(0);
    expect(await prisma.approvalRequest.count({ where: { businessId: business.id, kind: "capture_lead", status: "PENDING" } })).toBe(1);
  });

  it("simulates write tools in test mode without touching data", async () => {
    const { input, business } = await setup({ enabled: false });
    const llm = fakeLlm([{ tool: { name: "capture_lead", input: { interest: "dress" } } }, { text: "Noted!" }]);
    const result = await runAgent({ ...input, trigger: "TEST_CONSOLE", mode: "test", conversationId: null, customerId: null }, { llm });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.actions[0].message).toContain("TEST MODE");
    expect(await prisma.lead.count({ where: { businessId: business.id } })).toBe(0);
  });

  it("replaces invented prices with a holding reply and escalates", async () => {
    const { input, conversation, business } = await setup();
    const llm = fakeLlm([{ text: "The dress costs GH₵ 999." }]);
    const result = await runAgent(input, { llm });
    expect(result.status).toBe("BLOCKED");
    expect(result.policyFlags).toContain("unverified_price");
    expect(result.reply).not.toContain("999");
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).control).toBe("HUMAN");
    expect(await prisma.notification.count({ where: { businessId: business.id, type: "ai.escalation" } })).toBe(1);
  });

  it("escalates when the model refuses or the provider fails", async () => {
    const refused = await setup();
    const refusal = await runAgent(refused.input, { llm: fakeLlm([{ text: "", stop: "refusal" }]) });
    expect(refusal.status).toBe("ESCALATED");
    expect(refusal.reply).toContain("member of our team");

    const failing = await setup();
    const broken: LlmClient = { create: async () => Promise.reject(new Error("network down")) };
    const failure = await runAgent(failing.input, { llm: broken });
    expect(failure.status).toBe("FAILED");
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: failing.conversation.id } })).control).toBe("HUMAN");
  });

  it("records the provider's error message and spends no allowance on a failed call", async () => {
    const { input, business } = await setup();
    const rejected: LlmClient = { create: async () => Promise.reject(new LlmProviderError("Provider error 401: Invalid API key", 401)) };
    const result = await runAgent(input, { llm: rejected });
    const run = await prisma.aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
    expect(run).toMatchObject({ status: "FAILED", error: "Provider error 401: Invalid API key" });
    expect(await prisma.usageCounter.count({ where: { businessId: business.id, metric: "AI_MESSAGE" } })).toBe(0);
  });

  it("counts a reply against the plan even when the provider reports no token usage", async () => {
    const { input, business } = await setup();
    const result = await runAgent(input, { llm: fakeLlm([{ text: "Hello Efua, how can I help?", tokens: 0 }]) });
    expect(result.status).toBe("SUCCEEDED");
    expect(await prisma.usageCounter.count({ where: { businessId: business.id, metric: "AI_MESSAGE" } })).toBe(2);
  });

  it("does not spend tokens when preflight blocks the run", async () => {
    const { input, business } = await setup({ enabled: false });
    const llm = fakeLlm([{ text: "should not be called" }]);
    const disabled = await runAgent(input, { llm });
    expect(disabled).toMatchObject({ status: "SKIPPED", blockedReason: "agent_disabled", reply: null });

    await prisma.aiAgent.update({ where: { businessId: business.id }, data: { enabled: true, dailySpendLimitMicros: 0 } });
    expect((await runAgent(input, { llm })).blockedReason).toBe("daily_budget");

    await prisma.platformSetting.create({ data: { key: "ai.globalEnabled", value: false } });
    expect((await runAgent(input, { llm })).blockedReason).toBe("platform_disabled");
    expect(llm.calls).toHaveLength(0);
  });
});

describe("runAgent with an OpenAI-compatible provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
    resetEnvCache();
  });

  it("runs the full tool loop from configuration alone", async () => {
    Object.assign(process.env, { AI_PROVIDER: "openai-compatible", AI_API_KEY: "sk-test", AI_BASE_URL: "https://llm.example.test/v1", AI_MODEL: "test-model" });
    resetEnvCache();
    const bodies: { messages: unknown[] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (!String(url).startsWith("https://llm.example.test/")) throw new Error(`Unexpected request to ${String(url)}`);
        bodies.push(JSON.parse(String(init?.body)));
        const isFirst = bodies.length === 1;
        const message = isFirst
          ? { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "capture_lead", arguments: '{"interest":"Kente midi dress"}' } }] }
          : { role: "assistant", content: "Lovely! The team will follow up about the kente dress." };
        return Response.json({ choices: [{ message, finish_reason: isFirst ? "tool_calls" : "stop" }], usage: { prompt_tokens: 500, completion_tokens: 40 } });
      }),
    );
    const { business, customer, input } = await setup();
    const result = await runAgent(input);

    expect(result).toMatchObject({ status: "SUCCEEDED", model: "test-model", reply: expect.stringContaining("kente dress") });
    const lead = await prisma.lead.findFirstOrThrow({ where: { businessId: business.id, customerId: customer.id } });
    expect(lead).toMatchObject({ capturedBy: "AI", interest: "Kente midi dress" });
    expect(bodies[1].messages).toContainEqual({ role: "tool", tool_call_id: "call_1", content: expect.any(String) });
    expect(await prisma.aiRun.findUniqueOrThrow({ where: { id: result.runId! } })).toMatchObject({ inputTokens: 1_000, outputTokens: 80 });
  });
});
