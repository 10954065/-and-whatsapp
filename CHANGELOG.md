# Changelog

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
