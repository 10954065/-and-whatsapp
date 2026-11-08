import { z } from "zod";
import type { Prisma, WorkflowStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { recordAudit } from "@/modules/administration/audit.service";
import { ACTION_TYPES, CONDITION_FIELDS, definitionSchema, type WorkflowDefinition } from "@/modules/workflows/workflow.engine";

export const TRIGGERS = ["WHATSAPP_MESSAGE", "INSTAGRAM_MESSAGE", "NEW_CUSTOMER", "NEW_LEAD", "NEW_ORDER", "PAYMENT_CONFIRMED", "BOOKING_CREATED", "BOOKING_CANCELLED"] as const;

/** Builder form → validated definition (2 condition rows, 3 action rows; empty rows ignored). */
export const workflowFormSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    trigger: z.enum(TRIGGERS),
    c1_field: z.string().optional(),
    c1_value: z.string().optional(),
    c2_field: z.string().optional(),
    c2_value: z.string().optional(),
    a1_type: z.string().optional(),
    a1_value: z.string().optional(),
    a2_type: z.string().optional(),
    a2_value: z.string().optional(),
    a3_type: z.string().optional(),
    a3_value: z.string().optional(),
  })
  .transform((input, context) => {
    const conditions = [1, 2]
      .map((row) => ({ field: input[`c${row}_field` as "c1_field"], value: input[`c${row}_value` as "c1_value"] ?? "" }))
      .filter((row) => row.field && (CONDITION_FIELDS as readonly string[]).includes(row.field));
    const actions = [1, 2, 3]
      .map((row) => ({ type: input[`a${row}_type` as "a1_type"], value: input[`a${row}_value` as "a1_value"] ?? "" }))
      .filter((row) => row.type && (ACTION_TYPES as readonly string[]).includes(row.type));
    const parsed = definitionSchema.safeParse({ conditions, actions });
    if (!parsed.success) {
      context.addIssue({ code: "custom", path: ["a1_type"], message: parsed.error.issues[0]?.message ?? "Invalid workflow" });
      return z.NEVER;
    }
    return { name: input.name, trigger: input.trigger, definition: parsed.data };
  });

export async function createWorkflow(actor: TenantActor, input: { name: string; trigger: (typeof TRIGGERS)[number]; definition: WorkflowDefinition }) {
  return withTenantTx(actor.businessId, async (tx) => {
    const workflow = await tx.workflow.create({ data: { businessId: actor.businessId, name: input.name, trigger: input.trigger, currentVersion: 1, createdById: actor.userId } });
    await tx.workflowVersion.create({ data: { businessId: actor.businessId, workflowId: workflow.id, version: 1, definition: input.definition as unknown as Prisma.InputJsonValue, createdById: actor.userId } });
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "workflow.created", entityType: "Workflow", entityId: workflow.id }, tx);
    return workflow;
  });
}

/** Saving a change creates a new immutable version; runs record which version they used. */
export async function updateWorkflowDefinition(actor: TenantActor, workflowId: string, definition: WorkflowDefinition) {
  await withTenantTx(actor.businessId, async (tx) => {
    const workflow = await tx.workflow.findFirst({ where: { id: workflowId, businessId: actor.businessId } });
    if (!workflow) throw fail.notFound("Workflow");
    const version = workflow.currentVersion + 1;
    await tx.workflowVersion.create({ data: { businessId: actor.businessId, workflowId, version, definition: definition as unknown as Prisma.InputJsonValue, createdById: actor.userId } });
    await tx.workflow.update({ where: { id: workflowId }, data: { currentVersion: version } });
  });
}

export async function setWorkflowStatus(actor: TenantActor, workflowId: string, status: WorkflowStatus) {
  await withTenantTx(actor.businessId, async (tx) => {
    const result = await tx.workflow.updateMany({ where: { id: workflowId, businessId: actor.businessId }, data: { status } });
    if (!result.count) throw fail.notFound("Workflow");
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: `workflow.${status.toLowerCase()}`, entityType: "Workflow", entityId: workflowId }, tx);
  });
}

export async function listWorkflows(businessId: string) {
  const [workflows, runs] = await Promise.all([
    prisma.workflow.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, include: { versions: { orderBy: { version: "desc" }, take: 1 }, _count: { select: { runs: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.workflowRun.findMany({ where: { businessId }, include: { workflow: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return { workflows, runs };
}
