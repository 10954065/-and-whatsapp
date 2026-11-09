import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { isQStashEnabled, publishJobWakeUp } from "@/lib/queue/qstash";

export interface JobInfo {
  id: string;
  type: string;
  attempts: number;
  maxAttempts: number;
  businessId: string | null;
}

export type JobHandler = (payload: Prisma.JsonValue, job: JobInfo) => Promise<void>;

/** Thrown by handlers for failures that retrying cannot fix (bad input, missing record). */
export class PermanentJobError extends Error {}

const handlers = new Map<string, JobHandler>();
const LOCK_MS = 5 * 60_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60_000;

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

/** Wake-up strategy for new jobs. Replaced by the QStash dispatcher when configured. */
export type JobDispatcher = (job: { id: string; runAt: Date }) => Promise<void> | void;

let customDispatcher: JobDispatcher | null = null;

/** Overrides the wake-up strategy (tests); otherwise QStash when configured, else inline. */
export function setJobDispatcher(next: JobDispatcher | null): void {
  customDispatcher = next;
}

function dispatcher(job: { id: string; runAt: Date }): Promise<void> | void {
  if (customDispatcher) return customDispatcher(job);
  return isQStashEnabled() ? publishJobWakeUp(job) : inlineDispatcher(job);
}

/** Runs the job right after the current response (Next.js `after`). Outside a request it no-ops; the sweeper picks it up. */
function inlineDispatcher(job: { id: string; runAt: Date }): void {
  if (job.runAt.getTime() > Date.now()) return;
  try {
    after(async () => {
      await runJobById(job.id, "inline");
    });
  } catch {
    // Not inside a request scope (tests, scripts, worker): the sweeper will run it.
  }
}

export function backoffMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
}

/**
 * Persists a job and wakes a runner. With an idempotency key the same logical job is only
 * ever stored once, so duplicate webhooks or retries cannot create duplicate work.
 */
export async function enqueueJob(
  type: string,
  payload: Prisma.InputJsonValue,
  options: { businessId?: string | null; runAt?: Date; idempotencyKey?: string; maxAttempts?: number; priority?: number } = {},
): Promise<{ id: string; created: boolean }> {
  if (options.idempotencyKey) {
    const existing = await prisma.job.findUnique({ where: { idempotencyKey: options.idempotencyKey }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };
  }
  try {
    const job = await prisma.job.create({
      data: {
        type,
        payload,
        businessId: options.businessId ?? null,
        runAt: options.runAt ?? new Date(),
        idempotencyKey: options.idempotencyKey ?? null,
        maxAttempts: options.maxAttempts ?? 5,
        priority: options.priority ?? 0,
      },
      select: { id: true, runAt: true },
    });
    await dispatcher(job);
    return { id: job.id, created: true };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002" && options.idempotencyKey) {
      const existing = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: options.idempotencyKey }, select: { id: true } });
      return { id: existing.id, created: false };
    }
    throw error;
  }
}

interface ClaimedJob extends JobInfo {
  payload: Prisma.JsonValue;
}

/** Atomically claims due jobs (and jobs whose lock expired) using SKIP LOCKED. */
export async function claimDueJobs(limit: number, workerId: string, onlyJobId?: string): Promise<ClaimedJob[]> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_MS);
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" SET
      "status" = 'RUNNING',
      "lockedAt" = ${now},
      "lockedBy" = ${workerId},
      "lockExpiresAt" = ${lockUntil},
      "attempts" = "attempts" + 1,
      "updatedAt" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE (("status" = 'PENDING' AND "runAt" <= ${now}) OR ("status" = 'RUNNING' AND "lockExpiresAt" < ${now}))
        AND (${onlyJobId ?? null}::text IS NULL OR "id" = ${onlyJobId ?? null})
      ORDER BY "priority" DESC, "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "payload", "attempts", "maxAttempts", "businessId"`;
  return rows;
}

async function ensureHandlersLoaded(): Promise<void> {
  await import("@/workers/handlers");
}

async function executeClaimed(job: ClaimedJob): Promise<boolean> {
  await ensureHandlersLoaded();
  const handler = handlers.get(job.type);
  try {
    if (!handler) throw new PermanentJobError(`No handler registered for job type "${job.type}"`);
    await handler(job.payload, job);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", completedAt: new Date(), lockedBy: null, lockExpiresAt: null, lastError: null },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isDead = error instanceof PermanentJobError || job.attempts >= job.maxAttempts;
    const retryAt = new Date(Date.now() + backoffMs(job.attempts));
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: isDead ? "DEAD" : "PENDING",
        runAt: isDead ? undefined : retryAt,
        lastError: message.slice(0, 2_000),
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
    if (isDead) {
      await reportError(error, { source: `job.${job.type}`, businessId: job.businessId, jobId: job.id });
    } else {
      logger.warn("job.retry_scheduled", { jobId: job.id, type: job.type, attempt: job.attempts, error: message });
      // QStash wakes the retry at its back-off time; inline mode leaves it to the sweeper.
      await dispatcher({ id: job.id, runAt: retryAt });
    }
    return false;
  }
}

export async function runJobById(jobId: string, workerId: string): Promise<boolean | null> {
  const [job] = await claimDueJobs(1, workerId, jobId);
  if (!job) return null;
  return executeClaimed(job);
}

/** Bounded sweep for cron/worker invocations: stops at the job limit or the time budget. */
export async function processDueJobs(options: { limit?: number; timeBudgetMs?: number; workerId: string }) {
  const limit = options.limit ?? 50;
  const deadline = Date.now() + (options.timeBudgetMs ?? 45_000);
  const stats = { processed: 0, succeeded: 0, failed: 0 };
  while (stats.processed < limit && Date.now() < deadline) {
    const batch = await claimDueJobs(Math.min(10, limit - stats.processed), options.workerId);
    if (batch.length === 0) break;
    for (const job of batch) {
      const ok = await executeClaimed(job);
      stats.processed += 1;
      if (ok) stats.succeeded += 1;
      else stats.failed += 1;
    }
  }
  return stats;
}

/** Admin recovery: puts a dead or failed job back in the queue with fresh attempts. */
export async function retryJob(jobId: string): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null } });
}
