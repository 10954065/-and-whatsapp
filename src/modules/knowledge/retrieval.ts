import { prisma } from "@/lib/db/prisma";

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  score: number;
}

const MAX_TERMS = 12;

/** Turns a natural question into an OR tsquery of its words ("deliver | osu | sunday"). */
export function toOrTsQuery(query: string): string | null {
  const terms = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((term) => term.length > 1).slice(0, MAX_TERMS);
  if (terms.length === 0) return null;
  return Array.from(new Set(terms)).join(" | ");
}

/**
 * Full-text retrieval over the business's own knowledge chunks. Always filtered by
 * businessId — knowledge is never shared between businesses. Phase 4 adds vector
 * similarity (pgvector) and blends both scores.
 */
export async function searchKnowledgeText(businessId: string, query: string, limit = 5): Promise<RetrievedChunk[]> {
  const tsQuery = toOrTsQuery(query);
  if (!tsQuery) return [];
  const rows = await prisma.$queryRaw<{ id: string; sourceId: string; title: string; content: string; score: number }[]>`
    SELECT c."id", c."sourceId", s."title", c."content",
           ts_rank_cd(to_tsvector('english', c."content"), to_tsquery('english', ${tsQuery}))::float8 AS "score"
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
    WHERE c."businessId" = ${businessId}
      AND s."businessId" = ${businessId}
      AND s."deletedAt" IS NULL
      AND s."status" = 'READY'
      AND to_tsvector('english', c."content") @@ to_tsquery('english', ${tsQuery})
    ORDER BY "score" DESC
    LIMIT ${limit}`;
  return rows.map((row) => ({ ...row, score: Number(row.score) }));
}
