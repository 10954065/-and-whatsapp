import { prisma } from "@/lib/db/prisma";
import { sha256Hex } from "@/lib/security/crypto";
import { fail } from "@/lib/monitoring/errors";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export const RATE_LIMITS = {
  loginIp: { name: "login:ip", limit: 30, windowSeconds: 900 },
  loginAccount: { name: "login:account", limit: 10, windowSeconds: 900 },
  register: { name: "register:ip", limit: 10, windowSeconds: 3_600 },
  passwordResetAccount: { name: "reset:account", limit: 3, windowSeconds: 3_600 },
  passwordResetIp: { name: "reset:ip", limit: 10, windowSeconds: 3_600 },
  verificationEmail: { name: "verify:account", limit: 3, windowSeconds: 3_600 },
  mfa: { name: "mfa:session", limit: 10, windowSeconds: 900 },
  invitation: { name: "invite:business", limit: 50, windowSeconds: 86_400 },
  webhookIp: { name: "webhook:ip", limit: 1_200, windowSeconds: 60 },
  aiTestConsole: { name: "ai-test:business", limit: 60, windowSeconds: 3_600 },
  upload: { name: "upload:business", limit: 100, windowSeconds: 3_600 },
} satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window counter stored in PostgreSQL (no Redis required at launch).
 * Identifiers are hashed so emails and IP addresses are not stored in clear text.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const key = `${rule.name}:${sha256Hex(identifier.trim().toLowerCase())}`;

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" = EXCLUDED."windowStart" THEN "RateLimitBucket"."count" + 1
        ELSE 1
      END,
      "windowStart" = EXCLUDED."windowStart",
      "expiresAt" = EXCLUDED."expiresAt"
    RETURNING "count"`;

  const count = Number(rows[0]?.count ?? 1);
  const allowed = count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000),
  };
}

/** Throws a user-safe RATE_LIMITED AppError when the limit is exceeded. */
export async function enforceRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const result = await consumeRateLimit(rule, identifier);
  if (!result.allowed) throw fail.rateLimited(result.retryAfterSeconds);
}

export async function resetRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const key = `${rule.name}:${sha256Hex(identifier.trim().toLowerCase())}`;
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export async function purgeExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
