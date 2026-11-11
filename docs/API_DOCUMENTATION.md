# HTTP API reference

SUNLEON AI has **no public REST API for third parties** yet. The web app talks to the server
through Next.js Server Actions, which are internal and not a stable interface. The HTTP
endpoints below exist for providers (webhooks, OAuth, payments, queue), for operators
(cron, health) and for owner data export. All live under `src/app/api`.

| Method & path | Caller | Authentication |
| --- | --- | --- |
| `GET /api/health` | Uptime monitors | None (returns no secrets) |
| `GET /api/cron/jobs` | Vercel Cron, operators | `Authorization: Bearer $CRON_SECRET` |
| `GET /api/webhooks/meta` | Meta (verification handshake) | `hub.verify_token` = `META_WEBHOOK_VERIFY_TOKEN` |
| `POST /api/webhooks/meta` | Meta (WhatsApp + Instagram events) | `X-Hub-Signature-256` (HMAC-SHA256, app secret) |
| `GET /api/integrations/instagram/callback` | Instagram Unified Login redirect | Signed-in session + single-use hashed OAuth `state` |
| `POST /api/webhooks/paystack` | Paystack | `x-paystack-signature` (HMAC-SHA512, secret key) |
| `GET /api/billing/paystack/callback` | Owner's browser after checkout | None needed — triggers server-side verification only |
| `POST /api/queue/qstash` | Upstash QStash | `Upstash-Signature` (HS256 JWT, current/next signing key) |
| `GET /api/export/business` | Workspace owner | Session cookie, owner role, rate limited |

## `GET /api/health`

`200` when the database answers:

```json
{
  "status": "ok",
  "time": "2026-11-09T07:00:00.000Z",
  "database": { "ok": true, "latencyMs": 12, "latestMigration": "20261108204940_contact_inquiries", "migrationFinished": true },
  "queue": { "overdueJobs": 0 },
  "providers": { "ai": true, "voyage": false, "meta": true, "whatsappEmbeddedSignup": false, "instagram": true, "paystack": true, "resend": true, "objectStorage": true, "qstash": false }
}
```

`503` with `{ "status": "error", "database": { "ok": false } }` when the database is unreachable.
`overdueJobs` counts jobs due for more than 15 minutes that have not run yet.

## `GET /api/cron/jobs`

Runs, in order:
1. the billing lifecycle (reconcile pending payments, trial end, grace, expiry, reminders);
2. scheduled workspace deletions;
3. the message-retention purge;
4. a job sweep (100 jobs or 35 s);
5. expired session and rate-limit purges.

Response:

```json
{
  "jobs": { "processed": 3, "succeeded": 3, "failed": 0 },
  "billing": { "reconciled": 0, "abandoned": 0, "trialsEnded": 1, "enteredGrace": 0, "expired": 0, "reminders": 2 },
  "purged": { "rateLimitBuckets": 14, "sessions": 2, "workspacesDeleted": 0, "expiredMessages": 120 }
}
```

`401` without the correct bearer secret (or when `CRON_SECRET` is unset).

## Meta webhooks

* **`GET`**: returns `hub.challenge` when `hub.mode=subscribe` and the verify token matches;
  otherwise `403`.
* **`POST`**, in order:
  1. Rate limited per IP (`429`).
  2. The signature is verified on the raw body (`401`).
  3. The payload is stored once in `WebhookEvent`. The dedupe key is derived from the message
     and status ids, so redeliveries return `{"received": true, "duplicate": true}`.
  4. The `webhook.meta` job is enqueued, and the route answers `200 {"received": true}`
     immediately.
  5. Unknown accounts are ignored.

## Instagram OAuth callback

Query: `code`, `state` (or `error`). The route needs a signed-in session, and `state` must
match the single-use, expiring value issued to that user. It always redirects to
`/app/integrations?instagram=connected|cancelled|failed`.

## Paystack webhook

* Bodies over 256 KB are rejected (`413`). The signature is checked before any database work
  (`401`).
* Events are stored once (dedupe key `paystack:<event>:<reference or id>`), then
  `webhook.paystack` is enqueued and the route returns `200`.
* A redelivered event that has not finished processing is enqueued again.
* **`charge.success`** is confirmed through Paystack's verify API. The amount, currency and
  reference must match the stored checkout before the plan is activated.
* **`refund.*` and `charge.dispute.*`** are flagged for manual review. All other events are
  ignored.

## Paystack callback

Query: `reference` (or `trxref`), matching `^[A-Za-z0-9.=-]{1,100}$`. Rate limited per IP. The
route verifies the payment server-side and responds `303` to
`/app/billing?payment=success|pending|failed|unknown`. The billing page shows "confirmed" only
when the latest payment really succeeded.

## QStash delivery

Body: `{"jobId": "…"}`. The signature must have:
* issuer `Upstash`;
* subject `{APP_URL}/api/queue/qstash`;
* valid `exp` and `nbf`;
* a body claim equal to the base64url SHA-256 of the raw body.

Responses:
* `401` for a bad signature, `400` for a bad body.
* Otherwise `200 {"ran": boolean, "succeeded": boolean}`. `ran` is false when the job was
  already taken or finished, so duplicate deliveries are harmless.

## Workspace export

The workspace owner (session cookie) gets `200` with `content-disposition: attachment` and a
JSON document in format `sunleon-ai-export/1`. It contains the business, settings,
subscription, members, customers (with identities and notes), conversations with messages,
leads, tasks, products, orders, services, staff, bookings, knowledge, workflows and payments.

Channel credentials, password hashes, MFA data and AI telemetry are never included. Errors:
* `401`/`403` — not signed in, or not the owner.
* `429` — more than 5 exports per hour.
