# SUNLEON AI — Test Report

Only tests that exist and pass are listed. Run everything with:

```bash
docker start sunleon-db          # local pgvector PostgreSQL on :5440
npm run test                     # unit + integration (Vitest)
npm run build && npm run test:e2e   # Playwright against `next start`
```

Integration tests run against a real PostgreSQL database (`sunleon_test`), migrated with
`prisma migrate deploy` before the suite.

## Latest run — Phase 2 (2026-11-08)

| Suite | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit (`tests/unit`) | 5 | 36 | ✅ pass |
| Integration (`tests/integration`) | 3 | 22 | ✅ pass |
| E2E (`tests/e2e`, Chromium) | 1 | 3 | ✅ pass |

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
