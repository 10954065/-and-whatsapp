import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { providerStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** The endpoint is public, so a flood of requests must not turn into a flood of database queries. */
const REUSE_MS = 10_000;

interface HealthReport {
  status: number;
  body: Record<string, unknown>;
  checkedAt: number;
}

let lastReport: HealthReport | null = null;

async function checkHealth(): Promise<HealthReport> {
  const started = Date.now();
  try {
    const [migration] = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT "migration_name", "finished_at" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL ORDER BY "started_at" DESC LIMIT 1`;
    const overdueJobs = await prisma.job.count({ where: { status: "PENDING", runAt: { lt: new Date(Date.now() - 15 * 60_000) } } });
    const body = {
      status: "ok",
      time: new Date().toISOString(),
      database: { ok: true, latencyMs: Date.now() - started, latestMigration: migration?.migration_name ?? null, migrationFinished: Boolean(migration?.finished_at) },
      queue: { overdueJobs },
      providers: providerStatus(),
    };
    return { status: 200, body, checkedAt: Date.now() };
  } catch {
    return { status: 503, body: { status: "error", time: new Date().toISOString(), database: { ok: false } }, checkedAt: Date.now() };
  }
}

/**
 * Liveness and readiness for uptime monitors: database round-trip, latest applied migration and
 * which providers are configured (booleans only — never values). 503 when the database is down.
 * Each server instance reuses its last answer for up to ten seconds.
 */
export async function GET() {
  if (!lastReport || Date.now() - lastReport.checkedAt > REUSE_MS) lastReport = await checkHealth();
  return NextResponse.json(lastReport.body, { status: lastReport.status, headers: { "cache-control": "no-store" } });
}
