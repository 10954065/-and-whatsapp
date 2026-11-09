import { createHash, createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/monitoring/logger";
import { safeEqual } from "@/lib/security/crypto";

const DEFAULT_QSTASH_URL = "https://qstash.upstash.io";
const PUBLISH_TIMEOUT_MS = 5_000;
export const QSTASH_JOB_PATH = "/api/queue/qstash";

export function isQStashEnabled(): boolean {
  const current = env();
  return current.QUEUE_PROVIDER === "qstash" && Boolean(current.QSTASH_TOKEN && current.QSTASH_CURRENT_SIGNING_KEY);
}

export function qstashDestination(): string {
  return `${env().APP_URL}${QSTASH_JOB_PATH}`;
}

/**
 * Asks QStash to call us back for one job (at its run time). A failed publish is only logged:
 * the job is already stored, and the cron sweeper runs anything QStash never delivered.
 */
export async function publishJobWakeUp(job: { id: string; runAt: Date }): Promise<void> {
  const current = env();
  const notBefore = Math.ceil(job.runAt.getTime() / 1000);
  const headers: Record<string, string> = {
    authorization: `Bearer ${current.QSTASH_TOKEN}`,
    "content-type": "application/json",
    "upstash-retries": "3",
    // One wake-up per job run time, however many times we publish it.
    "upstash-deduplication-id": `${job.id}-${notBefore}`,
  };
  if (job.runAt.getTime() > Date.now() + 1_000) headers["upstash-not-before"] = String(notBefore);
  try {
    const response = await fetch(`${current.QSTASH_URL ?? DEFAULT_QSTASH_URL}/v2/publish/${qstashDestination()}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId: job.id }),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
    if (!response.ok) logger.warn("qstash.publish_rejected", { jobId: job.id, status: response.status });
  } catch (error) {
    logger.warn("qstash.publish_failed", { jobId: job.id, error });
  }
}

interface SignatureClaims {
  iss?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
  body?: string;
}

function verifyWithKey(token: string, signingKey: string, rawBody: string, url: string, nowSeconds: number): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", signingKey).update(`${header}.${payload}`).digest("base64url");
  if (!safeEqual(expected, signature.replace(/=+$/, ""))) return false;
  let claims: SignatureClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignatureClaims;
  } catch {
    return false;
  }
  if (claims.iss !== "Upstash") return false;
  if (claims.sub?.replace(/\/+$/, "") !== url.replace(/\/+$/, "")) return false;
  if (typeof claims.exp !== "number" || nowSeconds > claims.exp) return false;
  if (typeof claims.nbf === "number" && nowSeconds < claims.nbf) return false;
  const bodyHash = createHash("sha256").update(rawBody).digest("base64url");
  return typeof claims.body === "string" && safeEqual(claims.body.replace(/=+$/, ""), bodyHash);
}

/**
 * Verifies `Upstash-Signature` (an HS256 JWT): issuer, subject = our URL, expiry, not-before
 * and the SHA-256 of the raw body. Tries the current key, then the next (key rotation).
 */
export function verifyQStashSignature(
  token: string | null,
  rawBody: string,
  url: string,
  keys: (string | undefined)[] = [env().QSTASH_CURRENT_SIGNING_KEY, env().QSTASH_NEXT_SIGNING_KEY],
  now: Date = new Date(),
): boolean {
  if (!token) return false;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  return keys.some((key) => Boolean(key) && verifyWithKey(token, key!, rawBody, url, nowSeconds));
}
