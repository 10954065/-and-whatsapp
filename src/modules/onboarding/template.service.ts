import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Industry } from "@/generated/prisma/enums";
import { INDUSTRY_TEMPLATES, type IndustryTemplate } from "@/config/industry-templates";
import { WORKFLOW_TEMPLATES, type WorkflowTemplateId } from "@/config/workflow-templates";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { recordAudit } from "@/modules/administration/audit.service";
import { getOrCreateAgent } from "@/modules/ai/agent.service";
import { listTools } from "@/modules/ai/tools";
import { parseKnowledgeProfile, type KnowledgeProfile } from "@/modules/businesses/knowledge-profile";
import { insertWorkflow } from "@/modules/workflows/workflow.service";

const MAX_ANSWER_LENGTH = 1_000;

interface TemplateState {
  industry: Industry;
  appliedAt: string;
  /** Workflow template ids already added, so re-applying never duplicates (or revives deleted) workflows. */
  workflows: WorkflowTemplateId[];
}

interface OnboardingStateWithTemplate {
  steps?: string[];
  skipped?: string[];
  template?: TemplateState;
}

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

/** Form fields: `answer_<key>` per knowledge field, repeated `workflows`, and `applyAgentDefaults`. */
export const applyTemplateSchema = z
  .object({
    applyAgentDefaults: checkbox,
    workflows: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  })
  .catchall(z.unknown())
  .transform((input, context) => {
    const answers: Record<string, string> = {};
    for (const [name, value] of Object.entries(input)) {
      if (!name.startsWith("answer_") || typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed.length > MAX_ANSWER_LENGTH) {
        context.addIssue({ code: "custom", path: [name], message: `Keep this under ${MAX_ANSWER_LENGTH} characters.` });
        return z.NEVER;
      }
      answers[name.slice("answer_".length)] = trimmed;
    }
    return { applyAgentDefaults: input.applyAgentDefaults, workflows: input.workflows, answers };
  });

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

export interface TemplateOverview {
  industry: Industry;
  template: IndustryTemplate;
  answers: Record<string, string>;
  /** Saved answers for fields this industry's template doesn't have (e.g. after changing industry). */
  otherAnswers: number;
  workflows: { id: WorkflowTemplateId; name: string; description: string; added: boolean }[];
  tools: { name: string; label: string }[];
  appliedAt: string | null;
  agentConfigured: boolean;
}

export async function getTemplateOverview(businessId: string): Promise<TemplateOverview> {
  const [business, agent] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { industry: true, knowledgeProfile: true, onboardingState: true } }),
    prisma.aiAgent.findUnique({ where: { businessId }, select: { createdAt: true, updatedAt: true } }),
  ]);
  const template = INDUSTRY_TEMPLATES[business.industry];
  const profile = parseKnowledgeProfile(business.knowledgeProfile);
  const state = ((business.onboardingState ?? {}) as OnboardingStateWithTemplate).template;
  const fieldKeys = new Set(template.knowledgeFields.map((field) => field.key));
  const toolLabels = new Map(listTools().map((tool) => [tool.name, tool.label]));
  return {
    industry: business.industry,
    template,
    answers: Object.fromEntries(template.knowledgeFields.map((field) => [field.key, profile[field.key]?.value ?? ""])),
    otherAnswers: Object.keys(profile).filter((key) => !fieldKeys.has(key)).length,
    workflows: template.suggestedWorkflows.map((id) => ({ id, name: WORKFLOW_TEMPLATES[id].name, description: WORKFLOW_TEMPLATES[id].description, added: Boolean(state?.workflows.includes(id)) })),
    tools: template.suggestedTools.filter((name) => toolLabels.has(name)).map((name) => ({ name, label: toolLabels.get(name)! })),
    appliedAt: state?.industry === business.industry ? state.appliedAt : null,
    agentConfigured: Boolean(agent && agent.updatedAt.getTime() - agent.createdAt.getTime() > 1_000),
  };
}

/**
 * Applies the business's industry template: saves the knowledge answers (replacing answers from
 * other templates), adds the chosen starter workflows as drafts (once each, ever), and — only
 * when asked — resets the AI employee's tone, role and permitted tools to the template.
 */
export async function applyIndustryTemplate(actor: TenantActor, input: ApplyTemplateInput, options: { canManageAutomation: boolean }) {
  const agent = input.applyAgentDefaults ? await getOrCreateAgent(actor.businessId) : null;
  const registeredTools = new Set(listTools().map((tool) => tool.name));

  return withTenantTx(actor.businessId, async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: { industry: true, onboardingState: true } });
    const template = INDUSTRY_TEMPLATES[business.industry];
    const state = (business.onboardingState ?? {}) as OnboardingStateWithTemplate;
    const alreadyAdded = new Set(state.template?.workflows ?? []);

    const knowledgeProfile: KnowledgeProfile = {};
    for (const field of template.knowledgeFields) {
      const value = input.answers[field.key];
      if (value) knowledgeProfile[field.key] = { label: field.label, value };
    }

    const requested = options.canManageAutomation ? template.suggestedWorkflows.filter((id) => input.workflows.includes(id) && !alreadyAdded.has(id)) : [];
    for (const id of requested) {
      const workflow = WORKFLOW_TEMPLATES[id];
      await insertWorkflow(tx, actor, { name: workflow.name, description: workflow.description, trigger: workflow.trigger, definition: workflow.definition });
    }

    if (agent) {
      const tools = template.suggestedTools.filter((name) => registeredTools.has(name));
      await tx.aiAgent.update({
        where: { id: agent.id },
        // Escalation rules already reach the prompt through industryGuidanceFor().
        data: { tone: template.defaultTone, roleDescription: template.roleDescription, permittedTools: tools },
      });
    }

    const nextState: OnboardingStateWithTemplate = {
      ...state,
      template: { industry: business.industry, appliedAt: new Date().toISOString(), workflows: [...alreadyAdded, ...requested] },
    };
    await tx.business.update({
      where: { id: actor.businessId },
      data: { knowledgeProfile: knowledgeProfile as Prisma.InputJsonValue, onboardingState: nextState as unknown as Prisma.InputJsonValue },
    });
    await recordAudit(
      {
        businessId: actor.businessId,
        actorType: "USER",
        actorId: actor.userId,
        action: "business.template_applied",
        entityType: "Business",
        entityId: actor.businessId,
        ipAddress: actor.ipAddress,
        metadata: { industry: business.industry, answers: Object.keys(knowledgeProfile).length, workflows: requested, agentDefaults: Boolean(agent) },
      },
      tx,
    );
    return { savedAnswers: Object.keys(knowledgeProfile).length, addedWorkflows: requested.length, agentUpdated: Boolean(agent) };
  });
}
