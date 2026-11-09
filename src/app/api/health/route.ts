import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { providerStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness for uptime monitors: database round-trip, latest applied migration and
 * which providers are configured (booleans only — never values). 503 when the database is down.
 */
export async function GET() {
  const started = Date.now();
  try {
    const [migration] = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT "migration_name", "finished_at" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL ORDER BY "started_at" DESC LIMIT 1`;
    const overdueJobs = await prisma.job.count({ where: { status: "PENDING", runAt: { lt: new Date(Date.now() - 15 * 60_000) } } });
    return NextResponse.json(
      {
        status: "ok",
        time: new Date().toISOString(),
        database: { ok: true, latencyMs: Date.now() - started, latestMigration: migration?.migration_name ?? null, migrationFinished: Boolean(migration?.finished_at) },
        queue: { overdueJobs },
        providers: providerStatus(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ status: "error", time: new Date().toISOString(), database: { ok: false } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
