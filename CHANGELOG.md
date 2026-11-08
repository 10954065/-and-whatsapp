# Changelog

## Phase 10 — Analytics and billing

* Analytics: conversations, AI replies, escalation rate and estimated AI cost, orders and
  order value (paid vs unpaid), top products, bookings and leads for 7/30/90 days, grouped by
  the business's local days, with accessible daily charts and table views. All figures come
  from stored data.
* Paystack subscription billing: hosted checkout (card and mobile money), server-side
  verification with amount and currency checks, signed and deduplicated webhooks,
  exactly-once application, prepaid monthly/yearly periods, payment history.
* Lifecycle: trial end, 3-day grace period, expiry with data kept, renewal reminders and
  notices; lapsed-plan banner. Team seats are now enforced per plan.
* Orders: staff record customer payments (Mark paid), triggering payment-confirmed automations.
* Security review fixes: webhook re-enqueue on redelivery, retry and daily reconciliation of
  pending payments, per-business payment serialisation, unused-time credit on plan switches,
  refund/dispute review flags, separate rate limits for checkout and callback, no provider
  error text in the UI.
* Test tooling: E2E global setup resets rate-limit buckets (local databases only).

## Phase 9 — Industry templates and team notifications

* Industry template panel (Settings → Industry template, linked from the setup guide): starter
  answers that become trusted facts for the AI, starter workflows added once as drafts, and an
  optional reset of the AI employee's tone, role and tools to the industry defaults.
* Five starter workflow templates built only from real triggers and actions.
* Team notifications: notification centre and top-bar bell; alerts for escalations, new orders,
  bookings, low stock (once per threshold crossing) and automation steps, honouring the
  notification settings; emails to the notification address or verified owners and admins.

## Phase 8 — Automation studio

* Workflow engine: triggers (WhatsApp/Instagram message, new customer, new lead, new order,
  booking created), conditions (channel, customer tag, message text, lead status, order
  total, opening hours) and actions (send message within consent and the 24-hour window,
  tag customer, notify team, follow-up task, create lead, assign conversation).
* Background execution through the job queue with per-event idempotency, one run per
  workflow per event, loop protection after 3 chained levels, plan execution limits and
  usage metering; every run records its steps.
* `/app/automation`: builder, versioned definitions, activate/pause, recent runs.

## Phase 7 — Business operations

* Products, inventory ledger, orders (catalogue pricing, atomic stock, sequential numbers,
  discounts with AI caps, fulfilment transitions with restock), services, staff and hours,
  timezone-aware availability and bookings protected by a database exclusion constraint.
* CRM: customers (search, tags, notes, no automatic merging), leads pipeline, follow-ups.
* AI tools for products, stock, orders, order status, availability and bookings.
* Pages: customers, leads, orders, products, inventory, bookings, services & staff.

## Phases 5–6 — Meta integrations and unified inbox

* Official WhatsApp Cloud API and Instagram API with Instagram Login clients; signature-verified,
  deduplicated, persisted webhooks processed in background jobs.
* WhatsApp connection with Graph-verified, encrypted system-user tokens; Instagram OAuth with
  hashed single-use state and long-lived tokens; health checks; sandbox test channel.
* Messaging engine: conservative customer identity matching, opt-out/opt-in keywords with consent
  records, 24-hour service-window enforcement, idempotent sends, delivery receipts, preview sandboxing.
* AI reply job (burst-merging), unified inbox with filters, search, takeover/return, assignment,
  status, tags, internal notes, customer panel, AI activity and polling refresh.

## Phase 4 — Knowledge base and background jobs

* PostgreSQL-backed job queue: idempotent enqueue, SKIP LOCKED claiming, exponential
  back-off, dead letters, inline dispatch after responses, cron sweeper, standalone worker.
* Object storage abstraction (Cloudflare R2/S3 via SigV4, local driver for development).
* Knowledge base: FAQs, text, PDF/DOCX/TXT/MD/CSV uploads (type, magic-byte, size and plan
  storage checks, duplicate detection), website import with SSRF protection, versioned
  edits, delete and reprocess, processing status and errors.
* Extraction, chunking, optional Voyage embeddings (pgvector) and hybrid retrieval with
  rank fusion; always scoped to one business. The AI engine now uses hybrid retrieval.

## Phase 3 — AI engine

* Central Claude orchestration (`modules/ai`): cost-aware model routing, versioned prompts,
  cache-friendly context with untrusted-data delimiting, bounded tool loop, server-side
  safety fallback on Sonnet/Opus tiers.
* Policy engine: kill switch, emergency stop, activation, human takeover, business hours,
  daily/monthly budgets, daily reply limits, plan allowances; post-reply guards against
  invented prices, unverified payment confirmations and medical advice.
* Tool registry with Zod validation, per-business permissions, approval requests and
  test-mode simulation; tools: knowledge search, business info, escalation, leads, follow-ups.
* Usage ledger (AiRun, AiAction, AiUsageRecord, usage counters) and cost estimates.
* AI employee page with configuration, activation, emergency stop and a test console.
* Industry templates for all 11 industries (guidance, tone, tools, escalation rules).

## Phase 2 — Business onboarding

* Guided setup guide (`/app/setup`) whose progress is derived from real workspace data,
  with skippable optional steps saved to the workspace.
* Business settings (`/app/settings`): profile, opening hours (timezone-aware),
  notifications and message retention; read-only view for members without edit rights.
* Team management (`/app/team`): email invitations (7-day, single-use, hashed tokens),
  role changes and removal with role ceilings, invitation acceptance page that only
  accepts the invited email, registration that returns to the invitation.

## Phase 1 — Core foundations

* Complete PostgreSQL schema for all product areas, with integrity constraints, a booking
  exclusion constraint and row-level security (`sunleon_tenant`).
* Environment validation, structured logging with redaction, error reporting to the
  database, Postgres-backed rate limiting, AES-256-GCM secret encryption.
* Authentication: registration, sign-in, sign-out, email verification, password reset,
  account lockout, TOTP two-factor authentication with recovery codes.
* Multi-tenancy: workspaces, memberships, role-permission matrix, workspace switcher.
* UI foundation: SUNLEON design tokens (light/dark), app shell, dashboard, account & security page.
* Marketing site: home, features, solutions, industries, pricing (database plans), about,
  contact (stored enquiries), privacy, terms.
* Tests: Vitest unit + integration (real PostgreSQL) and Playwright E2E.

## Phase 0 — Repository audit

* Project scaffold, audit, architecture, implementation plan and infrastructure cost model.
