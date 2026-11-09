# SUNLEON AI — Queue and Worker Guide

## Design

PostgreSQL (`Job` table) is the source of truth for background work. Wake-up signals are
interchangeable; every runner claims jobs the same way, so any combination can run at once.

| Runner | When it runs | Requires |
| --- | --- | --- |
| Inline (`after()`) | Immediately after the request that enqueued the job | Nothing (default) |
| Cron sweeper `GET /api/cron/jobs` | Daily on Vercel Hobby (`vercel.json`), every minute on Pro | `CRON_SECRET` |
| QStash dispatcher | Push wake-up at the job's run time, including retry back-offs | `QUEUE_PROVIDER=qstash`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` (+ `QSTASH_NEXT_SIGNING_KEY`, optional `QSTASH_URL`) |
| Standalone worker `npm run worker` | Continuous polling on any container host (e.g. Railway) | `DATABASE_URL` |

## Guarantees

* **Idempotent enqueue** — `enqueueJob(type, payload, { idempotencyKey })` stores a logical job once.
* **Safe claiming** — `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`; a crashed runner's
  lock expires after 5 minutes and the job becomes claimable again.
* **Retries** — exponential back-off (30 s, 60 s, 120 s … max 1 h) up to `maxAttempts` (default 5).
* **Dead letters** — after the last attempt, or for `PermanentJobError`, the job becomes `DEAD`
  and an `ErrorEvent` is recorded. Recover with `retryJob(id)` (Admin → Monitoring).
* **Bounded execution** — sweeps stop at a job limit and a time budget (45 s on Vercel).

## QStash

With `QUEUE_PROVIDER=qstash` and the keys set, every new job and every retry publishes
`{ "jobId": "…" }` to `POST {APP_URL}/api/queue/qstash`. The publish is delayed with
`Upstash-Not-Before` and deduplicated per job and run time. The route verifies `Upstash-Signature`
before doing anything:
* an HS256 JWT signed with the current key, falling back to the next key;
* issuer `Upstash`;
* subject equal to our URL;
* `exp` and `nbf`;
* the SHA-256 of the raw body.

It then claims the job atomically. A failed publish is only logged, and the cron sweeper runs
anything QStash never delivered. QStash's free tier (1,000 messages/day) suits launch volumes.

## Adding a job type

1. Create `src/modules/<module>/<module>.jobs.ts` and call
   `registerJobHandler("<module>.<action>", async (payload, job) => { … })`.
2. Validate the payload with Zod inside the handler; make the handler idempotent.
3. Import the file from `src/workers/handlers.ts`.
4. Enqueue with an idempotency key derived from the business event.

## Current job types

| Type | Purpose |
| --- | --- |
| `knowledge.process` | Extract, chunk and embed a knowledge source |
| `webhook.meta` | Process a persisted, signature-verified Meta webhook event |
| `ai.reply` | Generate and send the AI reply for a conversation (burst-merged) |
| `automation.event` | Run every ACTIVE workflow for one business event (deduplicated per workflow) |
| `webhook.paystack` | Confirm a signed Paystack `charge.success` through the verify API |
| `notification.email` | Fan out a team notification to its recipients, then send one email per job |

## Operating the cron sweeper manually

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/jobs
```

The response lists processed/succeeded/failed jobs and purged expired sessions/rate-limit buckets.

## Moving to a dedicated worker

1. Deploy the same repository to a container host with `npm ci && npm run worker`
   (`DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, provider keys as on Vercel).
2. Keep the Vercel cron as a safety net. No code changes are required.
