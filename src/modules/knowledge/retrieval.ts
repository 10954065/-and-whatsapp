import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { embedTexts, isEmbeddingConfigured, toVectorLiteral } from "@/modules/knowledge/embeddings";

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  score: number;
}

const MAX_TERMS = 12;
const RRF_K = 60;

/** Turns a natural question into an OR tsquery of its words ("deliver | osu | sunday"). */
export function toOrTsQuery(query: string): string | null {
  const terms = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((term) => term.length > 1).slice(0, MAX_TERMS);
  if (terms.length === 0) return null;
  return Array.from(new Set(terms)).join(" | ");
}

/** Full-text retrieval over the business's own READY knowledge chunks. */
export async function searchKnowledgeText(businessId: string, query: string, limit = 5): Promise<RetrievedChunk[]> {
  const tsQuery = toOrTsQuery(query);
  if (!tsQuery) return [];
  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT c."id", c."sourceId", s."title", c."content",
           ts_rank_cd(to_tsvector('english', c."content"), to_tsquery('english', ${tsQuery}))::float8 AS "score"
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
    WHERE c."businessId" = ${businessId} AND s."businessId" = ${businessId}
      AND s."deletedAt" IS NULL AND s."status" = 'READY'
      AND to_tsvector('english', c."content") @@ to_tsquery('english', ${tsQuery})
    ORDER BY "score" DESC
    LIMIT ${limit}`;
  return rows.map((row) => ({ ...row, score: Number(row.score) }));
}

/** Cosine-similarity retrieval over pgvector embeddings (only chunks that have one). */
export async function searchKnowledgeVector(businessId: string, query: string, limit = 5): Promise<RetrievedChunk[]> {
  const [vector] = await embedTexts([query], "query");
  const literal = toVectorLiteral(vector);
  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT c."id", c."sourceId", s."title", c."content",
           (1 - (c."embedding" <=> ${literal}::vector))::float8 AS "score"
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
    WHERE c."businessId" = ${businessId} AND s."businessId" = ${businessId}
      AND s."deletedAt" IS NULL AND s."status" = 'READY' AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> ${literal}::vector
    LIMIT ${limit}`;
  return rows.map((row) => ({ ...row, score: Number(row.score) }));
}

/** Reciprocal-rank fusion of several ranked lists. */
export function fuseRankings(lists: RetrievedChunk[][], limit: number): RetrievedChunk[] {
  const scores = new Map<string, { chunk: RetrievedChunk; score: number }>();
  for (const list of lists) {
    list.forEach((chunk, rank) => {
      const entry = scores.get(chunk.id) ?? { chunk, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      scores.set(chunk.id, entry);
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({ ...chunk, score }));
}

/**
 * Hybrid retrieval, always scoped to one business: full-text search plus (when Voyage is
 * configured) vector similarity, fused by rank. Falls back to full-text on embedding errors.
 */
export async function searchKnowledge(businessId: string, query: string, limit = 5): Promise<RetrievedChunk[]> {
  const text = await searchKnowledgeText(businessId, query, limit * 2);
  if (!isEmbeddingConfigured()) return text.slice(0, limit);
  try {
    const vector = await searchKnowledgeVector(businessId, query, limit * 2);
    return fuseRankings([vector, text], limit);
  } catch (error) {
    logger.warn("knowledge.vector_search_failed", { businessId, error });
    return text.slice(0, limit);
  }
}
