# SUNLEON AI — Build Progress

Resume from this file if a session is interrupted. Update it at the end of every phase.

## Status by phase

| Phase | Status | Commit |
| --- | --- | --- |
| 0 — Repository audit | ✅ Complete | phase 0 commit |
| 1 — Core foundations | ⏳ Next | |
| 2 — Business onboarding | ⬜ | |
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

## Next steps

Phase 1: environment validation, Prisma schema + migrations, auth, tenancy, RBAC,
UI foundation, marketing site.
