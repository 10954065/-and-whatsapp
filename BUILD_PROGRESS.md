# SUNLEON AI — Build Progress

Resume from this file if a session is interrupted. Update it at the end of every phase.

## Status by phase

| Phase | Status | Commit |
| --- | --- | --- |
| 0 — Repository audit | ✅ Complete | phase 0 commit |
| 1 — Core foundations | ✅ Complete (lint, typecheck, 47 Vitest + 3 Playwright tests, build pass) | phase 1 commit |
| 2 — Business onboarding | ✅ Complete (58 Vitest + 3 Playwright pass, build pass) | phase 2 commit |
| 3 — AI engine | ✅ Complete (90 Vitest + 3 Playwright pass, build pass; live model not verified — no API key) | phase 3 commit |
| 4 — Knowledge base | ✅ Complete (132 Vitest + 3 Playwright pass, build pass; Voyage + R2 not live-verified) | phase 4 commit |
| 5 — Meta integrations | ✅ Implemented (144 Vitest + 3 Playwright pass); not live-verified — needs Meta app + App Review | phase 5-6 commit |
| 6 — Unified inbox | ✅ Complete (sandbox pipeline tested end to end; polling refresh) | phase 5-6 commit |
| 7 — Business operations | ⏳ Next | |
| 8 — Automation studio | ⬜ | |
| 9 — Industry templates | ⬜ | |
| 10 — Analytics & billing | ⬜ | |
| 11 — Super-admin | ⬜ | |
| 12 — Production hardening | ⬜ | |

## Local environment

* PostgreSQL (pgvector) runs in Docker: container `sunleon-db`, port **5440**,
  user `sunleon`, database `sunleon` (tests use database `sunleon_test`).
  Start it with `docker start sunleon-db`.
* `.env` is local only (git-ignored). Copy `.env.example` and fill values.

## Rules for every commit

* No `Co-Authored-By` or other AI attribution trailers.
* Never commit `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/` or `.env` files
  (all git-ignored).

## Phase 1 working notes (in progress)

Done so far:
* Full Prisma schema (all phases) + migrations `init`, `integrity_and_rls`
  (CHECKs, booking exclusion constraint, `sunleon_tenant` role, RLS policies),
  `contact_inquiries`. `prisma migrate diff` shows no drift.
* Prisma client is generated to `src/generated/prisma` (import `@/generated/prisma/client`,
  enums from `@/generated/prisma/enums`). `prisma.config.ts` uses DIRECT_URL for the CLI.
* lib: `env.ts` (lazy zod env, `outboundMessagingMode`, `providerStatus`), `db/prisma.ts`,
  `db/tenant.ts` (`withTenantTx` → SET LOCAL ROLE sunleon_tenant + app.business_id),
  `security/{crypto,password,rate-limit,origin}.ts`, `monitoring/{logger,errors,report}.ts`,
  `auth/{session,current,tenant,request}.ts`, `email/{index,templates}.ts`, `http/action.ts`
  (`runAction`, `parseInput`, `safeRedirectPath`).
* `config/permissions.ts` (role → permission matrix).
* modules: `auth/{auth.schemas,auth.service,mfa.service,auth.actions}.ts`,
  `administration/audit.service.ts`.
* UI: shadcn (radix-nova) components in `src/components/ui`, brand tokens in
  `globals.css`, root layout (Geist + Plus Jakarta Sans), `components/brand/logo.tsx`,
  `components/forms/form-controls.tsx`, `hooks/use-action-form.ts`,
  `components/auth/auth-forms.tsx`, `(auth)` pages: login, login/mfa, register,
  forgot-password, reset-password, verify-email.

Tooling notes:
* Run shadcn via `node node_modules/shadcn/dist/index.js add -y -o <names>` — `npx shadcn`
  fails because npm 11 rejects the allow-scripts env npx injects.
* A local "GateGuard" hook asks for facts before the first write to each new file.

Also done in Phase 1: `modules/businesses` (create workspace + switcher), `/onboarding`
(create workspace), app shell (`components/app/app-shell.tsx`, `page-primitives.tsx`),
`/app/dashboard`, `/app/account` (password + MFA), `src/proxy.ts`, marketing site
(`(marketing)` group: home, features, solutions, industries, pricing, about, contact,
privacy, terms), `modules/support/contact.*`, `prisma/seed.ts` (plans), Vitest
(`vitest.config.ts`, tests/unit, tests/integration) and Playwright (`playwright.config.ts`,
tests/e2e). Scripts: `npm run lint | typecheck | test | build | test:e2e | db:seed`.

Notes:
* After any schema change run `npx prisma generate` (Prisma 7 migrate does not generate).
* E2E runs `next start` on port 3100 against the dev DB in `.env`; run `npm run build` first.
* Under `next start` without RESEND_API_KEY, emails fail (logged) by design.

## Phase 2 notes

* Services take a `TenantActor` (`toActor(context, ip)` in `lib/auth/tenant.ts`) so they are
  testable without a request; tenant mutations run in `withTenantTx`.
* Setup steps live in `SETUP_STEPS` (`modules/onboarding/setup.service.ts`); later phases
  append their step (knowledge, channel, ai, test, activate) once the page exists.
  `getSetupSignals` already computes knowledge/channel/agent/test signals.
* `isWithinBusinessHours(hours, timezone, now)` lives in `modules/businesses/settings.service.ts`.

## Phase 3 notes

* `runAgent(input, { llm })` in `modules/ai/orchestrator.ts`; tests inject a fake `LlmClient`.
* Tool modules add tools with `registerTools([...])` from `modules/ai/tools/registry.ts`
  (use `defineTool` from `tools/types.ts`; write tools must honour `context.mode === "test"`).
* Industry templates: `src/config/industry-templates.ts` (all 11). `industryGuidanceFor()`.
* Usage/limits: `modules/billing/usage.ts` (`incrementUsage`, `getAiSpend`, `getPlanLimits`).
* Platform settings: `modules/administration/platform-settings.ts` (`ai.globalEnabled`).

## Next steps

Phase 7 — Business operations:
1. `modules/crm`: customers list/detail page `/app/customers` (search, tags, notes, history,
   assignment), leads page `/app/leads` (pipeline statuses, convert from conversation),
   follow-up tasks list.
2. `modules/commerce`: products/variants/categories CRUD (`/app/products`), inventory with
   `StockMovement` (`/app/inventory`), orders (`/app/orders`) with transactional stock decrement
   (`UPDATE ... SET stockQuantity = stockQuantity - n WHERE stockQuantity >= n` inside
   withTenantTx), order numbers via BusinessCounter atomic increment, payment status separate
   from fulfilment; AI tools get_product_info, check_stock, create_order, get_order_status
   registered via `registerTools` (import the tools module from orchestrator or
   `modules/ai/tools/index.ts`).
3. `modules/bookings`: services/staff/working hours (`/app/services`), availability calculator
   (timezone-aware, buffers, time off, existing bookings), bookings page `/app/bookings`;
   create booking relies on `Booking_no_overlap` exclusion constraint (catch error code 23P01
   → "slot just taken"); AI tools check_availability, create_booking.
4. Add nav items and tests (stock race, double-booking race, availability math, tenant isolation).

Phase 5/6 notes: Meta client/parsers `modules/integrations/meta.ts`; integration service
`modules/integrations/integration.service.ts`; webhook `app/api/webhooks/meta/route.ts` →
job `webhook.meta` → `modules/messaging/inbound.service.ts` → job `ai.reply`
(`modules/messaging/messaging.jobs.ts`) → `outbound.service.ts`. Inbox service
`modules/messaging/inbox.service.ts`; actions `messaging.actions.ts`. QStash dispatcher not
yet implemented (inline + cron only) — add `setJobDispatcher` QStash variant in Phase 12.
`automation.event` jobs are NOT enqueued yet — add in Phase 8 together with the handler.

Older plan (done) — Phase 5 — Meta integrations + messaging core:
1. `modules/integrations/meta/` — `signature.ts` (X-Hub-Signature-256 HMAC-SHA256 of raw body
   with META_APP_SECRET; Instagram uses INSTAGRAM_APP_SECRET), `graph.ts` (fetch wrapper,
   `https://graph.facebook.com/${META_GRAPH_API_VERSION}` and `https://graph.instagram.com/...`),
   `whatsapp.ts` (send text/template, mark read, parse webhook: entry[].changes[].value
   {metadata.phone_number_id, contacts[], messages[], statuses[]}), `instagram.ts` (OAuth at
   instagram.com/oauth/authorize scopes instagram_business_basic,instagram_business_manage_messages;
   token exchange + long-lived token; send POST graph.instagram.com/vXX/me/messages
   {recipient:{id}, message:{text}}; webhook entry[].messaging[]).
2. `app/api/webhooks/meta/route.ts` — GET verify (hub.mode/hub.verify_token/hub.challenge),
   POST: read raw body → verify signature → persist WebhookEvent (dedupeKey = sha256 body or
   message ids) → enqueue `messaging.inbound` job → 200 fast.
3. `modules/messaging` — `inbound.ts` (find Integration by channel+externalAccountId, upsert
   Customer/CustomerIdentity conservatively, find/create open Conversation, insert Message with
   unique (channel, providerMessageId), opt-out keywords STOP/UNSUBSCRIBE → ConsentRecord, then
   enqueue `ai.reply`), `outbound.ts` (sendMessage with idempotencyKey, 24h window check,
   OUTBOUND_MESSAGING_MODE sandbox → SANDBOXED), status updates from webhooks, `ai.reply` job
   calling runAgent with conversation history then sendMessage.
4. Integrations page `/app/integrations`: WhatsApp manual connect (phone number id, WABA id,
   permanent token → encrypted credentialsEnc; verify by GET /{phone-number-id}), Instagram
   OAuth connect, Sandbox channel for testing, health check, disconnect.
5. QStash dispatcher (`setJobDispatcher`) + `/api/queue/qstash` with Receiver verification.

Phase 4 notes: queue in `src/lib/queue` (register handlers in `src/workers/handlers.ts`),
storage `src/lib/storage`, SSRF guard `src/lib/security/ssrf.ts`, knowledge in
`src/modules/knowledge` (hybrid `searchKnowledge`). Docs: QUEUE_AND_WORKER_GUIDE.md.

Older plan (done) — Phase 4 — Knowledge base + job queue foundation:
1. `src/lib/queue/index.ts` (Job table: enqueueJob, registerJobHandler, processDueJobs with
   `FOR UPDATE SKIP LOCKED`, exponential back-off, DEAD after maxAttempts; inline dispatch via
   `after()` from next/server wrapped in try/catch), `src/app/api/cron/jobs/route.ts`
   (Bearer CRON_SECRET), `vercel.json` daily cron, `src/workers/worker.ts`.
2. `src/lib/storage/index.ts` (local dev driver under .data/storage; S3/R2 via aws4fetch).
3. `modules/knowledge`: extraction (unpdf, mammoth, papaparse, txt/md), chunking, Voyage
   embeddings (optional, `vector(1024)`), hybrid retrieval (FTS + cosine), service (FAQ, text,
   upload with extension/MIME/magic-byte/size/plan-storage checks, website import with SSRF
   guard, versioning, delete, reprocess), `knowledge.process` job handler, actions.
4. `/app/knowledge` page + nav + setup step "knowledge" (`signals.knowledgeSources > 0`).
5. `next.config.ts`: `serverActions: { bodySizeLimit: "11mb" }`.
6. Tests: chunking, extraction (txt/csv), upload validation, SSRF guard, queue claim/retry,
   retrieval tenant isolation.

Older Phase 3 plan (done):
Phase 3 — AI engine (`src/modules/ai`): `client.ts` (only Anthropic SDK import; beta
messages with `fallbacks: "default"` for Sonnet/Opus tiers), `router.ts` (fast/standard/
advanced via env models + agent override), `pricing.ts` (Haiku 5.5 $0.10/$0.50, Sonnet 5.5
$2/$10, Opus 5.5 $4/$20 per MTok; cache read 10%), `prompts.ts` (versioned system prompt,
stored in PromptVersion), `context.ts`, `policy.ts` (pre/post checks), `tools/registry.ts`
(Zod tools, permissions, approval), `orchestrator.ts` (manual loop, max iterations, AiRun/
AiAction/AiUsageRecord, budgets), `agent.service.ts` + `/app/ai-agents` page (config +
test console + emergency stop). Do not send temperature; use output_config.effort; no forced
tool_choice; handle stop_reason "refusal" → escalate.
