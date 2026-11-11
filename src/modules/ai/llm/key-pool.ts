import { logger } from "@/lib/monitoring/logger";
import { LlmProviderError, type LlmClient } from "@/modules/ai/llm/types";

/** A rate-limited key rests for a minute; a refused one (revoked, mistyped, blocked) for fifteen. */
const RATE_LIMITED_REST_MS = 60_000;
const REFUSED_REST_MS = 15 * 60_000;

export type KeyClientFactory = (key: string, options: { isLastResort: boolean }) => LlmClient;

/**
 * How long to rest a key after this error: 0 to move on without resting it, or null when the
 * request itself is at fault and every other key would fail the same way.
 */
function restAfter(error: unknown): number | null {
  if (!(error instanceof LlmProviderError)) return null;
  if (error.status === 429) return RATE_LIMITED_REST_MS;
  if (error.status === 401 || error.status === 403) return REFUSED_REST_MS;
  if (error.status === null || error.status >= 500) return 0;
  return null;
}

/**
 * Several keys for one provider behind a single client. Each request starts on the next key in
 * turn; a key that is rate-limited or refused rests while the request moves straight on to the
 * next one. Resting keys are tried last, soonest ready first, and the last key in line gets the
 * provider client's full retries, so a single key behaves exactly like a plain client.
 * Keys are only ever logged by their place in the list.
 */
export function createKeyRotatingClient(keys: string[], makeClient: KeyClientFactory, now: () => number = Date.now): LlmClient {
  if (keys.length === 0) throw new Error("createKeyRotatingClient needs at least one key.");
  const clients = new Map<string, LlmClient>();
  const restUntil = keys.map(() => 0);
  let cursor = 0;

  const clientFor = (index: number, isLastResort: boolean): LlmClient => {
    const id = `${index}:${isLastResort}`;
    const existing = clients.get(id);
    if (existing) return existing;
    const client = makeClient(keys[index], { isLastResort });
    clients.set(id, client);
    return client;
  };

  return {
    async create(request) {
      const start = cursor;
      cursor = (cursor + 1) % keys.length;
      const time = now();
      const inTurn = keys.map((_, offset) => (start + offset) % keys.length);
      const ready = inTurn.filter((index) => restUntil[index] <= time);
      const resting = inTurn.filter((index) => restUntil[index] > time).sort((a, b) => restUntil[a] - restUntil[b]);
      const candidates = [...ready, ...resting];

      for (const [position, index] of candidates.entries()) {
        const isLastResort = position === candidates.length - 1;
        try {
          return await clientFor(index, isLastResort).create(request);
        } catch (error) {
          const rest = restAfter(error);
          if (rest === null) throw error;
          if (rest > 0) restUntil[index] = now() + rest;
          if (keys.length > 1) {
            logger.warn("ai.key_failover", { keyPosition: index + 1, keyCount: keys.length, status: (error as LlmProviderError).status, movedOn: !isLastResort });
          }
          if (isLastResort) throw error;
        }
      }
      throw new LlmProviderError("No AI key could be tried.", null);
    },
  };
}
