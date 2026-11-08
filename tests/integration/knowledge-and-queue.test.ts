import { beforeAll, describe, expect, it } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { enqueueJob, processDueJobs, registerJobHandler, retryJob, runJobById } from "@/lib/queue";
import { createFaq, createTextSource, deleteKnowledgeSource, uploadDocument } from "@/modules/knowledge/knowledge.service";
import { searchKnowledge } from "@/modules/knowledge/retrieval";
import { createBusinessFor, createUser } from "./helpers";

async function actorFor(name: string): Promise<TenantActor> {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, name);
  return { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
}

async function drainQueue() {
  await prisma.job.updateMany({ where: { type: { startsWith: "test." } }, data: { status: "CANCELLED" } });
  return processDueJobs({ workerId: "vitest", limit: 50, timeBudgetMs: 20_000 });
}

describe("job queue", () => {
  beforeAll(() => {
    let calls = 0;
    registerJobHandler("test.flaky", async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient failure");
    });
    registerJobHandler("test.broken", async () => {
      throw new Error("always fails");
    });
  });

  it("stores idempotent jobs only once", async () => {
    const key = `idem-test-${Date.now()}`;
    const first = await enqueueJob("test.noop", {}, { idempotencyKey: key });
    const second = await enqueueJob("test.noop", {}, { idempotencyKey: key });
    expect(second).toEqual({ id: first.id, created: false });
    await prisma.job.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
  });

  it("retries failed jobs with back-off, then succeeds", async () => {
    const { id } = await enqueueJob("test.flaky", {});
    expect(await runJobById(id, "vitest")).toBe(false);
    let job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job).toMatchObject({ status: "PENDING", attempts: 1, lastError: "transient failure" });
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
    expect(await runJobById(id, "vitest")).toBeNull();

    await prisma.job.update({ where: { id }, data: { runAt: new Date() } });
    expect(await runJobById(id, "vitest")).toBe(true);
    job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("SUCCEEDED");
  });

  it("marks jobs DEAD after max attempts and lets operators retry them", async () => {
    const { id } = await enqueueJob("test.broken", {}, { maxAttempts: 1 });
    await runJobById(id, "vitest");
    expect((await prisma.job.findUniqueOrThrow({ where: { id } })).status).toBe("DEAD");
    await retryJob(id);
    expect(await prisma.job.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PENDING", attempts: 0 });
    await prisma.job.update({ where: { id }, data: { status: "CANCELLED" } });
  });
});

describe("knowledge base", () => {
  it("processes FAQs, text and documents into searchable chunks", async () => {
    const actor = await actorFor("Adwoa's Kitchen");
    await createFaq(actor, { question: "Do you deliver on Sundays?", answer: "Yes, within Accra from 10am to 4pm for GH₵20." });
    await createTextSource(actor, { title: "Catering", content: "We cater weddings and funerals for up to 300 guests with two weeks' notice." });
    await uploadDocument(actor, { name: "menu.csv", type: "text/csv", bytes: new TextEncoder().encode("Dish,Price\nJollof with chicken,85\nBanku and tilapia,120") });
    await drainQueue();

    const sources = await prisma.knowledgeSource.findMany({ where: { businessId: actor.businessId } });
    expect(sources.map((source) => source.status)).toEqual(["READY", "READY", "READY"]);

    const delivery = await searchKnowledge(actor.businessId, "Do you deliver on Sunday?");
    expect(delivery[0]?.content).toContain("10am to 4pm");
    const menu = await searchKnowledge(actor.businessId, "how much is banku");
    expect(menu[0]?.content).toContain("Banku and tilapia; Price: 120");
  });

  it("never returns another business's knowledge", async () => {
    const first = await actorFor("First Shop");
    const second = await actorFor("Second Shop");
    await createTextSource(first, { title: "Secret supplier", content: "Our wholesale supplier is Kumasi Fabrics Limited at Adum." });
    await drainQueue();
    expect(await searchKnowledge(first.businessId, "wholesale supplier Kumasi")).toHaveLength(1);
    expect(await searchKnowledge(second.businessId, "wholesale supplier Kumasi")).toHaveLength(0);
  });

  it("rejects duplicates and removes deleted sources from retrieval", async () => {
    const actor = await actorFor("Dup Shop");
    const bytes = new TextEncoder().encode("Returns are accepted within seven days with a receipt.");
    const source = await uploadDocument(actor, { name: "returns.txt", type: "text/plain", bytes });
    await expect(uploadDocument(actor, { name: "returns-copy.txt", type: "text/plain", bytes })).rejects.toThrow(/already in your knowledge base/);
    await drainQueue();
    expect(await searchKnowledge(actor.businessId, "returns receipt")).toHaveLength(1);
    await deleteKnowledgeSource(actor, source.id);
    expect(await searchKnowledge(actor.businessId, "returns receipt")).toHaveLength(0);
  });

  it("marks unreadable documents as failed without retrying forever", async () => {
    const actor = await actorFor("Broken Docs");
    await uploadDocument(actor, { name: "short.txt", type: "text/plain", bytes: new TextEncoder().encode("Hi") });
    await drainQueue();
    const source = await prisma.knowledgeSource.findFirstOrThrow({ where: { businessId: actor.businessId } });
    expect(source.status).toBe("FAILED");
    expect(source.error).toMatch(/No readable text/);
    const job = await prisma.job.findFirstOrThrow({ where: { businessId: actor.businessId, type: "knowledge.process" } });
    expect(job.status).toBe("DEAD");
  });
});
