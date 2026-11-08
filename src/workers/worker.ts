import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import { processDueJobs } from "@/lib/queue";
import { logger } from "@/lib/monitoring/logger";
import "@/workers/handlers";

/**
 * Optional long-running worker for higher volumes (Railway or any container host).
 * Not required at launch: on Vercel, jobs run inline after responses and via the cron
 * sweeper. Run with `npm run worker`. It shares the Job table, so both can run at once.
 */
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000);
const workerId = `worker-${process.pid}`;
let running = true;

process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});

async function main(): Promise<void> {
  logger.info("worker.started", { workerId });
  while (running) {
    try {
      const stats = await processDueJobs({ workerId, limit: 50, timeBudgetMs: 30_000 });
      if (stats.processed === 0) await sleep(POLL_INTERVAL_MS);
    } catch (error) {
      logger.error("worker.loop_error", { error });
      await sleep(POLL_INTERVAL_MS * 5);
    }
  }
  logger.info("worker.stopped", { workerId });
}

void main();
