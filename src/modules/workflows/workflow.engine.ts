import { z } from "zod";
import type { Prisma, WorkflowTrigger } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { logger } from "@/lib/monitoring/logger";
import { enqueueJob } from "@/lib/queue";
import { getPlanLimits, getUsage, incrementUsage, monthPeriod } from "@/modules/billing/usage";
import type { BusinessHours } from "@/modules/businesses/settings.schemas";
import { isWithinBusinessHours } from "@/modules/businesses/settings.service";

/** Runs triggered by other runs carry depth + 1; anything deeper is skipped (loop prevention). */
export const MAX_WORKFLOW_DEPTH = 3;

export const CONDITION_FIELDS = ["channel", "customer_tag", "message_contains", "lead_status", "order_total_gte", "within_business_hours"] as const;
export const ACTION_TYPES = ["send_message", "assign_conversation", "add_customer_tag", "notify_team", "create_follow_up", "create_lead"] as const;

export const definitionSchema = z.object({
  conditions: z.array(z.object({ field: z.enum(CONDITION_FIELDS), value: z.string().trim().max(200) })).max(5),
  actions: z.array(z.object({ type: z.enum(ACTION_TYPES), value: z.string().trim().max(1_000) })).min(1, "Add at least one action.").max(10),
});

export type WorkflowDefinition = z.infer<typeof definitionSchema>;

export const workflowEventSchema = z.object({
  trigger: z.enum(["INSTAGRAM_MESSAGE", "WHATSAPP_MESSAGE", "NEW_CUSTOMER", "NEW_LEAD", "NEW_ORDER", "PAYMENT_CONFIRMED", "BOOKING_CREATED", "BOOKING_CANCELLED", "FOLLOW_UP_DUE"]),
  eventId: z.string().min(1),
  businessId: z.string().min(1),
  depth: z.number().int().min(0).default(0),
  customerId: z.string().nullish(),
  conversationId: z.string().nullish(),
  channel: z.string().nullish(),
  messageText: z.string().nullish(),
  leadStatus: z.string().nullish(),
  orderTotalMinor: z.number().nullish(),
});

export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

export interface ConditionContext {
  customerTags: string[];
  isOpenNow: boolean;
}

/** Pure condition check — every condition must match. */
export function evaluateConditions(conditions: WorkflowDefinition["conditions"], event: WorkflowEvent, context: ConditionContext): boolean {
  return conditions.every((condition) => {
    const value = condition.value.toLowerCase();
    switch (condition.field) {
      case "channel":
        return (event.channel ?? "").toLowerCase() === value;
      case "customer_tag":
        return context.customerTags.includes(value);
      case "message_contains":
        return Boolean(value) && (event.messageText ?? "").toLowerCase().includes(value);
      case "lead_status":
        return (event.leadStatus ?? "").toLowerCase() === value;
      case "order_total_gte":
        return (event.orderTotalMinor ?? 0) >= Math.round(Number(condition.value) * 100);
      case "within_business_hours":
        return context.isOpenNow === (value === "yes");
      default:
        return false;
    }
  });
}

/** Queues an event for automation only when an active workflow listens for it. */
export async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
  if (event.depth > MAX_WORKFLOW_DEPTH) return;
  const listening = await prisma.workflow.count({ where: { businessId: event.businessId, trigger: event.trigger, status: "ACTIVE" } });
  if (listening === 0) return;
  await enqueueJob("automation.event", event as unknown as Prisma.InputJsonValue, {
    businessId: event.businessId,
    idempotencyKey: `automation:${event.trigger}:${event.eventId}`,
  });
}

interface StepResult {
  action: string;
  status: "done" | "skipped" | "failed";
  detail: string;
}

async function runAction(action: WorkflowDefinition["actions"][number], event: WorkflowEvent, runId: string, index: number): Promise<StepResult> {
  const businessId = event.businessId;
  switch (action.type) {
    case "send_message": {
      if (!event.conversationId) return { action: action.type, status: "skipped", detail: "No conversation for this event" };
      const { sendConversationMessage } = await import("@/modules/messaging/outbound.service");
      await sendConversationMessage({ businessId, conversationId: event.conversationId, sender: "AUTOMATION", text: action.value, idempotencyKey: `wf:${runId}:${index}` });
      return { action: action.type, status: "done", detail: "Message sent" };
    }
    case "assign_conversation": {
      if (!event.conversationId) return { action: action.type, status: "skipped", detail: "No conversation for this event" };
      const member = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId: action.value } } });
      if (!member) return { action: action.type, status: "failed", detail: "Assignee is not a member" };
      await withTenantTx(businessId, (tx) => tx.conversation.updateMany({ where: { id: event.conversationId!, businessId }, data: { assignedToId: action.value } }));
      return { action: action.type, status: "done", detail: "Conversation assigned" };
    }
    case "add_customer_tag": {
      if (!event.customerId) return { action: action.type, status: "skipped", detail: "No customer for this event" };
      const tag = action.value.toLowerCase().slice(0, 40);
      await withTenantTx(businessId, async (tx) => {
        const customer = await tx.customer.findFirstOrThrow({ where: { id: event.customerId!, businessId }, select: { tags: true } });
        if (!customer.tags.includes(tag)) await tx.customer.update({ where: { id: event.customerId! }, data: { tags: [...customer.tags, tag] } });
      });
      return { action: action.type, status: "done", detail: `Tagged “${tag}”` };
    }
    case "notify_team": {
      await withTenantTx(businessId, (tx) =>
        tx.notification.create({ data: { businessId, type: "automation", title: action.value.slice(0, 140) || "Automation alert", link: event.conversationId ? `/app/inbox?conversation=${event.conversationId}` : null } }),
      );
      return { action: action.type, status: "done", detail: "Team notified" };
    }
    case "create_follow_up": {
      const [title, hours] = action.value.split("|");
      await withTenantTx(businessId, (tx) =>
        tx.followUpTask.create({
          data: { businessId, title: (title || "Follow up").slice(0, 140), dueAt: new Date(Date.now() + (Number(hours) || 24) * 3_600_000), customerId: event.customerId ?? null, conversationId: event.conversationId ?? null, createdByType: "AUTOMATION" },
        }),
      );
      return { action: action.type, status: "done", detail: "Follow-up created" };
    }
    case "create_lead": {
      if (!event.customerId) return { action: action.type, status: "skipped", detail: "No customer for this event" };
      const lead = await withTenantTx(businessId, async (tx) => {
        const open = await tx.lead.findFirst({ where: { businessId, customerId: event.customerId!, status: { notIn: ["WON", "LOST"] } } });
        if (open) return null;
        return tx.lead.create({ data: { businessId, customerId: event.customerId!, interest: action.value || null, capturedBy: "AUTOMATION", conversationId: event.conversationId ?? null, source: "automation" } });
      });
      if (!lead) return { action: action.type, status: "skipped", detail: "Customer already has an open lead" };
      await emitWorkflowEvent({ ...event, trigger: "NEW_LEAD", eventId: `lead:${lead.id}`, depth: event.depth + 1, leadStatus: lead.status });
      return { action: action.type, status: "done", detail: "Lead created" };
    }
    default:
      return { action: action.type, status: "skipped", detail: "Unknown action" };
  }
}

/** Executes every active workflow for an event exactly once (dedupe per workflow + event). */
export async function processWorkflowEvent(event: WorkflowEvent): Promise<void> {
  const workflows = await prisma.workflow.findMany({ where: { businessId: event.businessId, trigger: event.trigger as WorkflowTrigger, status: "ACTIVE" } });
  if (workflows.length === 0) return;
  const [business, customer, limits, monthlyRuns] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: event.businessId }, select: { businessHours: true, timezone: true } }),
    event.customerId ? prisma.customer.findFirst({ where: { id: event.customerId, businessId: event.businessId }, select: { tags: true } }) : null,
    getPlanLimits(event.businessId),
    getUsage(event.businessId, "WORKFLOW_EXECUTION", monthPeriod(new Date())),
  ]);
  const context: ConditionContext = {
    customerTags: customer?.tags ?? [],
    isOpenNow: isWithinBusinessHours(business.businessHours as BusinessHours | null, business.timezone),
  };

  for (const workflow of workflows) {
    const version = await prisma.workflowVersion.findUnique({ where: { workflowId_version: { workflowId: workflow.id, version: workflow.currentVersion } } });
    if (!version) continue;
    let run;
    try {
      run = await prisma.workflowRun.create({
        data: { businessId: event.businessId, workflowId: workflow.id, version: version.version, dedupeKey: `${workflow.id}:${event.eventId}`, depth: event.depth, triggerPayload: event as unknown as Prisma.InputJsonValue, status: "RUNNING", startedAt: new Date() },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") continue;
      throw error;
    }
    const definition = definitionSchema.parse(version.definition);
    const finish = (status: "SUCCEEDED" | "FAILED" | "SKIPPED", steps: StepResult[], error?: string) =>
      prisma.workflowRun.update({ where: { id: run.id }, data: { status, steps: steps as unknown as Prisma.InputJsonValue, error: error ?? null, finishedAt: new Date() } });

    if (event.depth > MAX_WORKFLOW_DEPTH) {
      await finish("SKIPPED", [], "Loop protection: too many chained workflow runs.");
      continue;
    }
    if (monthlyRuns >= limits.workflowExecutionsPerMonth) {
      await finish("SKIPPED", [], "Monthly workflow execution allowance reached.");
      continue;
    }
    if (!evaluateConditions(definition.conditions, event, context)) {
      await finish("SKIPPED", [], "Conditions not met.");
      continue;
    }
    const steps: StepResult[] = [];
    try {
      for (const [index, action] of definition.actions.entries()) steps.push(await runAction(action, event, run.id, index));
      await finish(steps.some((step) => step.status === "failed") ? "FAILED" : "SUCCEEDED", steps);
    } catch (error) {
      logger.warn("workflow.action_failed", { workflowId: workflow.id, error });
      await finish("FAILED", steps, (error as Error).message.slice(0, 500));
    }
    await incrementUsage(event.businessId, "WORKFLOW_EXECUTION", 1, new Date());
  }
}
