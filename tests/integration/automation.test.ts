import { describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { processDueJobs } from "@/lib/queue";
import { connectSandbox } from "@/modules/integrations/integration.service";
import { simulateSandboxMessage } from "@/modules/messaging/inbox.service";
import { evaluateConditions, MAX_WORKFLOW_DEPTH, processWorkflowEvent } from "@/modules/workflows/workflow.engine";
import { createWorkflow, listWorkflows, setWorkflowStatus, updateWorkflowDefinition, workflowFormSchema } from "@/modules/workflows/workflow.service";
import { cancelBooking, createService, createStaffMember } from "@/modules/bookings/bookings.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Automation Shop");
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  await connectSandbox(actor);
  return { actor, business };
}

describe("evaluateConditions", () => {
  const event = { trigger: "WHATSAPP_MESSAGE" as const, eventId: "e", businessId: "b", depth: 0, channel: "whatsapp", messageText: "I want WHOLESALE prices", orderTotalMinor: 60_000 };
  it("matches channel, text, tags, totals and hours", () => {
    const context = { customerTags: ["vip"], isOpenNow: true };
    expect(evaluateConditions([{ field: "message_contains", value: "wholesale" }, { field: "channel", value: "whatsapp" }], event, context)).toBe(true);
    expect(evaluateConditions([{ field: "customer_tag", value: "vip" }, { field: "order_total_gte", value: "500" }], event, context)).toBe(true);
    expect(evaluateConditions([{ field: "order_total_gte", value: "601" }], event, context)).toBe(false);
    expect(evaluateConditions([{ field: "within_business_hours", value: "no" }], event, context)).toBe(false);
    expect(evaluateConditions([], event, context)).toBe(true);
  });
});

describe("workflow execution", () => {
  it("runs on a real inbound message, once per event, and records steps", async () => {
    const { actor, business } = await setup();
    const workflow = await createWorkflow(actor, {
      name: "Tag wholesale enquiries",
      trigger: "WHATSAPP_MESSAGE",
      definition: {
        conditions: [{ field: "message_contains", value: "wholesale" }],
        actions: [
          { type: "add_customer_tag", value: "wholesale" },
          { type: "create_lead", value: "Wholesale pricing" },
          { type: "notify_team", value: "Wholesale enquiry" },
        ],
      },
    });
    await setWorkflowStatus(actor, workflow.id, "ACTIVE");

    const message = await simulateSandboxMessage(actor, { customerName: "Kwesi", text: "Do you do wholesale?" });
    await processDueJobs({ workerId: "vitest", limit: 30 });

    const run = await prisma.workflowRun.findFirstOrThrow({ where: { workflowId: workflow.id } });
    expect(run.status).toBe("SUCCEEDED");
    const customer = await prisma.customer.findFirstOrThrow({ where: { businessId: business.id, displayName: "Kwesi" } });
    expect(customer.tags).toContain("wholesale");
    expect(await prisma.lead.count({ where: { customerId: customer.id, capturedBy: "AUTOMATION" } })).toBe(1);
    expect(await prisma.notification.count({ where: { businessId: business.id, type: "automation" } })).toBe(1);

    // Re-delivering the same event never runs the workflow twice.
    await processWorkflowEvent({ trigger: "WHATSAPP_MESSAGE", eventId: `message:${message!.messageId}`, businessId: business.id, depth: 0, customerId: customer.id, messageText: "Do you do wholesale?" });
    expect(await prisma.workflowRun.count({ where: { workflowId: workflow.id } })).toBe(1);
  });

  it("runs booking-cancelled workflows when a booking is cancelled", async () => {
    const { actor, business } = await setup();
    const customer = await prisma.customer.create({ data: { businessId: business.id, displayName: "Akua" } });
    const service = await createService(actor, { name: "Pedicure", durationMinutes: 45, bufferMinutes: 0, price: null });
    const staff = await createStaffMember(actor, { name: "Abena", serviceIds: [service.id], days: [2], start: "09:00", end: "17:00" });
    const startsAt = new Date("2027-01-05T10:00:00Z");
    const booking = await prisma.booking.create({
      data: { businessId: business.id, serviceId: service.id, staffId: staff.id, customerId: customer.id, startsAt, endsAt: new Date(startsAt.getTime() + 2_700_000), blockedUntil: new Date(startsAt.getTime() + 2_700_000), createdByType: "USER" },
    });
    const workflow = await createWorkflow(actor, { name: "Tag cancellations", trigger: "BOOKING_CANCELLED", definition: { conditions: [], actions: [{ type: "add_customer_tag", value: "cancelled" }] } });
    await setWorkflowStatus(actor, workflow.id, "ACTIVE");

    await cancelBooking(actor, booking.id, "Customer travelling");
    await processDueJobs({ workerId: "vitest", limit: 30 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).tags).toContain("cancelled");
  });

  it("skips runs that don't match, are too deeply chained, or are paused", async () => {
    const { actor, business } = await setup();
    const workflow = await createWorkflow(actor, { name: "Notify", trigger: "NEW_ORDER", definition: { conditions: [{ field: "order_total_gte", value: "100" }], actions: [{ type: "notify_team", value: "Big order" }] } });
    await setWorkflowStatus(actor, workflow.id, "ACTIVE");
    await processWorkflowEvent({ trigger: "NEW_ORDER", eventId: "order:small", businessId: business.id, depth: 0, orderTotalMinor: 5_000 });
    await processWorkflowEvent({ trigger: "NEW_ORDER", eventId: "order:deep", businessId: business.id, depth: MAX_WORKFLOW_DEPTH + 1, orderTotalMinor: 50_000 });
    const runs = await prisma.workflowRun.findMany({ where: { workflowId: workflow.id }, orderBy: { createdAt: "asc" } });
    expect(runs.map((run) => run.status)).toEqual(["SKIPPED", "SKIPPED"]);
    expect(runs[1].error).toMatch(/Loop protection/);

    await setWorkflowStatus(actor, workflow.id, "PAUSED");
    await processWorkflowEvent({ trigger: "NEW_ORDER", eventId: "order:paused", businessId: business.id, depth: 0, orderTotalMinor: 50_000 });
    expect(await prisma.workflowRun.count({ where: { workflowId: workflow.id } })).toBe(2);
  });
});

describe("workflow builder", () => {
  it("turns builder rows into a definition, ignoring empty or unknown rows", () => {
    const parsed = workflowFormSchema.parse({
      name: "Wholesale",
      trigger: "WHATSAPP_MESSAGE",
      c1_field: "message_contains",
      c1_value: "wholesale",
      c2_field: "not_a_field",
      c2_value: "x",
      a1_type: "add_customer_tag",
      a1_value: "wholesale",
      a2_type: "",
      a3_type: "notify_team",
      a3_value: "Wholesale enquiry",
    });
    expect(parsed.definition).toEqual({
      conditions: [{ field: "message_contains", value: "wholesale" }],
      actions: [
        { type: "add_customer_tag", value: "wholesale" },
        { type: "notify_team", value: "Wholesale enquiry" },
      ],
    });
    expect(workflowFormSchema.safeParse({ name: "Nothing to do", trigger: "NEW_ORDER" }).success).toBe(false);
  });

  it("versions every saved change and lists runs", async () => {
    const { actor, business } = await setup();
    const workflow = await createWorkflow(actor, { name: "Notify", trigger: "NEW_LEAD", definition: { conditions: [], actions: [{ type: "notify_team", value: "Lead" }] } });
    await updateWorkflowDefinition(actor, workflow.id, { conditions: [], actions: [{ type: "notify_team", value: "New lead!" }] });
    expect((await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } })).currentVersion).toBe(2);
    expect(await prisma.workflowVersion.count({ where: { workflowId: workflow.id } })).toBe(2);
    await expect(updateWorkflowDefinition(actor, "missing", { conditions: [], actions: [{ type: "notify_team", value: "x" }] })).rejects.toThrow(/not found/i);
    await expect(setWorkflowStatus(actor, "missing", "ACTIVE")).rejects.toThrow(/not found/i);
    const { workflows } = await listWorkflows(business.id);
    expect(workflows.map((entry) => entry.id)).toContain(workflow.id);
  });
});
