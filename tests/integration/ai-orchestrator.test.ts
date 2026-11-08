import { beforeEach, describe, expect, it } from "vitest";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { prisma } from "@/lib/db/prisma";
import type { LlmClient } from "@/modules/ai/client";
import { runAgent, type AgentRunInput } from "@/modules/ai/orchestrator";
import { createBusinessFor, createUser } from "./helpers";

type Step = { text?: string; tool?: { name: string; input: unknown }; stop?: "end_turn" | "tool_use" | "refusal" };

/** Scripted stand-in for the Anthropic API: returns one canned response per call. */
function fakeLlm(steps: Step[]): LlmClient & { calls: MessageCreateParamsNonStreaming[] } {
  const calls: MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    async create(params) {
      calls.push(params);
      const step = steps[Math.min(calls.length - 1, steps.length - 1)];
      const content = step.tool
        ? [{ type: "tool_use", id: `toolu_${calls.length}`, name: step.tool.name, input: step.tool.input }]
        : [{ type: "text", text: step.text ?? "", citations: null }];
      return {
        id: `msg_${calls.length}`,
        type: "message",
        role: "assistant",
        model: params.model,
        content,
        stop_reason: step.stop ?? (step.tool ? "tool_use" : "end_turn"),
        stop_sequence: null,
        stop_details: null,
        usage: { input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      } as unknown as BetaMessage;
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
    const llm = fakeLlm([{ text: "Hi Efua! Happy to help — which size are you looking for?" }]);
    const result = await runAgent(input, { llm });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.reply).toContain("which size");
    expect(llm.calls[0].tool_choice).toEqual({ type: "auto" });
    expect(llm.calls[0]).not.toHaveProperty("temperature");
    const run = await prisma.aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
    expect(run).toMatchObject({ status: "SUCCEEDED", inputTokens: 1_000, outputTokens: 100, promptVersion: 1 });
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
    const secondCall = llm.calls[1].messages.at(-1);
    expect(JSON.stringify(secondCall)).toContain("tool_result");
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
