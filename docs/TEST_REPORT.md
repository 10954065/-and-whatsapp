# SUNLEON AI — Test Report

Only tests that exist and pass are listed. Run everything with:

```bash
docker start sunleon-db          # local pgvector PostgreSQL on :5440
npm run test                     # unit + integration (Vitest)
npm run build && npm run test:e2e   # Playwright against `next start`
```

Integration tests run against a real PostgreSQL database (`sunleon_test`), migrated with
`prisma migrate deploy` before the suite.

## Latest run — Phase 12 (2026-11-09)

| Suite | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit + integration (Vitest) | 25 | 215 | ✅ pass |
| E2E (`tests/e2e`, Chromium) | 4 | 10 | ✅ pass |

Phase 12 additions:
* **QStash signatures:** current and next keys accepted. Forged keys, tampered bodies, other
  URLs, other issuers, expired and not-yet-valid tokens are rejected.
* **QStash publishing:** wake-ups carry the delay and deduplication headers, and a failed
  publish never throws.
* **QStash route:** a signed call runs a stored job exactly once; a forged call gets 401.
* **Health:** the endpoint reports the database and migration state and exposes provider
  booleans only.
* **Export:** contains customers and messages, never credentials or password hashes, and is
  owner-only.
* **Workspace deletion:** needs the exact name; it can be cancelled; it purges everything after
  the grace period despite RESTRICT foreign keys, and the audit trail is kept.
* **Retention:** applies only to the business that set it.
* **Account deletion:** blocked for owners; for other members it strips personal data and
  sessions.
* **E2E:** export download, then schedule and cancel deletion.

Phase 11 additions:
* **Workspace administration:** search and status filters; suspend and restore with a
  recorded actor, IP and reason, rejecting a repeat suspension.
* **Plans and subscriptions:** manual activation that extends a running period; support
  notes; plan updates that keep unrelated limit keys and audit before/after prices.
* **Platform tools:** only failed or dead jobs can be retried; inquiry status changes;
  announcements honour their active window, can be hidden, and store their end time in UTC;
  the AI kill switch turns off and on with audit entries.
* **E2E:** ordinary users get 404 at `/admin`; a super-admin without two-factor
  authentication sees only the 2FA requirement.

Phase 10 additions:
* **Billing:** billing-period arithmetic (month-end clamping, extension rules), lapse rules,
  and Paystack signatures (HMAC-SHA512 of the raw body; tampered bodies and wrong algorithms
  are rejected).
* **Payments, against a scripted Paystack API:** checkout initialisation; pending payments
  change nothing; concurrent confirmations apply once; early renewals extend the period;
  amount or currency mismatches and abandoned checkouts are rejected; unknown references are
  ignored; webhooks need a valid signature, are stored once and confirm through the verify
  API.
* **Recovery (from the security review):** a stored but unenqueued webhook is re-enqueued
  on redelivery; payments still pending are retried and reconciled by the daily sweep; stale
  checkouts are abandoned; two concurrent payments both count (row lock); switching plans
  credits unused time; refunds are flagged for review.
* **Lifecycle and limits:** trial end, grace and expiry with exactly one notice each;
  plan-limited team seats; staff-recorded order payments trigger PAYMENT_CONFIRMED workflows.
* **Analytics:** counts only the business's own data, excludes test-console runs and
  cancelled orders, buckets by local day, and returns honest nulls when empty.
* **E2E:** mark an order paid, analytics with real data, and the billing page with an honest
  payments status.

**Paystack has not been verified live** (no keys in this environment).

Phase 9 additions: every industry template references real workflow templates and registered
tools; workflow templates are valid definitions; knowledge-profile parsing and neutralised
inclusion in AI business facts; applying a template saves answers, creates DRAFT workflows,
sets AI defaults only when asked, never duplicates or revives workflows, skips workflows
without automation permission, replaces answers after an industry change and leaves other
tenants untouched; notifications for orders, low stock (only when crossing the threshold),
escalations, settings toggles, per-recipient emails, and business-scoped mark-as-read; E2E
applies a template and reads/clears the notification bell.

Phase 8 additions: condition evaluation (channel, text, tags, totals, hours); a real
sandbox inbound message runs an ACTIVE workflow once (tag added, lead captured, team
notified) and re-delivery of the same event never runs it twice; non-matching, too-deeply
chained and paused workflows are skipped; E2E builds, activates and pauses a workflow.

Phase 3 additions (AI engine, tested with a scripted fake model — no live Anthropic calls):
tier routing, cost estimation, every preflight block, price/payment/medical post-checks,
delimiter-forgery protection, prompt rendering; orchestrator runs that record AiRun/usage/
counters, execute permitted write tools under RLS, deny unpermitted tools, route
approval-required tools to approvals, simulate writes in test mode, replace invented prices
and escalate, escalate on refusal and provider failure, and spend nothing when preflight
blocks. **Live model behaviour is not verified** (no `ANTHROPIC_API_KEY` in this environment).

## Phase 2 run

| Suite | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit (`tests/unit`) | 5 | 36 | ✅ pass |
| Integration (`tests/integration`) | 3 | 22 | ✅ pass |
| E2E (`tests/e2e`, Chromium) | 2 | 4 | ✅ pass |

Phase 2 additions: opening-hours parsing and timezone-aware open/closed checks; invitations
(verified inviter required, role ceilings, only the invited email can accept, single use,
invitee email marked verified); member role changes/removal with ceilings and no
self-management; cross-business membership access blocked; setup progress derived from
real data with remembered skips; E2E profile save updates the setup guide.

### Covered behaviour

* **Crypto:** AES-GCM round trip, random IVs, tamper detection, version check, keyed token hashing, constant-time compare.
* **Permissions:** owner-only billing/deletion, read-only cannot write, staff/manager boundaries, role assignment ceilings.
* **Input handling:** open-redirect protection, FormData parsing, Zod field errors.
* **Passwords & logging:** password policy, Argon2id hashing, secret redaction; preview deployments are always sandboxed.
* **Auth (DB):** registration stores Argon2 hash, verification token single use, forged tokens rejected, duplicate email rejected (case-insensitive), generic invalid-credential errors, lockout after 5 failures, password reset revokes sessions and is single-use, no-op for unknown emails, rate-limit windows.
* **Tenancy (DB):** workspace creation with OWNER membership, settings, trial and audit entry; **RLS blocks cross-tenant reads, writes and updates and hides credential tables.**
* **E2E:** register → create workspace → dashboard → sign out → wrong password error (values preserved) → sign in; anonymous redirect to sign-in; DB-managed pricing in GHS.
