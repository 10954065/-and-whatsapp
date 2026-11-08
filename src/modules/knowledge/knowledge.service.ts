import { z } from "zod";
import type { KnowledgeSourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { enqueueJob } from "@/lib/queue";
import { sha256Hex } from "@/lib/security/crypto";
import { assertPublicUrl } from "@/lib/security/ssrf";
import { buildObjectKey, storage } from "@/lib/storage";
import { recordAudit } from "@/modules/administration/audit.service";
import { getPlanLimits } from "@/modules/billing/usage";
import { validateUpload } from "@/modules/knowledge/upload-validation";

export const faqSchema = z.object({
  question: z.string().trim().min(5, "Write the question.").max(300),
  answer: z.string().trim().min(2, "Write the answer.").max(4_000),
});

export const textSourceSchema = z.object({
  title: z.string().trim().min(2, "Give it a title.").max(120),
  content: z.string().trim().min(20, "Add at least a sentence or two.").max(50_000),
});

export const websiteSchema = z.object({ url: z.string().trim().max(2_000) });

export async function listKnowledgeSources(businessId: string) {
  return prisma.knowledgeSource.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function getKnowledgeStorageBytes(businessId: string): Promise<number> {
  const result = await prisma.knowledgeSource.aggregate({ where: { businessId, deletedAt: null }, _sum: { sizeBytes: true } });
  return result._sum.sizeBytes ?? 0;
}

async function assertStorageAvailable(businessId: string, additionalBytes: number): Promise<void> {
  const [limits, used] = await Promise.all([getPlanLimits(businessId), getKnowledgeStorageBytes(businessId)]);
  if (used + additionalBytes > limits.knowledgeStorageMb * 1024 * 1024) {
    throw fail.limitExceeded(`This would exceed your plan's knowledge storage (${limits.knowledgeStorageMb} MB). Remove old documents or upgrade.`);
  }
}

async function createSource(
  actor: TenantActor,
  data: { type: KnowledgeSourceType; title: string; question?: string; content?: string; fileKey?: string; fileName?: string; mimeType?: string; sizeBytes?: number; contentHash?: string; sourceUrl?: string },
  previous?: { id: string; version: number },
) {
  const source = await withTenantTx(actor.businessId, async (tx) => {
    const created = await tx.knowledgeSource.create({
      data: {
        businessId: actor.businessId,
        createdById: actor.userId,
        version: previous ? previous.version + 1 : 1,
        previousVersionId: previous?.id ?? null,
        ...data,
      },
    });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "knowledge.source_created", entityType: "KnowledgeSource", entityId: created.id, metadata: { type: data.type } },
      tx,
    );
    return created;
  });
  await enqueueJob("knowledge.process", { sourceId: source.id }, { businessId: actor.businessId, idempotencyKey: `knowledge:${source.id}:v${source.version}` });
  return source;
}

export async function createFaq(actor: TenantActor, input: z.infer<typeof faqSchema>) {
  const content = `Q: ${input.question}\nA: ${input.answer}`;
  await assertStorageAvailable(actor.businessId, Buffer.byteLength(content));
  return createSource(actor, { type: "FAQ", title: input.question, question: input.question, content, sizeBytes: Buffer.byteLength(content) });
}

export async function createTextSource(actor: TenantActor, input: z.infer<typeof textSourceSchema>) {
  await assertStorageAvailable(actor.businessId, Buffer.byteLength(input.content));
  return createSource(actor, { type: "TEXT", title: input.title, content: input.content, sizeBytes: Buffer.byteLength(input.content) });
}

export async function uploadDocument(actor: TenantActor, file: { name: string; type: string; bytes: Uint8Array }) {
  validateUpload(file.name, file.type, file.bytes);
  await assertStorageAvailable(actor.businessId, file.bytes.byteLength);
  const contentHash = sha256Hex(Buffer.from(file.bytes));
  const duplicate = await prisma.knowledgeSource.findFirst({ where: { businessId: actor.businessId, contentHash, deletedAt: null } });
  if (duplicate) throw fail.conflict(`This file is already in your knowledge base as “${duplicate.title}”.`);
  const fileKey = buildObjectKey(actor.businessId, "knowledge", file.name);
  await storage().put(fileKey, file.bytes, file.type || "application/octet-stream");
  return createSource(actor, {
    type: "DOCUMENT",
    title: file.name.replace(/\.[^.]+$/, ""),
    fileKey,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.bytes.byteLength,
    contentHash,
  });
}

/** The URL is validated now (SSRF guard) and fetched by the background job. */
export async function importWebsite(actor: TenantActor, rawUrl: string) {
  const url = await assertPublicUrl(rawUrl);
  return createSource(actor, { type: "WEBSITE", title: url.hostname + url.pathname.replace(/\/$/, ""), sourceUrl: url.toString() });
}

/** Editing creates a new version; the old version stays in history and leaves retrieval. */
export async function updateTextSource(actor: TenantActor, sourceId: string, input: { title: string; content: string; question?: string }) {
  const current = await prisma.knowledgeSource.findFirst({ where: { id: sourceId, businessId: actor.businessId, deletedAt: null } });
  if (!current || (current.type !== "TEXT" && current.type !== "FAQ")) throw fail.notFound("Knowledge source");
  const content = current.type === "FAQ" ? `Q: ${input.question ?? input.title}\nA: ${input.content}` : input.content;
  const next = await createSource(
    actor,
    { type: current.type, title: input.title, question: current.type === "FAQ" ? (input.question ?? input.title) : undefined, content, sizeBytes: Buffer.byteLength(content) },
    { id: current.id, version: current.version },
  );
  await prisma.knowledgeSource.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
  return next;
}

export async function deleteKnowledgeSource(actor: TenantActor, sourceId: string): Promise<void> {
  const source = await prisma.knowledgeSource.findFirst({ where: { id: sourceId, businessId: actor.businessId, deletedAt: null } });
  if (!source) throw fail.notFound("Knowledge source");
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.knowledgeChunk.deleteMany({ where: { sourceId, businessId: actor.businessId } });
    await tx.knowledgeSource.update({ where: { id: sourceId }, data: { deletedAt: new Date(), chunkCount: 0 } });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "knowledge.source_deleted", entityType: "KnowledgeSource", entityId: sourceId },
      tx,
    );
  });
  if (source.fileKey) await storage().delete(source.fileKey).catch(() => undefined);
}

export async function reprocessKnowledgeSource(actor: TenantActor, sourceId: string): Promise<void> {
  const source = await prisma.knowledgeSource.findFirst({ where: { id: sourceId, businessId: actor.businessId, deletedAt: null } });
  if (!source) throw fail.notFound("Knowledge source");
  await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: "PENDING", error: null } });
  await enqueueJob("knowledge.process", { sourceId }, { businessId: actor.businessId, idempotencyKey: `knowledge:${sourceId}:retry:${Date.now()}` });
}
