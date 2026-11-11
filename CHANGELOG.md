# Changelog

## Home in the website menu

* "Home" is the first link in the website header, the phone menu and the footer, so visitors
  on any page can get back to the homepage.
* Tablets (below 1024px) now use the menu sheet: seven links no longer fit beside the sign-in
  buttons there, which pushed "Start free trial" off screen.

## Ready for Google Search

* `robots.txt` lets search engines read the public site, keeps them out of the dashboard, admin
  console, API, onboarding, invitations and one-time email links, and points to the sitemap.
  Preview deployments are never indexed.
* `sitemap.xml` lists every public page, built from the same list that sets each page's title.
* Every public page has a keyword-rich title, a description, a canonical URL and a link
  preview (Open Graph and X card) with a new 1200 x 630 image in the brand's fonts.
* The home page describes Sunleon Router Enterprise to Google (schema.org Organization and
  WebSite): logo, Accra address, Instagram, WhatsApp and email support.
* New icons from the sunrise mark: favicon.ico (16, 32, 48 px), an SVG icon, an Apple touch
  icon, and 192/512 px and maskable icons in a web app manifest.
* Optional `GOOGLE_SITE_VERIFICATION` adds Google's meta tag for URL-prefix verification.

## Emails that look like SUNLEON

* Verification, password reset, invitation and notification emails now use the product's own
  look: warm paper background, a card with the sunrise logo and wordmark, a large serif
  heading and an ink pill button, instead of the old purple template.
* Each email says when its link expires (24 hours, 1 hour, 7 days, matching the code), offers
  a copyable fallback link, and closes with a line on why the reader received it.
  Notification emails link to the alert settings.
* Invitations show the workspace, role and inviter in a small panel.
* Dark mode for mail apps that support it, phone-friendly sizing, an inbox preview line and a
  clean plain-text version. Every name and link is escaped.
* The logo is served from `/email/sunleon-mark.png`, because Gmail does not show SVG.
* Every email footer has a "Need help? Talk to us" block: WhatsApp +233 55 610 5551 (opens a
  chat), admin@sunleonrouterenterprise.com and Instagram @sunleonrouterenterprise, also in the
  plain-text version. The contacts live in `src/config/contact.ts`.

## Account & security, easy to find

* "Account & security" (password, two-factor authentication, account deletion) is now in the
  sidebar under Workspace for every member, not only in the avatar menu.
* The admin console header links to it too, so an admin can set up two-factor authentication
  without leaving the console. On phones the header links show as icons.

## Ready for Supabase and Vercel

* Production database is Supabase (Paris), with Vercel functions pinned to Paris
  (`cdg1`) next to it. Uploads can use Supabase Storage through the existing S3 driver.
* New migration closes Supabase's Data API: the `anon`, `authenticated` and `service_role`
  roles can no longer read or write any table, including tables added later. Verified on a
  database set up with Supabase's roles and default grants: 0 of 62 tables reachable, the
  app's tenant role unchanged.
* `.vercelignore` keeps `.env` and local scratch files out of CLI deployments.
* Deployment guides updated for Supabase.

## WhatsApp fees from Meta, stated up front

* Meta now charges for WhatsApp replies after each number's first 1,000 a month (since October 1,
  2026). The pricing page has a "WhatsApp fees from Meta" section that says so plainly: customer
  messages are free, the first 1,000 replies a month are free, Meta charges each delivered reply after
  that and bills the business's own WhatsApp account, template messages are charged separately, and a
  payment method in Meta Billing Hub keeps replies flowing past the free 1,000.
* Sign-up and the Terms of Service point to that section, and the Integrations page shows the same
  explanation above the WhatsApp form. All of them read from one source, so they can't disagree.
* Connecting a WhatsApp number now requires ticking "I understand that Meta bills my WhatsApp Business
  account…". The acknowledgment is stored in the connection's audit entry.
* The pricing footnote no longer suggests that only template messages carry Meta fees.

## Friendlier replies

* The assistant now adds a sweet, friendly emoji (😊 🙏 ✨ 💛 🎉) on its own in greetings, thanks
  and good news, instead of waiting for the customer to use one first. The tone decides how
  much: Friendly, Warm and Playful use them, Concise at most one, Professional none.
* Emoji stay out of prices, addresses and order or payment details, never pass two in a reply,
  and are left out entirely when a customer is upset or the subject is serious.
* Customer agent prompt version 3. Runs record the version, so replies before and after the
  change can be told apart.
* Instagram replies are now trimmed by bytes, where an emoji counts four, so long replies stay
  under Meta's 1000-byte limit; trimming never cuts an emoji in half on any channel.

## Dashboard redesign

* One colour system across the workspace: ink for text and actions, the sun accent only for
  progress, data and unread counts, and status colours only beside a label (Paid, Unpaid,
  You're replying). Stat card icons are neutral on the dashboard, Analytics, Assistant and
  Admin; the only coloured card left is Admin's failed-jobs warning.
* The dashboard's key numbers are one card split by hairlines, the setup reminder is a regular
  card with a progress ring and an ink button (it no longer disappears in dark mode), and the
  panels sit in rows of equal height with matching empty states.
* The conversations chart names every day of the week, marks today, shows the weekly total and
  fills its card. In dark mode the chart uses a darker step of the sun so bars stay clear of
  the background.
* WhatsApp and Instagram dots come from shared colour tokens instead of copied hex values.
* Fixed: the Analytics "Order value per day" axis counted pesewas, so GH₵450 read as 50K.

## Any AI provider

* The assistant is no longer tied to Anthropic. Set `AI_PROVIDER=openai-compatible` with an
  `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` to use OpenAI, Google Gemini, OpenRouter, Groq,
  DeepSeek, Mistral, a self-hosted Ollama model or any other provider that speaks the OpenAI
  Chat Completions format. Anthropic stays the default and keeps prompt caching, effort and
  the server-side safety fallback.
* `AI_MODEL_PRICES` gives non-Claude models real cost estimates, so spend limits stay accurate.
* `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL_*` still work for Anthropic; `AI_API_KEY` and
  `AI_MODEL_*` are the documented names and take precedence.
* A reply now counts against the plan allowance whenever the model answered, even when a
  provider reports no token usage.

## Design refresh

* New visual identity: warm paper, deep ink and a single sun accent, with a matching dark
  theme. Inter (optical sizes) for the interface, Instrument Serif for display type, and a
  sunrise logo mark.
* Removed the generic template look: gradients, glowing blobs, grid backgrounds, gradient
  text, sparkle and robot icons, uppercase eyebrow labels and emoji in product copy.
* No em or en dashes in interface copy. The customer agent prompt (version 2) asks replies
  to avoid them and to use emoji only when the customer does.
* "AI employee" is now "assistant" throughout the product.
* Home page:
  * an iPhone showcase that plays a WhatsApp order and an Instagram booking, with typing
    indicators, read receipts and notification cards for the work done behind the scenes;
  * a scroll-driven receipt that follows one order to verified payment;
  * a live hand-over conversation in the "you stay in charge" section.
  Animations pause off screen and on hover, and show static content when reduced motion is
  on. Every conversation is labelled as an example.
* Sign-in, sign-up, onboarding and every marketing page follow the editorial style.
* Workspace:
  * iOS-style sidebar, translucent top bar, large titles and widget-style figures;
  * a dashboard built from stored data (local-time greeting, setup ring, latest
    conversations, this week's chart, upcoming bookings, recent orders);
  * the inbox rebuilt as a messaging app that opens at the newest message and animates new
    arrivals.
* Destructive actions use red buttons. The admin console has its own dark header and tabs.

## Phase 12 — Production hardening

* QStash dispatcher for job wake-ups and retries, with a signature-verified delivery route.
  The cron sweeper remains the safety net.
* `/api/health`: database round-trip, latest migration, overdue jobs, and provider
  configuration (booleans only).
* Data rights:
  * owner export of the whole workspace as JSON;
  * workspace deletion with a 7-day grace period, cancellation and a full purge (including
    stored files);
  * account deletion with personal data removed.
* Daily purge of message content past each business's retention setting.
* "Booking cancelled" automations now run (the trigger is emitted on cancellation).
* An empty `QSTASH_URL` (as in `.env.example`) no longer fails environment validation.
* New tests:
  * MFA;
  * the AI tool executors, CRM and channel connection flows;
  * the Meta, Instagram and Voyage clients;
  * SSRF-safe fetching.
  Line coverage is now 82.8 %.
* Docs: ENVIRONMENT_VARIABLES, VERCEL_DEPLOYMENT, DATABASE_DEPLOYMENT, OPERATIONS_RUNBOOK,
  API_DOCUMENTATION and PRODUCTION_READINESS (final report).

## Phase 11 — Super-admin console

* `/admin` for platform super-admins only (404 for everyone else), and only on a session
  verified with two-factor authentication.
* Overview (businesses, subscriptions, 30-day revenue, AI cost, failures, inquiries); business
  search and detail (plan, usage, members, channels without credentials, payments, activity);
  suspend/restore, manual plan activation and internal support notes, each with a recorded
  reason.
* Plan editor (prices, limits, features, availability) with before/after audit.
* Monitoring of failed jobs (with retry), webhook problems, errors and email failures, with no
  payloads shown.
* Contact inquiries, workspace announcements (shown as banners), the platform-wide AI kill
  switch, provider configuration status, and a filterable audit log.

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
