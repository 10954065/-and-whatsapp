import { describe, expect, it } from "vitest";
import type { Industry } from "@/generated/prisma/enums";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateAgent } from "@/modules/ai/agent.service";
import { getSetupProgress } from "@/modules/onboarding/setup.service";
import { applyIndustryTemplate, getTemplateOverview } from "@/modules/onboarding/template.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup(industry: Industry) {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Template Shop");
  await prisma.business.update({ where: { id: business.id }, data: { industry } });
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  return { actor, business };
}

const workflowsFor = (businessId: string) => prisma.workflow.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });

describe("industry templates", () => {
  it("saves answers, adds chosen workflows as drafts and sets AI defaults", async () => {
    const { actor, business } = await setup("RETAIL");
    const other = await setup("RETAIL");

    const result = await applyIndustryTemplate(
      actor,
      { answers: { categories: "Phones and accessories", delivery: "Same-day in Accra", returns: "" }, workflows: ["order_payment_reminder", "wholesale_enquiry", "not_a_template"], applyAgentDefaults: true },
      { canManageAutomation: true },
    );
    expect(result).toEqual({ savedAnswers: 2, addedWorkflows: 2, agentUpdated: true });

    const saved = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(saved.knowledgeProfile).toEqual({
      categories: { label: "What you sell", value: "Phones and accessories" },
      delivery: { label: "Delivery & pick-up", value: "Same-day in Accra" },
    });
    const workflows = await workflowsFor(business.id);
    expect(workflows.map((workflow) => [workflow.name, workflow.status, workflow.trigger])).toEqual([
      ["Check payment on new orders", "DRAFT", "NEW_ORDER"],
      ["Route wholesale enquiries", "DRAFT", "WHATSAPP_MESSAGE"],
    ]);
    expect(await prisma.workflowVersion.count({ where: { workflowId: { in: workflows.map((workflow) => workflow.id) } } })).toBe(2);

    const agent = await getOrCreateAgent(business.id);
    expect(agent.tone).toBe("FRIENDLY");
    expect(agent.permittedTools).toEqual(expect.arrayContaining(["check_stock", "create_order"]));

    const progress = await getSetupProgress(business.id);
    expect(progress.steps.find((step) => step.id === "template")?.status).toBe("done");
    expect(progress.steps.find((step) => step.id === "knowledge")?.status).toBe("done");

    // Another workspace is untouched.
    expect(await workflowsFor(other.business.id)).toHaveLength(0);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: other.business.id } })).knowledgeProfile).toEqual({});
  });

  it("never duplicates workflows or overwrites a configured agent unless asked", async () => {
    const { actor, business } = await setup("RETAIL");
    await applyIndustryTemplate(actor, { answers: {}, workflows: ["new_lead_notify"], applyAgentDefaults: false }, { canManageAutomation: true });
    const agent = await getOrCreateAgent(business.id);
    await prisma.aiAgent.update({ where: { id: agent.id }, data: { tone: "CONCISE" } });

    const again = await applyIndustryTemplate(actor, { answers: {}, workflows: ["new_lead_notify", "order_payment_reminder"], applyAgentDefaults: false }, { canManageAutomation: true });
    expect(again.addedWorkflows).toBe(1);
    expect(await workflowsFor(business.id)).toHaveLength(2);
    expect((await prisma.aiAgent.findUniqueOrThrow({ where: { id: agent.id } })).tone).toBe("CONCISE");

    // A deleted template workflow is not revived by re-applying.
    await prisma.workflow.deleteMany({ where: { businessId: business.id, name: "Tell the team about new leads" } });
    await applyIndustryTemplate(actor, { answers: {}, workflows: ["new_lead_notify"], applyAgentDefaults: false }, { canManageAutomation: true });
    expect(await workflowsFor(business.id)).toHaveLength(1);

    const overview = await getTemplateOverview(business.id);
    expect(overview.workflows.filter((workflow) => workflow.added).map((workflow) => workflow.id).sort()).toEqual(["new_lead_notify", "order_payment_reminder"]);
  });

  it("skips workflows without automation permission and replaces answers after an industry change", async () => {
    const { actor, business } = await setup("RETAIL");
    await applyIndustryTemplate(actor, { answers: { categories: "Phones" }, workflows: ["new_lead_notify"], applyAgentDefaults: false }, { canManageAutomation: false });
    expect(await workflowsFor(business.id)).toHaveLength(0);

    await prisma.business.update({ where: { id: business.id }, data: { industry: "SALON_SPA" } });
    const before = await getTemplateOverview(business.id);
    expect(before).toMatchObject({ otherAnswers: 1, appliedAt: null });
    expect((await getSetupProgress(business.id)).steps.find((step) => step.id === "template")?.status).toBe("todo");

    await applyIndustryTemplate(actor, { answers: { services: "Box braids", categories: "ignored" }, workflows: [], applyAgentDefaults: false }, { canManageAutomation: true });
    expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).knowledgeProfile).toEqual({ services: { label: "Services", value: "Box braids" } });
    expect(await prisma.auditLog.count({ where: { businessId: business.id, action: "business.template_applied" } })).toBe(2);
  });
});
