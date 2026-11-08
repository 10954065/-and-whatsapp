import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sha256Hex } from "@/lib/security/crypto";
import { logger, redact } from "@/lib/monitoring/logger";

export interface ErrorContext {
  source: string;
  businessId?: string | null;
  [key: string]: unknown;
}

/**
 * Logs an unexpected error and persists it to ErrorEvent for the admin monitoring page.
 * Never throws — error reporting must not break the request that failed.
 */
export async function reportError(error: unknown, context: ErrorContext): Promise<void> {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const { source, businessId, ...rest } = context;
  logger.error(err.message, { source, businessId, error: err, ...rest });
  try {
    await prisma.errorEvent.create({
      data: {
        source,
        message: err.message.slice(0, 2_000),
        stack: err.stack?.slice(0, 8_000) ?? null,
        context: redact(rest) as Prisma.InputJsonValue,
        businessId: businessId ?? null,
        fingerprint: sha256Hex(`${source}:${err.name}:${err.message}`).slice(0, 32),
      },
    });
  } catch (persistError) {
    logger.warn("error_event.persist_failed", { source, persistError });
  }
}
