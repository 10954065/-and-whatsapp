import { z } from "zod";
import type { AiActionStatus, Prisma } from "@/generated/prisma/client";
import { withTenantTx } from "@/lib/db/tenant";
import type { LlmToolDefinition } from "@/modules/ai/llm/types";
import {
  businessInfoTool,
  captureLeadTool,
  escalateTool,
  followUpTool,
  searchKnowledgeTool,
} from "@/modules/ai/tools/core-tools";
import type { AnyAiTool, ToolContext, ToolOutcome } from "@/modules/ai/tools/types";

const TOOLS: AnyAiTool[] = [searchKnowledgeTool, businessInfoTool, escalateTool, captureLeadTool, followUpTool];

/** Registers additional tools (commerce and bookings modules add theirs). */
export function registerTools(tools: AnyAiTool[]): void {
  for (const tool of tools) {
    if (!TOOLS.some((existing) => existing.name === tool.name)) TOOLS.push(tool);
  }
}

export function listTools(): AnyAiTool[] {
  return [...TOOLS];
}

export const DEFAULT_PERMITTED_TOOLS = ["search_knowledge", "get_business_info", "escalate_to_human", "capture_lead", "create_follow_up"];

/** Tools that can never be disabled: the AI must always be able to look things up and hand over. */
export const ALWAYS_ALLOWED_TOOLS = new Set(["search_knowledge", "get_business_info", "escalate_to_human"]);

export function permittedToolNames(configured: string[]): string[] {
  const names = new Set([...ALWAYS_ALLOWED_TOOLS, ...configured]);
  return TOOLS.filter((tool) => names.has(tool.name)).map((tool) => tool.name);
}

export function toolDefinitions(names: string[]): LlmToolDefinition[] {
  return TOOLS.filter((tool) => names.includes(tool.name)).map((tool) => {
    const inputSchema = { ...(z.toJSONSchema(tool.schema) as Record<string, unknown>) };
    delete inputSchema.$schema;
    return { name: tool.name, description: tool.description, inputSchema };
  });
}

export interface ToolExecution {
  status: AiActionStatus;
  outcome: ToolOutcome;
  approvalId?: string;
}

/**
 * The only path from a model's tool call to business data. Enforces: tool exists,
 * business permits it, input matches the schema, approval rules, and test-mode isolation.
 * The business id always comes from the server-side context, never from model input.
 */
export async function executeTool(
  name: string,
  rawInput: unknown,
  context: ToolContext,
  policy: { permitted: string[]; approvalRequired: string[] },
): Promise<ToolExecution> {
  const tool = TOOLS.find((entry) => entry.name === name);
  if (!tool || !policy.permitted.includes(name)) {
    return { status: "DENIED", outcome: { ok: false, message: "This action is not enabled for this business. Offer to involve a team member instead." } };
  }

  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    return { status: "FAILED", outcome: { ok: false, message: `Invalid input: ${issues}` } };
  }

  if (tool.isWrite && context.mode === "live" && policy.approvalRequired.includes(name)) {
    const approval = await withTenantTx(context.businessId, (tx) =>
      tx.approvalRequest.create({
        data: {
          businessId: context.businessId,
          kind: name,
          summary: `AI requested “${tool.label}”`,
          payload: parsed.data as Prisma.InputJsonValue,
          conversationId: context.conversationId,
          expiresAt: new Date(Date.now() + 48 * 3_600_000),
        },
      }),
    );
    return {
      status: "PENDING_APPROVAL",
      approvalId: approval.id,
      outcome: { ok: true, message: "This needs approval from a team member. Tell the customer the team will confirm shortly." },
    };
  }

  const outcome = await tool.execute(context, parsed.data);
  return { status: outcome.ok ? "EXECUTED" : "FAILED", outcome };
}
