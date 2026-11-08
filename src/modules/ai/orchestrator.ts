import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AiActionStatus, AiRunStatus, AiRunTrigger, Channel, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { getPlatformSetting, PLATFORM_FLAGS } from "@/modules/administration/platform-settings";
import { getOrCreateAgent } from "@/modules/ai/agent.service";
import { Anthropic, anthropicLlm, isAnthropicConfigured, type LlmClient } from "@/modules/ai/client";
import { buildBusinessFacts, buildMessages, buildSystemPrompt, type ConversationTurn } from "@/modules/ai/context";
import { escalateConversation } from "@/modules/ai/escalation";
import { industryGuidanceFor } from "@/modules/ai/industry-guidance";
import { clampForChannel, postcheck, preflight, PREFLIGHT_LABELS, type PreflightBlock } from "@/modules/ai/policy";
import { addUsage, emptyUsage, estimateCostMicros, type TokenUsage } from "@/modules/ai/pricing";
import { getActivePrompt } from "@/modules/ai/prompts";
import { modelForTier, routeTier, supportsServerFallback, TIER_EFFORT, type ModelTier } from "@/modules/ai/router";
import { executeTool, permittedToolNames, toolDefinitions } from "@/modules/ai/tools/registry";
import type { ToolContext } from "@/modules/ai/tools/types";
import { dayPeriod, getAiSpend, getPlanLimits, getUsage, incrementUsage, monthPeriod } from "@/modules/billing/usage";
import type { BusinessHours } from "@/modules/businesses/settings.schemas";
import { isWithinBusinessHours } from "@/modules/businesses/settings.service";
import { searchKnowledge } from "@/modules/knowledge/retrieval";

const MAX_ITERATIONS = 5;
const MAX_OUTPUT_TOKENS = 1_024;

export interface AgentRunInput {
  businessId: string;
  conversationId?: string | null;
  customerId?: string | null;
  channel: Channel;
  trigger: AiRunTrigger;
  history: ConversationTurn[];
  inboundText: string;
  mode: "live" | "test";
}

export interface AgentRunAction {
  tool: string;
  status: AiActionStatus;
  message: string;
}

export interface AgentRunOutput {
  runId: string | null;
  status: AiRunStatus | "SKIPPED";
  reply: string | null;
  /** True when the reply was produced without the model (e.g. out-of-hours message). */
  isAutoReply: boolean;
  escalated: boolean;
  blockedReason?: PreflightBlock;
  blockedMessage?: string;
  actions: AgentRunAction[];
  tier?: ModelTier;
  model?: string;
  usage: TokenUsage;
  costMicros: number;
  policyFlags: string[];
}

function usageFrom(message: { usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null; cache_creation_input_tokens: number | null } }): TokenUsage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function localTime(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }).format(now);
}

/**
 * Runs the AI employee for one customer message: policy pre-checks, model routing,
 * retrieval, a bounded tool-use loop with gated tool execution, reply post-checks,
 * and full accounting (AiRun, AiAction, AiUsageRecord, usage counters).
 */
export async function runAgent(input: AgentRunInput, deps: { llm?: LlmClient; now?: Date } = {}): Promise<AgentRunOutput> {
  const llm = deps.llm ?? anthropicLlm;
  const now = deps.now ?? new Date();
  const base: Omit<AgentRunOutput, "status"> = {
    runId: null,
    reply: null,
    isAutoReply: false,
    escalated: false,
    actions: [],
    usage: emptyUsage(),
    costMicros: 0,
    policyFlags: [],
  };

  const [business, agent, platformEnabled, spend, limits, messagesToday, aiMessagesThisMonth, conversation] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: input.businessId } }),
    getOrCreateAgent(input.businessId),
    getPlatformSetting<boolean>(PLATFORM_FLAGS.aiEnabled, true),
    getAiSpend(input.businessId, now),
    getPlanLimits(input.businessId),
    getUsage(input.businessId, "AI_MESSAGE", dayPeriod(now)),
    getUsage(input.businessId, "AI_MESSAGE", monthPeriod(now)),
    input.conversationId
      ? prisma.conversation.findFirst({ where: { id: input.conversationId, businessId: input.businessId }, select: { control: true } })
      : Promise.resolve(null),
  ]);
  const hours = business.businessHours as BusinessHours | null;
  const isOpenNow = isWithinBusinessHours(hours, business.timezone, now);

  const gate = preflight({
    trigger: input.trigger,
    providerConfigured: llm !== anthropicLlm || isAnthropicConfigured(),
    platformEnabled,
    businessStatus: business.status,
    agent,
    conversationControl: conversation?.control ?? null,
    isOpenNow,
    messagesToday,
    spendTodayMicros: spend.todayMicros,
    spendMonthMicros: spend.monthMicros,
    aiMessagesThisMonth,
    planMonthlyAiMessages: limits.aiMessagesPerMonth,
  });
  if (!gate.allowed) {
    return {
      ...base,
      status: "SKIPPED",
      blockedReason: gate.reason,
      blockedMessage: PREFLIGHT_LABELS[gate.reason],
      reply: gate.autoReply ?? null,
      isAutoReply: Boolean(gate.autoReply),
    };
  }

  const routing = routeTier({ text: input.inboundText, historyLength: input.history.length, override: agent.modelTierOverride });
  const model = modelForTier(routing.tier);
  const prompt = await getActivePrompt();
  const businessForPrompt = { ...business, businessHours: hours };
  const system = buildSystemPrompt({
    template: prompt.template,
    agent,
    business: businessForPrompt,
    channel: input.channel,
    industryGuidance: industryGuidanceFor(business.industry),
  });
  const knowledge = await searchKnowledge(input.businessId, input.inboundText, 4);
  const messages: BetaMessageParam[] = buildMessages({
    history: input.history.slice(-20),
    inboundText: input.inboundText,
    knowledge: knowledge.map((chunk) => ({ title: chunk.title, content: chunk.content })),
    localTime: localTime(business.timezone, now),
    isOpenNow,
  });
  const permitted = permittedToolNames(agent.permittedTools);
  const tools = toolDefinitions(permitted);

  const run = await prisma.aiRun.create({
    data: {
      businessId: input.businessId,
      agentId: agent.id,
      conversationId: input.conversationId ?? null,
      trigger: input.trigger,
      tier: routing.tier,
      model,
      promptKey: prompt.key,
      promptVersion: prompt.version,
      status: "FAILED",
    },
  });

  const toolContext: ToolContext = {
    businessId: input.businessId,
    conversationId: input.conversationId ?? null,
    customerId: input.customerId ?? null,
    aiRunId: run.id,
    mode: input.mode,
    timezone: business.timezone,
    currency: business.currency,
    maxDiscountPercent: agent.maxDiscountPercent,
  };

  const verifiedFacts: string[] = [buildBusinessFacts(businessForPrompt), ...knowledge.map((chunk) => chunk.content)];
  const actions: AgentRunAction[] = [];
  let usage = emptyUsage();
  let paymentVerified = false;
  let escalated = false;
  let replyText = "";
  let stopReason: string | null = null;
  let iterations = 0;
  let status: AiRunStatus = "SUCCEEDED";
  let errorMessage: string | null = null;
  const started = Date.now();

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations += 1;
      const params: MessageCreateParamsNonStreaming = {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages,
        tools,
        tool_choice: { type: "auto" },
        output_config: { effort: TIER_EFFORT[routing.tier] },
        cache_control: { type: "ephemeral" },
        metadata: { user_id: input.businessId },
        ...(supportsServerFallback(model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
      };
      const response = await llm.create(params);
      usage = addUsage(usage, usageFrom(response));
      stopReason = response.stop_reason;

      if (response.stop_reason === "refusal") {
        escalated = true;
        status = "ESCALATED";
        replyText = "";
        break;
      }

      const toolCalls = response.content.filter((block): block is BetaToolUseBlock => block.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolCalls.length === 0) {
        replyText = response.content
          .filter((block) => block.type === "text")
          .map((block) => (block as { text: string }).text)
          .join("\n")
          .trim();
        break;
      }

      messages.push({ role: "assistant", content: response.content as BetaContentBlockParam[] });
      const results: BetaToolResultBlockParam[] = [];
      for (const call of toolCalls) {
        const execution = await executeTool(call.name, call.input, toolContext, {
          permitted,
          approvalRequired: agent.approvalRequiredTools,
        });
        actions.push({ tool: call.name, status: execution.status, message: execution.outcome.message.slice(0, 500) });
        verifiedFacts.push(...(execution.outcome.verifiedFacts ?? []));
        paymentVerified ||= Boolean(execution.outcome.paymentVerified);
        escalated ||= Boolean(execution.outcome.escalated);
        await prisma.aiAction.create({
          data: {
            businessId: input.businessId,
            aiRunId: run.id,
            conversationId: input.conversationId ?? null,
            tool: call.name,
            input: (call.input ?? {}) as Prisma.InputJsonValue,
            output: { message: execution.outcome.message.slice(0, 4_000) },
            status: execution.status,
            approvalId: execution.approvalId ?? null,
            idempotencyKey: `${run.id}:${call.id}`,
          },
        });
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: execution.outcome.message,
          is_error: !execution.outcome.ok,
        });
      }
      messages.push({ role: "user", content: results });
    }

    if (status === "SUCCEEDED" && !replyText) {
      status = "ESCALATED";
      escalated = true;
    }
  } catch (error) {
    status = "FAILED";
    escalated = true;
    errorMessage = error instanceof Anthropic.APIError ? `Provider error ${error.status ?? ""}: ${error.message}` : String(error);
    await reportError(error, { source: "ai.orchestrator", businessId: input.businessId, aiRunId: run.id });
  }

  const flags: string[] = [];
  let finalReply: string | null = replyText || null;
  if (finalReply) {
    const check = postcheck({ reply: finalReply, verifiedText: verifiedFacts.join("\n"), paymentVerified });
    flags.push(...check.flags);
    if (!check.ok) {
      finalReply = check.reply;
      escalated = true;
      status = "BLOCKED";
    }
    finalReply = clampForChannel(finalReply, input.channel);
  }
  if (escalated && !finalReply && input.mode === "live") {
    finalReply = "Thanks for your message — a member of our team will get back to you shortly.";
  }

  const costMicros = estimateCostMicros(model, usage);
  await prisma.$transaction(async (tx) => {
    await tx.aiRun.update({
      where: { id: run.id },
      data: {
        status,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        costMicros,
        latencyMs: Date.now() - started,
        iterations,
        stopReason,
        policyFlags: flags,
        responseText: finalReply,
        error: errorMessage,
      },
    });
    if (usage.inputTokens + usage.outputTokens > 0) {
      await tx.aiUsageRecord.create({
        data: {
          businessId: input.businessId,
          aiRunId: run.id,
          model,
          tier: routing.tier,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          costMicros,
        },
      });
      await incrementUsage(input.businessId, "AI_MESSAGE", 1, now, tx);
    }
  });

  if (escalated && input.mode === "live" && !actions.some((action) => action.tool === "escalate_to_human")) {
    await escalateConversation({
      businessId: input.businessId,
      conversationId: input.conversationId ?? null,
      reason: status === "FAILED" ? "ai_unavailable" : status === "BLOCKED" ? "policy_check" : "ai_handover",
      summary: `Customer said: ${input.inboundText.slice(0, 300)}`,
    }).catch((error: unknown) => logger.error("ai.escalation_failed", { error }));
  }

  return {
    ...base,
    runId: run.id,
    status,
    reply: finalReply,
    escalated,
    actions,
    tier: routing.tier,
    model,
    usage,
    costMicros,
    policyFlags: flags,
  };
}
