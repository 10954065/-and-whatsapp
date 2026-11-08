# Changelog

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
