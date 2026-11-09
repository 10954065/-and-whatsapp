import { z } from "zod";
import type { AiAgent } from "@/generated/prisma/client";
import { INDUSTRY_TEMPLATES } from "@/config/industry-templates";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { recordAudit } from "@/modules/administration/audit.service";
import { isAnthropicConfigured } from "@/modules/ai/client";
import { DEFAULT_PERMITTED_TOOLS } from "@/modules/ai/tools/registry";

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());
const list = (max: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]))
    .pipe(z.array(z.string().max(60)).max(max));
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));
const usd = z.coerce.number().min(0).max(10_000).transform((value) => Math.round(value * 1_000_000));

export const agentConfigSchema = z.object({
  name: z.string().trim().min(2).max(40),
  roleDescription: text(300),
  tone: z.enum(["FRIENDLY", "PROFESSIONAL", "WARM", "CONCISE", "PLAYFUL"]),
  language: z.string().trim().min(2).max(10),
  greeting: text(300),
  customInstructions: text(3_000),
  escalationInstructions: text(500),
  escalationKeywords: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value.split(",").map((keyword) => keyword.trim().toLowerCase()).filter(Boolean).slice(0, 20) : [])),
  enabledChannels: list(3).pipe(z.array(z.enum(["WHATSAPP", "INSTAGRAM"]))),
  permittedTools: list(30),
  approvalRequiredTools: list(30),
  businessHoursOnly: checkbox,
  outOfHoursMessage: text(500),
  maxDiscountPercent: z.coerce.number().int().min(0).max(50),
  dailyMessageLimit: z.coerce.number().int().min(1).max(100_000),
  dailySpendLimitUsd: usd,
  monthlySpendLimitUsd: usd,
  modelTierOverride: z
    .enum(["auto", "fast", "standard", "advanced"])
    .transform((value) => (value === "auto" ? null : value)),
});

export type AgentConfigInput = z.infer<typeof agentConfigSchema>;

/** Returns the business's assistant, creating it from the industry template on first use. */
export async function getOrCreateAgent(businessId: string): Promise<AiAgent> {
  const existing = await prisma.aiAgent.findUnique({ where: { businessId } });
  if (existing) return existing;
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { industry: true } });
  const template = INDUSTRY_TEMPLATES[business.industry];
  return prisma.aiAgent.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      tone: template.defaultTone,
      roleDescription: template.roleDescription,
      permittedTools: DEFAULT_PERMITTED_TOOLS,
      escalationKeywords: ["manager", "human", "complaint", "refund"],
      enabledChannels: ["WHATSAPP", "INSTAGRAM"],
    },
  });
}

export async function updateAgentConfig(actor: TenantActor, input: AgentConfigInput): Promise<void> {
  const agent = await getOrCreateAgent(actor.businessId);
  const { dailySpendLimitUsd, monthlySpendLimitUsd, ...rest } = input;
  if (dailySpendLimitUsd > monthlySpendLimitUsd) {
    throw fail.validation("The daily limit can't be higher than the monthly limit.", { dailySpendLimitUsd: ["Must be ≤ monthly limit."] });
  }
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.aiAgent.update({
      where: { id: agent.id },
      data: { ...rest, dailySpendLimitMicros: dailySpendLimitUsd, monthlySpendLimitMicros: monthlySpendLimitUsd },
    });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "ai.agent_updated", entityType: "AiAgent", entityId: agent.id, ipAddress: actor.ipAddress },
      tx,
    );
  });
}

/** Activation requires a verified owner email, a configured provider and a passing test. */
export async function setAgentEnabled(actor: TenantActor, enabled: boolean): Promise<void> {
  const agent = await getOrCreateAgent(actor.businessId);
  if (enabled) {
    if (!actor.emailVerified) throw fail.precondition("Confirm your email address before activating your assistant.");
    if (!isAnthropicConfigured()) throw fail.precondition("The AI provider is not configured on this platform yet.");
    const tested = await prisma.aiRun.count({ where: { businessId: actor.businessId, trigger: "TEST_CONSOLE", status: "SUCCEEDED" } });
    if (tested === 0) throw fail.precondition("Send at least one successful test message in the test console before activating.");
  }
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.aiAgent.update({ where: { id: agent.id }, data: { enabled, activatedAt: enabled ? new Date() : agent.activatedAt } });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: enabled ? "ai.agent_activated" : "ai.agent_deactivated", ipAddress: actor.ipAddress },
      tx,
    );
  });
}

/** Emergency stop halts all AI replies for the workspace immediately, including tests. */
export async function setEmergencyStop(actor: TenantActor, stopped: boolean): Promise<void> {
  const agent = await getOrCreateAgent(actor.businessId);
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.aiAgent.update({
      where: { id: agent.id },
      data: { emergencyStop: stopped, emergencyStoppedAt: stopped ? new Date() : null, emergencyStoppedById: stopped ? actor.userId : null },
    });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: stopped ? "ai.emergency_stop_on" : "ai.emergency_stop_off", ipAddress: actor.ipAddress },
      tx,
    );
  });
}
