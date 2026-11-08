/** Stored in Business.knowledgeProfile; labels are kept so the AI context never needs the template. */
export type KnowledgeProfile = Record<string, { label: string; value: string }>;

/** Reads the stored JSON defensively: anything that isn't a {label, value} string pair is ignored. */
export function parseKnowledgeProfile(value: unknown): KnowledgeProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const profile: KnowledgeProfile = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const { label, value: text } = entry as { label?: unknown; value?: unknown };
    if (typeof label === "string" && typeof text === "string" && text.trim()) profile[key] = { label, value: text };
  }
  return profile;
}
