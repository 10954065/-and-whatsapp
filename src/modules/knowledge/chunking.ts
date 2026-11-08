export interface Chunk {
  ordinal: number;
  content: string;
  tokenEstimate: number;
}

/** Rough token estimate (≈4 characters per token for English text). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitLong(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const sentences = paragraph.match(/[^.!?\n]+[.!?]+["')\]]*\s*|[^.!?\n]+$/g) ?? [paragraph];
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current) {
      parts.push(current.trim());
      current = "";
    }
    if (sentence.length > maxChars) {
      for (let index = 0; index < sentence.length; index += maxChars) parts.push(sentence.slice(index, index + maxChars).trim());
    } else {
      current += sentence;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Paragraph-aware chunking with a small overlap so facts that straddle a boundary remain
 * retrievable. The title is prefixed to each chunk to keep it self-contained.
 */
export function chunkText(text: string, options: { title?: string; maxChars?: number; overlapChars?: number } = {}): Chunk[] {
  const maxChars = options.maxChars ?? 1_200;
  const overlap = options.overlapChars ?? 150;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitLong(paragraph, maxChars));

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 1 > maxChars) {
      chunks.push(current);
      const tail = current.slice(-overlap);
      current = tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) : "";
    }
    current = current ? `${current}\n${paragraph}` : paragraph;
  }
  if (current) chunks.push(current);

  const prefix = options.title ? `${options.title}\n` : "";
  return chunks.map((content, ordinal) => ({
    ordinal,
    content: `${prefix}${content}`,
    tokenEstimate: estimateTokens(prefix + content),
  }));
}
