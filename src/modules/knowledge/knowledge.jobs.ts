import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { PermanentJobError, registerJobHandler } from "@/lib/queue";
import { fetchPublicText } from "@/lib/security/ssrf";
import { storage } from "@/lib/storage";
import { isAppError } from "@/lib/monitoring/errors";
import { chunkText } from "@/modules/knowledge/chunking";
import { embedTexts, isEmbeddingConfigured, toVectorLiteral } from "@/modules/knowledge/embeddings";
import { extractText, htmlToText } from "@/modules/knowledge/extraction";
import { validateUpload } from "@/modules/knowledge/upload-validation";

const payloadSchema = z.object({ sourceId: z.string().min(1) });

async function loadText(source: { type: string; content: string | null; fileKey: string | null; fileName: string | null; mimeType: string | null; sourceUrl: string | null }): Promise<string> {
  if (source.type === "FAQ" || source.type === "TEXT") return source.content ?? "";
  if (source.type === "DOCUMENT") {
    if (!source.fileKey || !source.fileName) throw new PermanentJobError("Document file is missing.");
    const bytes = await storage().get(source.fileKey);
    const { kind } = validateUpload(source.fileName, source.mimeType ?? "", bytes);
    return extractText(bytes, kind);
  }
  if (source.type === "WEBSITE") {
    if (!source.sourceUrl) throw new PermanentJobError("Website address is missing.");
    const page = await fetchPublicText(source.sourceUrl);
    return page.contentType.includes("html") ? htmlToText(page.text) : page.text;
  }
  throw new PermanentJobError(`Unsupported source type ${source.type}`);
}

/**
 * Extract → chunk → (embed) → store. Re-running replaces the source's chunks, so the
 * job is idempotent. Validation problems fail permanently; network errors are retried.
 */
export async function processKnowledgeSource(sourceId: string): Promise<void> {
  const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source || source.deletedAt) return;
  await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: "PROCESSING", error: null } });

  try {
    const text = await loadText(source);
    if (text.trim().length < 10) throw new PermanentJobError("No readable text was found in this source.");
    const chunks = chunkText(text, { title: source.title });

    await prisma.$transaction([
      prisma.knowledgeChunk.deleteMany({ where: { sourceId, businessId: source.businessId } }),
      prisma.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({ businessId: source.businessId, sourceId, ordinal: chunk.ordinal, content: chunk.content, tokenEstimate: chunk.tokenEstimate })),
      }),
    ]);

    if (isEmbeddingConfigured()) {
      const stored = await prisma.knowledgeChunk.findMany({ where: { sourceId }, orderBy: { ordinal: "asc" }, select: { id: true, content: true } });
      const vectors = await embedTexts(stored.map((chunk) => chunk.content), "document");
      const model = process.env.VOYAGE_MODEL ?? "voyage-4-lite";
      for (const [index, chunk] of stored.entries()) {
        await prisma.$executeRaw`UPDATE "KnowledgeChunk" SET "embedding" = ${toVectorLiteral(vectors[index])}::vector, "embeddingModel" = ${model} WHERE "id" = ${chunk.id}`;
      }
    }

    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "READY", chunkCount: chunks.length, processedAt: new Date(), error: null },
    });
    logger.info("knowledge.processed", { sourceId, chunks: chunks.length });
  } catch (error) {
    const permanent = error instanceof PermanentJobError || isAppError(error);
    const message = error instanceof Error ? error.message : "Processing failed";
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: permanent ? "FAILED" : "PENDING", error: message.slice(0, 500) },
    });
    if (permanent) throw new PermanentJobError(message);
    throw error;
  }
}

registerJobHandler("knowledge.process", async (payload) => {
  const { sourceId } = payloadSchema.parse(payload);
  await processKnowledgeSource(sourceId);
});
