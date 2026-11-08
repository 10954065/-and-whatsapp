import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { buildBusinessFacts, type BusinessForPrompt } from "@/modules/ai/context";
import { escalateConversation } from "@/modules/ai/escalation";
import { defineTool } from "@/modules/ai/tools/types";
import type { BusinessHours } from "@/modules/businesses/settings.schemas";
import { searchKnowledge } from "@/modules/knowledge/retrieval";

export const searchKnowledgeTool = defineTool({
  name: "search_knowledge",
  label: "Search the knowledge base",
  description:
    "Searches this business's knowledge base (FAQs, policies, documents, descriptions) for passages relevant to a question. Use it before answering any question about products, services, prices, delivery, returns, policies or procedures that is not already answered by the business facts or earlier tool results. Returns up to five passages; if none match, say you will check with the team.",
  isWrite: false,
  schema: z.strictObject({ query: z.string().min(2).max(300).describe("The customer's question rephrased as a short search query") }),
  async execute(context, input) {
    const chunks = await searchKnowledge(context.businessId, input.query, 5);
    if (chunks.length === 0) return { ok: true, message: "No matching knowledge found.", verifiedFacts: [] };
    return {
      ok: true,
      message: chunks.map((chunk, index) => `[${index + 1}] ${chunk.title}: ${chunk.content}`).join("\n\n"),
      verifiedFacts: chunks.map((chunk) => chunk.content),
    };
  },
});

export const businessInfoTool = defineTool({
  name: "get_business_info",
  label: "Read business details",
  description:
    "Returns the business's current profile: description, address, contact details, opening hours and currency. Use it when the customer asks where you are, how to reach you or when you are open.",
  isWrite: false,
  schema: z.strictObject({}),
  async execute(context) {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: context.businessId } });
    const facts = buildBusinessFacts({ ...business, businessHours: business.businessHours as BusinessHours | null } satisfies BusinessForPrompt);
    return { ok: true, message: facts, verifiedFacts: [facts] };
  },
});

export const escalateTool = defineTool({
  name: "escalate_to_human",
  label: "Escalate to a team member",
  description:
    "Hands the conversation to a human team member and pauses AI replies in it. Use when the customer asks for a person, is unhappy, raises a complaint or refund, needs something you cannot do, or when the answer is not in your sources. After calling it, tell the customer a team member will follow up.",
  isWrite: true,
  schema: z.strictObject({
    reason: z.enum(["customer_request", "complaint", "unknown_answer", "sensitive_topic", "action_not_allowed", "other"]),
    summary: z.string().min(5).max(500).describe("One or two sentences for the team: what the customer needs"),
  }),
  async execute(context, input) {
    if (context.mode === "test") {
      return { ok: true, escalated: true, message: "TEST MODE: the conversation would be handed to the team." };
    }
    await escalateConversation({
      businessId: context.businessId,
      conversationId: context.conversationId,
      reason: input.reason,
      summary: input.summary,
    });
    return { ok: true, escalated: true, message: "Escalated. A team member has been notified and AI replies are paused." };
  },
});

export const captureLeadTool = defineTool({
  name: "capture_lead",
  label: "Capture leads",
  description:
    "Records that this customer is interested in buying or booking, so the team can follow up. Use when the customer shows clear buying intent (asks for a quote, says they want to buy, asks how to order) and no order or booking is being created right now. Do not use for general questions.",
  isWrite: true,
  schema: z.strictObject({
    interest: z.string().min(3).max(300).describe("What the customer is interested in"),
    estimated_value: z.number().int().min(0).max(100_000_000).optional().describe("Estimated value in minor currency units (pesewas), only if known from tool results"),
  }),
  async execute(context, input) {
    if (context.mode === "test") return { ok: true, message: `TEST MODE: a lead would be recorded for “${input.interest}”.` };
    if (!context.customerId) return { ok: false, message: "No customer is linked to this conversation." };
    const lead = await withTenantTx(context.businessId, async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { businessId: context.businessId, customerId: context.customerId!, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] } },
      });
      if (existing) {
        return tx.lead.update({ where: { id: existing.id }, data: { interest: input.interest, estimatedValueMinor: input.estimated_value ?? existing.estimatedValueMinor } });
      }
      return tx.lead.create({
        data: {
          businessId: context.businessId,
          customerId: context.customerId!,
          interest: input.interest,
          estimatedValueMinor: input.estimated_value ?? null,
          currency: context.currency,
          capturedBy: "AI",
          source: "ai_conversation",
          conversationId: context.conversationId,
        },
      });
    });
    return { ok: true, message: `Lead recorded (${lead.status}).`, data: { leadId: lead.id } };
  },
});

export const followUpTool = defineTool({
  name: "create_follow_up",
  label: "Schedule follow-ups",
  description:
    "Creates a follow-up task for the team, for example to call back, send a quote or check on an unpaid order. Use when the customer asks to be contacted later or when a promised action needs a reminder.",
  isWrite: true,
  schema: z.strictObject({
    title: z.string().min(3).max(140),
    due_in_hours: z.number().int().min(1).max(24 * 30),
    notes: z.string().max(1_000).optional(),
  }),
  async execute(context, input) {
    if (context.mode === "test") return { ok: true, message: `TEST MODE: a follow-up “${input.title}” would be scheduled.` };
    const task = await withTenantTx(context.businessId, (tx) =>
      tx.followUpTask.create({
        data: {
          businessId: context.businessId,
          title: input.title,
          notes: input.notes ?? null,
          dueAt: new Date(Date.now() + input.due_in_hours * 3_600_000),
          customerId: context.customerId,
          conversationId: context.conversationId,
          createdByType: "AI",
        },
      }),
    );
    return { ok: true, message: `Follow-up scheduled for ${task.dueAt.toISOString()}.`, data: { taskId: task.id } };
  },
});
