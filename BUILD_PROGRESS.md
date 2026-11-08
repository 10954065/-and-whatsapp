# SUNLEON AI — Build Progress

Resume from this file if a session is interrupted. Update it at the end of every phase.

## Status by phase

| Phase | Status | Commit |
| --- | --- | --- |
| 0 — Repository audit | ✅ Complete | phase 0 commit |
| 1 — Core foundations | ✅ Complete (lint, typecheck, 47 Vitest + 3 Playwright tests, build pass) | phase 1 commit |
| 2 — Business onboarding | ⏳ Next | |
| 3 — AI engine | ⬜ | |
| 4 — Knowledge base | ⬜ | |
| 5 — Meta integrations | ⬜ | |
| 6 — Unified inbox | ⬜ | |
| 7 — Business operations | ⬜ | |
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

## Next steps

Phase 2 — Business onboarding: guided setup page `/app/setup` (steps 8–14 with saved
progress in `Business.onboardingState`), business profile & settings page
(`/app/settings`: contact details, description, business hours, notifications),
team page (`/app/team`: invitations with email, accept flow `/invite/[token]`, role
changes, removal), industry template selection hook (full templates in Phase 9).
Then set `createBusinessAction` redirect back to `/app/setup` and add nav entries.
