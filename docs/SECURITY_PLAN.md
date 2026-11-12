# SUNLEON AI — Security Plan

Status legend: ✅ implemented and tested · 🟡 implemented, not yet covered by tests · ⏳ planned (phase noted)

## Authentication

| Control | Status | Where |
| --- | --- | --- |
| Argon2id password hashing (m=19 MiB, t=2, p=1) | ✅ | `lib/security/password.ts` |
| Password policy (≥10 chars, letters + number/symbol) | ✅ | `passwordSchema` |
| DB-backed sessions; only HMAC(token) stored; `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix in production | ✅ | `lib/auth/session.ts` |
| Sliding 30-day expiry, server-side revocation | ✅ | `validateSessionToken` |
| Per-IP and per-account login rate limits | ✅ | `lib/security/rate-limit.ts` |
| Password re-checks (change password, turn off two-factor, delete account) share 5 attempts per 15 min per user | ✅ | `RATE_LIMITS.passwordConfirm`, `tests/integration/rate-limits.test.ts` |
| Two-factor setup codes share the sign-in code limit (10 per 15 min per session) | 🟡 | `confirmMfaAction` |
| Lockout for 15 min after 5 consecutive failures | ✅ | `auth.service.authenticate` |
| Timing-equalised responses for unknown accounts | 🟡 | `verifyAgainstDummyHash` |
| Single-use, expiring, hashed email-verification & reset tokens | ✅ | `consumeToken` |
| Password reset revokes all sessions | ✅ | `resetPassword` |
| No account enumeration on password reset | ✅ | `requestPasswordReset` |
| Email confirmation via POST (scanner-safe) | 🟡 | `/verify-email` |
| TOTP MFA with encrypted secret and hashed single-use recovery codes | ✅ | `modules/auth/mfa.service.ts`, `tests/integration/mfa.test.ts` |
| Platform super-admin promotion only after email ownership is proven | 🟡 | `verifyEmail` |

## Authorisation and tenant isolation

| Control | Status | Where |
| --- | --- | --- |
| Role → permission matrix (owner, admin, manager, staff, read-only) | ✅ | `config/permissions.ts` |
| Membership re-verified from the database on every request; browser-supplied business ids never trusted | 🟡 | `lib/auth/tenant.ts` |
| PostgreSQL RLS (`sunleon_tenant` role, fail-closed policy) | ✅ | migration `integrity_and_rls`, `lib/db/tenant.ts` |
| Cross-tenant read/write/update blocked inside tenant transactions | ✅ | `tests/integration/tenancy.test.ts` |
| Credential tables unreachable from tenant transactions | ✅ | same |
| Super-admin area returns 404 for everyone else | ✅ | `requireSuperAdmin`, `tests/e2e/admin.spec.ts` |
| Admin console requires an MFA-verified session (every page and action) | ✅ | `requireAdminConsole`, `admin.actions.ts` |
| Every admin change audited with actor, IP and reason; integration credentials never selected | ✅ | `admin.service.ts`, `tests/integration/admin.test.ts` |
| Platform-wide AI kill switch | ✅ | `/admin/settings`, policy preflight |

**Path to default-deny:** today only code inside `withTenantTx` runs as `sunleon_tenant`. Once
every tenant service runs through it, the runtime `DATABASE_URL` can use a login role that
*is* `sunleon_tenant`-only, with a separate privileged role for webhooks/jobs/admin.

## Web security

| Control | Status |
| --- | --- |
| CSRF: Server Actions (Next.js Origin check) + `SameSite=Lax` cookies + `isSameOriginRequest` for cookie-authenticated Route Handlers | 🟡 |
| Open-redirect protection (`safeRedirectPath`) | ✅ |
| Security headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | 🟡 |
| XSS: React escaping; email templates HTML-escape all inputs; no `dangerouslySetInnerHTML` | 🟡 |
| Input validation with Zod at every Server Action boundary | ✅ |
| SQL injection: Prisma query builder and tagged-template raw SQL only | 🟡 |
| Contact form honeypot + rate limit | 🟡 |
| Vercel BotID (Basic) on sign-in, sign-up, forgot-password and contact: bots get a refresh message and a `security.bot_blocked` log line; checks run on Vercel only | ✅ `tests/unit/bot-check.test.ts` |
| Every signed-in Server Action capped at 300 per 5 min per user (`requireUserForAction`); page loads and the Inbox refresh don't count | ✅ |
| Connect with Instagram limited to 20 attempts per hour per workspace, like WhatsApp | ✅ |
| One flooding conversation pauses the assistant after 12 replies in 10 min, so it can't use up the business's AI budget or trigger a stream of auto replies | ✅ |
| Public health check reuses its answer for 10 s per server instance, so a flood can't reach the database | 🟡 |
| Client IP for rate limits from `x-forwarded-for`, which Vercel overwrites to prevent spoofing | 🟡 |

## Secrets and data protection

| Control | Status |
| --- | --- |
| AES-256-GCM for integration credentials and MFA secrets | ✅ |
| Environment validation; no secrets in code or client bundles | 🟡 |
| Log redaction of password/token/secret/key/cookie fields | ✅ |
| Audit log for auth events and workspace creation | ✅ |
| Owner data export (JSON, no credentials), workspace deletion with 7-day grace and cancel, account deletion with anonymisation | ✅ |
| Message retention purge honouring each business's setting (daily cron) | ✅ |
| Webhook signature verification: Meta (HMAC-SHA256) and Paystack (HMAC-SHA512, verified before any database work) | ✅ |
| Payments confirmed only by server-side verify with amount/currency/reference checks, applied exactly once | ✅ |
| QStash signature verification (JWT, key rotation, body hash) | ✅ |
| SSRF protection for website knowledge import | ⏳ Phase 4 |
| File upload validation | ⏳ Phase 4 |

## Ghana Data Protection Act, 2012 (Act 843)

* Sunleon Router Enterprise must register with the Data Protection Commission as a data
  controller/processor before commercial launch (**external, not completed by this build**).
* Businesses act as controllers for their customers' data; SUNLEON AI processes on their
  instructions (documented in the Privacy Policy page).
* Consent and opt-out records are kept per customer and channel (`ConsentRecord`).
* The legal pages are a starting draft and must be reviewed by qualified counsel.
