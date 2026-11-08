import { describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { processDueJobs } from "@/lib/queue";
import { connectSandbox } from "@/modules/integrations/integration.service";
import { replyAsStaff, returnToAi, simulateSandboxMessage } from "@/modules/messaging/inbox.service";
import { recordInboundMessage } from "@/modules/messaging/inbound.service";
import { sendConversationMessage } from "@/modules/messaging/outbound.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Inbox Test Shop");
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  const sandbox = await connectSandbox(actor);
  return { actor, business, sandbox };
}

const RUN = Date.now().toString(36);
const baseMessage = (businessId: string, integrationId: string, id: string, text: string, customerExternalId = "233200000001") => ({
  integrationId,
  businessId,
  channel: "SANDBOX" as const,
  customerExternalId,
  customerName: "Kojo",
  providerMessageId: `${id}-${RUN}`,
  type: "TEXT" as const,
  text,
  attachments: [],
  timestamp: new Date(),
});

describe("inbound messages", () => {
  it("creates the customer, conversation and message once (duplicates are ignored)", async () => {
    const { business, sandbox } = await setup();
    const first = await recordInboundMessage(baseMessage(business.id, sandbox.id, "dup-1", "Hello"));
    const again = await recordInboundMessage(baseMessage(business.id, sandbox.id, "dup-1", "Hello"));
    expect(first?.isNewCustomer).toBe(true);
    expect(again).toBeNull();
    expect(await prisma.message.count({ where: { businessId: business.id } })).toBe(1);
    const next = await recordInboundMessage(baseMessage(business.id, sandbox.id, "dup-2", "Are you open?"));
    expect(next?.conversationId).toBe(first?.conversationId);
    expect(next?.isNewCustomer).toBe(false);
  });

  it("records opt-outs and then refuses to message the customer", async () => {
    const { business, sandbox } = await setup();
    const result = await recordInboundMessage(baseMessage(business.id, sandbox.id, "stop-1", "STOP", "233200000099"));
    expect(result?.optedOut).toBe(true);
    const identity = await prisma.customerIdentity.findFirstOrThrow({ where: { businessId: business.id, externalId: "233200000099" } });
    expect(identity.consentStatus).toBe("OPTED_OUT");
    expect(await prisma.consentRecord.count({ where: { customerId: identity.customerId, status: "OPTED_OUT" } })).toBe(1);
    await expect(
      sendConversationMessage({ businessId: business.id, conversationId: result!.conversationId, sender: "STAFF", text: "Hi", idempotencyKey: `opt-out-test-${RUN}` }),
    ).rejects.toThrow(/opted out/);
  });
});

describe("outbound messages", () => {
  it("sends idempotently and records sandboxed delivery", async () => {
    const { business, sandbox } = await setup();
    const inbound = await recordInboundMessage(baseMessage(business.id, sandbox.id, "out-1", "Hi"));
    const send = () => sendConversationMessage({ businessId: business.id, conversationId: inbound!.conversationId, sender: "STAFF", text: "Hello!", idempotencyKey: `idem-out-1-${RUN}` });
    const first = await send();
    const second = await send();
    expect(second.id).toBe(first.id);
    expect(first.deliveryStatus).toBe("SANDBOXED");
    expect(await prisma.message.count({ where: { conversationId: inbound!.conversationId, direction: "OUTBOUND" } })).toBe(1);
  });

  it("enforces the 24-hour customer-service window", async () => {
    const { business, sandbox } = await setup();
    const inbound = await recordInboundMessage(baseMessage(business.id, sandbox.id, "window-1", "Hi"));
    await prisma.conversation.update({ where: { id: inbound!.conversationId }, data: { lastInboundAt: new Date(Date.now() - 25 * 3_600_000) } });
    await expect(
      sendConversationMessage({ businessId: business.id, conversationId: inbound!.conversationId, sender: "STAFF", text: "Late reply", idempotencyKey: `window-test-${RUN}` }),
    ).rejects.toThrow(/24 hours/);
  });

  it("refuses to send into another business's conversation", async () => {
    const first = await setup();
    const second = await setup();
    const inbound = await recordInboundMessage(baseMessage(first.business.id, first.sandbox.id, "cross-1", "Hi"));
    await expect(
      sendConversationMessage({ businessId: second.business.id, conversationId: inbound!.conversationId, sender: "STAFF", text: "x", idempotencyKey: `cross-test-${RUN}` }),
    ).rejects.toThrow(/not found/);
  });
});

describe("inbox workflow", () => {
  it("runs the sandbox pipeline, then lets staff take over and hand back", async () => {
    const { actor, business } = await setup();
    const result = await simulateSandboxMessage(actor, { customerName: "Ama", text: "Do you deliver?" });
    expect(result).not.toBeNull();
    const job = await prisma.job.findFirstOrThrow({ where: { businessId: business.id, type: "ai.reply" } });
    await processDueJobs({ workerId: "vitest", limit: 20 });
    // Without an Anthropic key the AI run is skipped honestly — no fake reply is produced.
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("SUCCEEDED");
    expect(await prisma.message.count({ where: { conversationId: result!.conversationId, sender: "AI" } })).toBe(0);
    expect((await prisma.message.findFirstOrThrow({ where: { id: result!.messageId } })).processingStatus).toBe("SKIPPED");

    await replyAsStaff(actor, { conversationId: result!.conversationId, text: "Yes, we deliver across Accra." });
    let conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: result!.conversationId } });
    expect(conversation).toMatchObject({ control: "HUMAN", assignedToId: actor.userId });

    await returnToAi(actor, result!.conversationId);
    conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: result!.conversationId } });
    expect(conversation.control).toBe("AI");
  });
});
