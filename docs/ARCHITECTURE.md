# SUNLEON AI — Architecture

SUNLEON AI is a multi-tenant, Vercel-first modular monolith. Every module can later be
extracted into its own service because modules only talk to each other through their
exported service functions, never through each other's tables or UI.

```
                  ┌──────────────────────── Vercel (Fluid Compute, Node.js) ────────────────────────┐
 Browser ───────▶ │  Next.js App Router                                                             │
                  │   (marketing) (auth)  /app/*  /admin/*   Server Components + Server Actions       │
 Meta / Paystack ▶│   /api/webhooks/*  ──verify signature──▶ persist WebhookEvent ──▶ enqueue Job      │
 QStash ─────────▶│   /api/queue/*     ──verify signature──▶ run bounded batch of Jobs                │
 Vercel Cron ────▶│   /api/cron/*      ──verify CRON_SECRET─▶ sweep due Jobs / housekeeping           │
                  └───────────────┬───────────────────────────┬──────────────────────────────────────┘
                                  │ Prisma 7 + pg (pooled)     │ provider interfaces
                    ┌─────────────▼─────────────┐   ┌─────────▼────────────────────────────────────┐
                    │ Neon PostgreSQL 17        │   │ AI provider · Voyage · Meta Graph · Paystack  │
                    │ pgvector · btree_gist · RLS│   │ Resend · Cloudflare R2 (S3) · Upstash QStash  │
                    └─────────────▲─────────────┘   └──────────────────────────────────────────────┘
                                  │ same Job table
                    ┌─────────────┴─────────────┐
                    │ src/workers/worker.ts      │  optional long-running worker (Railway or any
                    │ (not required at launch)   │  container host) — polls the same Job table
                    └───────────────────────────┘
```

## 1. Source layout

```
src/
  app/            routes only: (marketing), (auth), app/, admin/, api/
  components/     ui/ (shadcn primitives), shared presentational components
  modules/<name>/ business logic per domain: *.service.ts, *.schemas.ts, *.actions.ts
  lib/            cross-cutting infrastructure: db, auth, security, storage, queue,
                  payments, email, monitoring, env
  workers/        standalone worker entry point
  config/         static configuration (plans, industry templates, permissions)
prisma/           schema.prisma, migrations/, seed.ts
tests/            unit/, integration/, e2e/, security/
docs/             all project documentation
```

Rules enforced by convention and review:

1. React components never contain business logic; they call Server Actions which call
   module services.
2. Only module services and `lib/` touch Prisma.
3. Every tenant-scoped service function takes a `TenantContext` that was produced by
   `requireTenant()` — never a raw business id from the browser.
4. External providers sit behind interfaces in `lib/*` (`EmailProvider`,
   `StorageDriver`, `QueueDispatcher`, `PaymentProvider`, `EmbeddingProvider`) or in
   `modules/integrations/*` (`ChannelProvider`).

## 2. Rendering model

* Next.js 16.4 with `cacheComponents` disabled: pages that read the session are
  dynamically rendered; marketing pages are static.
* Mutations from our own UI use Server Actions (Next.js enforces an Origin check on
  them). Machine-to-machine traffic (webhooks, queue callbacks, cron, OAuth callbacks)
  uses Route Handlers.
* `src/proxy.ts` (Next 16's renamed middleware) only performs an *optimistic* redirect
  for requests without a session cookie and sets security headers. Real authorisation
  happens in the data access layer on every request.

## 3. Data layer

* **Neon PostgreSQL** via **Prisma 7** and `@prisma/adapter-pg`.
  * `DATABASE_URL` — pooled (PgBouncer) connection used at runtime.
  * `DIRECT_URL` — direct connection used by `prisma migrate` (configured in
    `prisma.config.ts`).
* Extensions: `vector` (pgvector, knowledge embeddings), `btree_gist` (booking
  exclusion constraint), `pg_trgm` (fuzzy customer search).
* Money is stored as integer **minor units** (pesewas for GHS) plus an ISO currency.
* All timestamps are stored as UTC `TIMESTAMP(3)` (Prisma's default mapping); business-local
  presentation and booking logic use the business IANA timezone (default `Africa/Accra`).

## 4. Multi-tenancy and authorisation

* `Business` is the tenant. `BusinessMembership(userId, businessId, role)` grants access.
* Roles: `OWNER`, `ADMIN`, `MANAGER`, `STAFF`, `READONLY`, plus the platform-level
  `User.platformRole = SUPER_ADMIN`. Permissions are a typed role → permission matrix
  in `src/config/permissions.ts`; a check is `can(membership.role, "orders.write")`.
  (Custom per-business roles are deliberately deferred — the fixed matrix is auditable
  and testable.)
* `requireTenant(permission)` resolves the session, reads the active-business cookie,
  **re-verifies membership in the database**, checks the permission and returns a
  `TenantContext`. Every tenant service query filters by `ctx.businessId`.
* **Row-level security (defence in depth).** Tenant tables have `FORCE ROW LEVEL
  SECURITY` with a policy that, when the transaction-local setting
  `app.business_id` is present, only exposes rows of that business. Tenant mutations,
  AI tool execution and other high-risk paths run inside `withTenantTx(businessId, fn)`,
  which sets the variable with `set_config(..., true)`. System paths (webhook routing,
  platform admin, jobs) run without the variable. See
  [SECURITY_PLAN.md](./SECURITY_PLAN.md) for the path to default-deny.

## 5. Authentication

Custom, database-backed sessions (the pattern recommended after Lucia's deprecation):

* Session token: 32 random bytes, base64url, sent as an `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie. Only `sha256(token)` is stored.
* Passwords: Argon2id (`@node-rs/argon2`).
* Email verification, password reset and invitations use single-use hashed tokens with
  expiry.
* Optional TOTP MFA (`otpauth`), secrets encrypted with AES-256-GCM, plus hashed
  recovery codes.
* Brute-force protection: per-IP and per-account rate limits plus temporary lockout.

## 6. Background processing

PostgreSQL is the source of truth; providers are only *wake-up signals*:

1. `enqueue(type, payload, { runAt, idempotencyKey })` inserts a `Job` row (unique
   idempotency key) and asks the configured `QueueDispatcher` to wake a runner.
2. Dispatchers:
   * `inline` (default in development): processes the job after the response with
     Next.js `after()`, inside the same bounded function invocation.
   * `qstash`: publishes a signed message to `/api/queue/qstash` (with delay for
     scheduled jobs). QStash retries delivery.
3. `/api/cron/sweep` (Vercel Cron: daily on Hobby, every minute on Pro) and the optional
   standalone worker claim due jobs with `FOR UPDATE SKIP LOCKED`, respect a time budget,
   apply exponential back-off and move exhausted jobs to `DEAD` for manual recovery.

Because each job handler is idempotent and claims are lock-based, at-least-once
delivery from any dispatcher is safe.

## 7. Webhooks

`verify signature (raw body) → persist WebhookEvent (unique dedupe key) → enqueue → 200`.
Processing happens in jobs. Duplicate deliveries hit the unique key and are acknowledged
without re-processing. Supported: Meta (WhatsApp + Instagram, `X-Hub-Signature-256`),
Paystack (`x-paystack-signature`), QStash (`Upstash-Signature`).

## 8. Messaging engine

A `ChannelProvider` interface (`whatsapp`, `instagram`, `sandbox`) normalises inbound
events into `Message` rows and sends outbound messages with an idempotency key.
Conversations track the last inbound timestamp to enforce the 24-hour customer-service
window; outside it WhatsApp requires an approved template and Instagram refuses.
Preview and development deployments default to `OUTBOUND_MESSAGING_MODE=sandbox`, which
records outbound messages without calling Meta.

## 9. AI engine

`modules/ai`:

* `llm/` — provider-neutral `LlmClient` with two adapters, chosen by `AI_PROVIDER`: native
  Anthropic (the only file importing the SDK) and OpenAI-compatible (OpenAI, Gemini,
  OpenRouter, Groq, DeepSeek, Mistral, Ollama).
* `router.ts` — classifies the request into `fast` / `standard` / `advanced` tiers;
  model ids come from env (`AI_MODEL`, `AI_MODEL_*`) with database overrides per agent.
* `context.ts` — builds a cache-friendly prompt: stable system prompt (platform policy +
  business profile + industry template), then conversation history, then retrieved
  knowledge wrapped as *untrusted data*.
* `tools/` — registry of Zod-validated tools; each declares a permission and whether it
  is high-impact (requires approval).
* `policy.ts` — pre-checks (agent enabled, emergency stop, business hours, budget,
  human takeover) and post-checks on the response (no unverified prices/availability
  claims, medical-advice guard, length limits).
* `orchestrator.ts` — manual tool-use loop (bounded iterations), records `AiRun`,
  `AiAction`, token usage and cost.

## 10. Knowledge / RAG

Uploads → validation (size, extension, magic bytes) → object storage → `knowledge.process`
job → text extraction (`unpdf`, `mammoth`, `papaparse`) → chunking → optional Voyage
embeddings (pgvector `vector(1024)`) → retrieval by hybrid scoring (PostgreSQL full-text
`ts_rank` + cosine similarity), always filtered by `businessId`. Without a Voyage key the
system degrades to full-text search only.

## 11. Billing

Plans live in the database (`SubscriptionPlan`, prices in pesewas, limits as JSON). Paystack
checkout is initialised server-side; payment is only trusted after server-side
verification (`/transaction/verify`) or a signature-verified webhook, and every
transaction reference is processed idempotently. Expired subscriptions restrict usage
but never delete data.

## 12. Observability

Structured JSON logs (`lib/monitoring/logger.ts`) with secret redaction, a persisted
`ErrorEvent` table surfaced in the admin monitoring page, queue/webhook health views and
usage counters. A hosted error tracker (e.g. Sentry) can be added behind the same
`reportError` function later.
