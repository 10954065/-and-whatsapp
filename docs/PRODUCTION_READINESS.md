# Production readiness — final report

Status as of 2026-11-09, commit history on `main`. Each item has one of four statuses:

* **COMPLETED AND VERIFIED** — built and proven by automated tests. Unit and integration tests
  run against a real PostgreSQL 17 + pgvector database. End-to-end tests run against the
  production build (`next start`).
* **IMPLEMENTED BUT NOT LIVE VERIFIED** — built and tested against a scripted version of the
  provider's API. It still needs one run with real credentials.
* **BLOCKED BY EXTERNAL CREDENTIALS OR APPROVAL** — cannot go live until a third party grants
  access or approval.
* **NOT COMPLETED** — not built, or only partly built (each item says which).

## Verification summary

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | ✅ no errors |
| ESLint (`--max-warnings=0`) | ✅ clean |
| Production build (`next build`) | ✅ |
| Vitest unit + integration | ✅ 29 files, 237 tests |
| Playwright E2E (Chromium) | ✅ 4 files, 10 tests |
| Coverage (`src/lib`, `src/modules`, `src/config`) | Lines 82.8 %, statements 79.0 %, functions 77.3 %, branches 65.9 % |
| Security review of payment code | Done; every critical/high finding fixed and covered by tests |

Coverage note: request-scoped helpers (`lib/auth/current.ts`, `lib/auth/tenant.ts`, the cookie
paths in `lib/auth/session.ts`) are exercised by the E2E suite, but E2E runs are not counted.

## COMPLETED AND VERIFIED

| Area | What is proven |
| --- | --- |
| Multi-tenancy | PostgreSQL row-level security through the `sunleon_tenant` role. Cross-tenant reads and writes are blocked, and credential tables are unreachable from tenant transactions. Isolation is re-checked in analytics, templates, notifications and billing tests. |
| Accounts & security | Registration, single-use email verification, Argon2id passwords, lockout, rate limits, password reset (revokes sessions), DB sessions, TOTP MFA with encrypted secrets and single-use recovery codes, account deletion with anonymisation. |
| Workspaces & team | Workspace creation with trial, roles and permission matrix, invitations with role ceilings, plan seat limits, guided setup, 11 industry templates (answers become AI facts; starter workflows added once, as drafts). |
| AI engine (logic) | Cost-aware tier routing, versioned prompts, untrusted-data delimiting, tool registry with permissions and approvals, a bounded tool loop, and budget, plan and kill-switch preflight. Post-checks for invented prices, unverified payment claims and medical advice; escalation. Tested with a scripted model. |
| AI tools | Product lookup, stock, order creation (unpaid, idempotent), order status, availability, bookings, business info, leads, follow-ups. Writes are simulated in test mode. |
| Knowledge base | FAQs, text, validated uploads (local storage driver), SSRF-safe website import (every redirect re-validated), chunking, full-text retrieval with rank fusion. |
| Background jobs | PostgreSQL queue: idempotent enqueue, SKIP LOCKED claiming, back-off, dead letters, admin retry, cron sweeper. |
| Messaging (sandbox channel) | Inbound pipeline, conservative identity matching, opt-out/opt-in consent, the 24-hour window, AI reply job, unified inbox (takeover, assignment, notes, tags). |
| Operations | CRM; products and inventory ledger; orders with atomic stock under concurrency; bookings protected by a database exclusion constraint under concurrency; staff-recorded order payments. |
| Automation studio | Builder, versioning, activate/pause. Triggers wired: new WhatsApp/Instagram message, new customer, new lead, new order, payment confirmed, booking created, booking cancelled. One run per workflow per event, and loop protection. |
| Notifications | Notification centre, bell, preference toggles, low-stock alerts on threshold crossing, per-recipient email jobs. |
| Analytics | Real figures by local day, honest empty states, accessible charts with table views. |
| Billing logic | Prepaid periods, unused-time credit on plan switches, trial → grace → expiry lifecycle with reminders, lapsed-plan limits, reconciliation of pending checkouts. |
| Super-admin console | 404 for non-admins; MFA-verified sessions only; business administration, plans, monitoring, inquiries, announcements, AI kill switch, audit log. |
| Data rights | Owner export (no credentials), workspace deletion with 7-day grace, cancel and full purge, message retention purge. |
| Operations endpoints | `/api/health`; QStash delivery route signature checks (forged calls rejected; signed calls run a job once). |

## IMPLEMENTED BUT NOT LIVE VERIFIED

| Item | Needed to verify |
| --- | --- |
| Anthropic Claude live replies (Haiku/Sonnet/Opus 5.5 tiers, server-side fallback beta) | `ANTHROPIC_API_KEY`; run the test console, then a sandbox conversation |
| Voyage embeddings + semantic retrieval | `VOYAGE_API_KEY`; reprocess one knowledge source |
| Paystack subscription checkout, verification, webhooks, reconciliation | Test-mode secret key, then `PAYSTACK_BILLING_GUIDE.md` go-live checklist |
| Resend email (verification, reset, invitations, notifications) | `RESEND_API_KEY` and a verified sending domain |
| Cloudflare R2 / S3 storage driver | Bucket and token; upload and delete one document |
| QStash dispatcher | `QUEUE_PROVIDER=qstash` and QStash keys; enqueue a job and watch delivery |
| Meta Graph clients (WhatsApp text, templates, read receipts; Instagram Login, profile, send) | Tested against a scripted Graph API; live use is blocked (next section) |
| Vercel deployment and Vercel Cron | Not deployed from this environment (Vercel CLI not installed; Vercel connector not authorised). Follow `VERCEL_DEPLOYMENT.md` |
| Neon production database | Migrations verified on local PostgreSQL 17 + pgvector; run `DATABASE_DEPLOYMENT.md` on Neon |

## BLOCKED BY EXTERNAL CREDENTIALS OR APPROVAL

| Item | Blocker |
| --- | --- |
| Live WhatsApp messaging | Meta developer app and Meta Business verification; WhatsApp Business Account with a registered phone number; a permanent system-user token; webhooks on a public HTTPS domain |
| Instagram messaging beyond app testers | Meta App Review for Advanced Access to `instagram_business_manage_messages` |
| Paystack live mode | Paystack Ghana business activation (compliance review) |
| Production email sending | Resend domain verification (DNS records on the production domain) |
| Production domain | DNS for `APP_URL`, needed by Meta callbacks, Instagram OAuth and the Paystack callback |

## NOT COMPLETED

| Item | State |
| --- | --- |
| WhatsApp Embedded Signup | Not built. Businesses connect with phone number ID, WABA ID and a system-user token, which is verified against Graph. Embedded Signup also needs Meta Tech Provider onboarding. |
| WhatsApp template picker | Sending templates is supported in the outbound service and Graph client. There is no UI to sync or choose templates for messages outside the 24-hour window. |
| Collecting customer order payments online | Not built. It would need Paystack subaccounts or split payments, so money goes to each business. Staff record payments manually. |
| Automatic subscription renewal | Not built by design (prepaid periods suit mobile money); renewal reminders are sent. |
| Refund and dispute automation | Webhooks are flagged for manual review only. |
| `aiConversationsPerMonth` plan limit | Stored on plans; not enforced (AI replies, automations, channels, seats and storage are enforced). |
| Per-user notification read state | Read state is shared by the team. |
| Public third-party REST API | Not built (`API_DOCUMENTATION.md` lists the provider and operator endpoints that do exist). |
| Coverage targets | Lines exceed 80 %; statements (79.0 %), functions and branches are below 80 %. |
| Load testing, external penetration test, formal accessibility audit, cross-browser E2E | Not done (E2E runs on Chromium only). |
| Operational table pruning | Manual SQL in `OPERATIONS_RUNBOOK.md`; no automated job. |
| Known minor limitations | Concurrent invitations can briefly exceed the seat limit (bounded by the invitation rate limit). Repeated month-end renewals drift the billing anchor day (31 Jan → 28 Feb → 28 Mar). |

## Recommended go-live order

1. Neon production database: migrate, seed, verify RLS (`DATABASE_DEPLOYMENT.md`).
2. Vercel **Pro** project with production variables; deploy; `/api/health` ok
   (`VERCEL_DEPLOYMENT.md`).
3. First super-admin with MFA; check provider status in Admin → Settings.
4. Resend domain verification. Then Anthropic: run the test console and keep AI off for
   customers until reviewed.
5. Paystack test mode end to end, then live keys after activation.
6. Meta app: webhooks, a WhatsApp number on one pilot business, then App Review for Instagram.
7. Pilot with one Ghanaian business before opening registrations.
