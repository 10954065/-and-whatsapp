import { env } from "@/lib/env";

export const EMBEDDING_DIMENSIONS = 1024;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 64;

export function isEmbeddingConfigured(): boolean {
  return Boolean(env().VOYAGE_API_KEY);
}

/**
 * Voyage AI embeddings (Anthropic's recommended embeddings provider). Optional: without
 * VOYAGE_API_KEY, retrieval uses PostgreSQL full-text search only.
 */
export async function embedTexts(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const { VOYAGE_API_KEY, VOYAGE_MODEL } = env();
  if (!VOYAGE_API_KEY) throw new Error("Embeddings are not configured (VOYAGE_API_KEY missing).");
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE);
    const response = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${VOYAGE_API_KEY}` },
      body: JSON.stringify({ input: batch, model: VOYAGE_MODEL, input_type: inputType, output_dimension: EMBEDDING_DIMENSIONS }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Voyage embeddings failed (${response.status})`);
    const body = (await response.json()) as { data: { embedding: number[]; index: number }[] };
    const sorted = [...body.data].sort((a, b) => a.index - b.index);
    for (const entry of sorted) {
      if (entry.embedding.length !== EMBEDDING_DIMENSIONS) throw new Error("Unexpected embedding dimension");
      vectors.push(entry.embedding);
    }
  }
  return vectors;
}

/** pgvector literal for a parameterised query ("[0.1,0.2,…]"). */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => (Number.isFinite(value) ? value : 0)).join(",")}]`;
}
