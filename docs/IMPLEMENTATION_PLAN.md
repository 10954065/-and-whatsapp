# SUNLEON AI — Implementation Plan

Phases follow the master build prompt. Each phase ends with type-check, lint, tests and
(where practical) a production build, then a commit pushed to `main`.

| Phase | Scope | Key deliverables |
| --- | --- | --- |
| 0 | Repository audit | PROJECT_AUDIT, ARCHITECTURE, IMPLEMENTATION_PLAN, INFRASTRUCTURE_COSTS, BUILD_PROGRESS |
| 1 | Core foundations | Env validation, full Prisma schema + migrations (pgvector, btree_gist, RLS), Prisma client, logging, error handling, rate limiting, encryption, auth (register/login/logout/verify/reset/sessions/MFA), tenancy + RBAC, audit log, UI foundation (design tokens, shadcn primitives, app shell), marketing site |
| 2 | Business onboarding | Workspace creation, 14-step resumable onboarding, business profile & settings, team invitations, industry template selection |
| 3 | AI engine | Anthropic client, model router, prompt versioning, context builder, tool registry, policy engine, usage ledger, budgets, test console |
| 4 | Knowledge base | FAQ/text/document sources, secure upload, extraction, chunking, Voyage embeddings, hybrid retrieval, versioning, status |
| 5 | Meta integrations | Webhook verification, event persistence, Job queue, WhatsApp Cloud API (connect, send, receive, templates, receipts, opt-out), Instagram Login OAuth + messaging, token monitoring, health |
| 6 | Unified inbox | Conversation list/filters/search, timeline, composer, takeover/return, assignment, notes, tags, customer panel, polling-based live updates |
| 7 | Business operations | Customers, leads, follow-ups, products/variants/categories, inventory movements, orders with transactional stock, services, staff schedules, bookings with exclusion constraint |
| 8 | Automation studio | Workflow builder (trigger → conditions → actions), versions, runs, retries, loop prevention, consent checks |
| 9 | Industry templates | 11 templates: knowledge fields, persona, FAQs, workflows, tools, escalation rules, onboarding guidance |
| 10 | Analytics & billing | Real metrics from persisted data, AI cost dashboard, plans, Paystack checkout/verify/webhooks, plan enforcement, billing history |
| 11 | Super-admin | Platform dashboard, businesses, subscriptions, plans, usage, integrations, monitoring (jobs, webhooks, errors), audit logs, support, announcements, settings |
| 12 | Production hardening | Security tests, E2E lifecycle, performance review, backups, deployment docs, operations runbook, final report |

## Definition of done per feature

A feature is only reported as **COMPLETED AND VERIFIED** when automated tests exercise it
against a real PostgreSQL database (integration) or a running app (E2E). Integrations
that need third-party credentials are reported as **IMPLEMENTED BUT NOT LIVE VERIFIED**
or **BLOCKED BY EXTERNAL CREDENTIALS OR APPROVAL**.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Meta app review / Business verification delays | Sandbox channel for development and tests; integration code verified against recorded webhook fixtures; clear in-app status. |
| Free-tier exhaustion (Neon CU-hours, QStash 1K/day, Resend 100/day) | Usage counters, admin infrastructure report, cost-aware defaults (inline dispatch, scale-to-zero friendly polling intervals). |
| Serverless time limits | All heavy work in bounded jobs; per-batch time budget; long tasks split into steps. |
| AI cost spikes | Per-business daily and monthly budgets enforced before each call; cheapest tier by default; platform-wide kill switch. |
| Prompt injection via customer messages or documents | Retrieved content and customer text are delimited as untrusted data; tools are tenant-bound, permission-checked and Zod-validated; high-impact tools require approval. |
