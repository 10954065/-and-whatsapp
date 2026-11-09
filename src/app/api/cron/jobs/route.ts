import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { processDueJobs } from "@/lib/queue";
import { purgeExpiredRateLimits } from "@/lib/security/rate-limit";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { runBillingLifecycle } from "@/modules/billing/billing.service";
import { processScheduledDeletions, purgeExpiredMessages } from "@/modules/privacy/privacy.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sweeper invoked by Vercel Cron (daily on Hobby, every minute on Pro) and by operators. */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const billing = await runBillingLifecycle();
  const [workspacesDeleted, expiredMessages] = [await processScheduledDeletions(), await purgeExpiredMessages()];
  const jobs = await processDueJobs({ workerId: "cron", timeBudgetMs: 35_000, limit: 100 });
  const [rateLimitBuckets, sessions] = await Promise.all([purgeExpiredRateLimits(), purgeExpiredSessions()]);
  return NextResponse.json({ jobs, billing, purged: { rateLimitBuckets, sessions, workspacesDeleted, expiredMessages } });
}
