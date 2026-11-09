import type { AiActionStatus, AiRunStatus, AiRunTrigger, Channel, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { getPlatformSetting, PLATFORM_FLAGS } from "@/modules/administration/platform-settings";
import { getOrCreateAgent } from "@/modules/ai/agent.service";
import { buildBusinessFacts, buildMessages, buildSystemPrompt, type ConversationTurn } from "@/modules/ai/context";
import { escalateConversation } from "@/modules/ai/escalation";
import { industryGuidanceFor } from "@/modules/ai/industry-guidance";
import { getLlmClient, LlmProviderError, modelForTier, type LlmClient, type LlmMessage } from "@/modules/ai/llm";
import { clampForChannel, formatForChannel, postcheck, preflight, PREFLIGHT_LABELS, removeDashes, type PreflightBlock } from "@/modules/ai/policy";
import { addUsage, emptyUsage, estimateCostMicros, type TokenUsage } from "@/modules/ai/pricing";
import { getActivePrompt } from "@/modules/ai/prompts";
import { routeTier, TIER_EFFORT, type ModelTier } from "@/modules/ai/router";
import { executeTool, permittedToolNames, toolDefinitions } from "@/modules/ai/tools";
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

function localTime(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }).format(now);
}

/**
 * Runs the assistant for one customer message: policy pre-checks, model routing,
 * retrieval, a bounded tool-use loop with gated tool execution, reply post-checks,
 * and full accounting (AiRun, AiAction, AiUsageRecord, usage counters).
 */
export async function runAgent(input: AgentRunInput, deps: { llm?: LlmClient; now?: Date } = {}): Promise<AgentRunOutput> {
  const llm = deps.llm ?? getLlmClient();
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
    providerConfigured: llm !== null,
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
  if (!llm) throw new Error("Preflight passed without a configured AI provider.");

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
  const messages: LlmMessage[] = buildMessages({
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
  let modelReplies = 0;
  let status: AiRunStatus = "SUCCEEDED";
  let errorMessage: string | null = null;
  const started = Date.now();

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations += 1;
      const response = await llm.create({
        model,
        system,
        messages: [...messages],
        tools,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        effort: TIER_EFFORT[routing.tier],
        endUserId: input.businessId,
      });
      modelReplies += 1;
      usage = addUsage(usage, response.usage);
      stopReason = response.stopReason;

      if (response.stopReason === "refusal") {
        escalated = true;
        status = "ESCALATED";
        replyText = "";
        break;
      }

      if (response.stopReason !== "tool_use" || response.toolCalls.length === 0) {
        replyText = response.text;
        break;
      }

      messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls, providerTurn: response.providerTurn });
      for (const call of response.toolCalls) {
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
            // Tool-call ids are only unique per response at some providers, so the iteration is part of the key.
            idempotencyKey: `${run.id}:${iterations}:${call.id}`,
          },
        });
        messages.push({ role: "tool", toolCallId: call.id, content: execution.outcome.message, isError: !execution.outcome.ok });
      }
    }

    if (status === "SUCCEEDED" && !replyText) {
      status = "ESCALATED";
      escalated = true;
    }
  } catch (error) {
    status = "FAILED";
    escalated = true;
    errorMessage = error instanceof LlmProviderError ? error.message : String(error);
    await reportError(error, { source: "ai.orchestrator", businessId: input.businessId, aiRunId: run.id });
  }

  const flags: string[] = [];
  let finalReply: string | null = formatForChannel(removeDashes(replyText), input.channel) || null;
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
    finalReply = "Thanks for your message. A member of our team will get back to you shortly.";
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
    // Counted whenever the model answered, even from providers that report no token usage.
    if (modelReplies > 0) {
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
