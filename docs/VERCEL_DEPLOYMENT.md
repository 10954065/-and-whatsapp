# Deploying to Vercel

SUNLEON AI is a single Next.js 16 application. It runs on Vercel Functions (Node.js, Fluid
Compute) with Supabase PostgreSQL. No Railway or other container host is required. The optional
standalone worker (`npm run worker`) is only an alternative to cron or QStash.

> **Plan choice.** Vercel Hobby is for personal, non-commercial use. Use it only to evaluate
> the app. **Charging customers requires Vercel Pro** (see `INFRASTRUCTURE_COSTS.md`).

## 1. Create the project

1. Import the GitHub repository in Vercel (framework preset **Next.js**, root directory `/`).
2. Build command: `npm run build` (runs `prisma generate` then `next build`). Install command:
   default (`npm install`; `postinstall` also generates the Prisma client).
3. Node.js version: 24 (Project → Settings → General).
4. Function region: `vercel.json` pins functions to `cdg1` (Paris), next to the
   Supabase project in `eu-west-3`. Without it Vercel defaults to `iad1` (Washington), an
   ocean away from the database. Hobby allows one region; that is all the app needs.
5. `.vercelignore` keeps `.env*` and `.data/` out of CLI uploads; Vercel's own default list
   skips `.env.local` but not `.env`.

## 2. Database

Create the Supabase project and run migrations **before** the first production deploy. See
`DATABASE_DEPLOYMENT.md`. Migrations are deliberately **not** run during the Vercel build, so
a preview build can never alter the production schema.

## 3. Environment variables

Set every required variable from `ENVIRONMENT_VARIABLES.md` for **Production**:
* `APP_URL` is the production domain.
* `DATABASE_URL` is the Supabase **transaction pooler** (port 6543).
* `DIRECT_URL` is the Supabase **session pooler** (port 5432).
* `AUTH_SECRET`, `ENCRYPTION_KEY` and `CRON_SECRET` are fresh random values.

For **Preview**, use a separate Supabase project, a different `AUTH_SECRET` and
`ENCRYPTION_KEY`, and leave Paystack in test mode. Preview deployments always sandbox outbound
WhatsApp/Instagram messages.

## 4. Cron

`vercel.json` schedules `GET /api/cron/jobs` daily at 03:00 UTC (the Hobby limit). Vercel
sends `Authorization: Bearer $CRON_SECRET`. Each run:
* runs the billing lifecycle and reconciles pending payments;
* performs scheduled workspace deletions and the message-retention purge;
* sweeps due background jobs (35-second budget);
* purges expired sessions and rate-limit buckets.

On **Pro**, run it more often (for example every 5 minutes) so delayed retries are picked up
promptly:

```json
{ "crons": [{ "path": "/api/cron/jobs", "schedule": "*/5 * * * *" }] }
```

Alternatively, keep the daily cron and set `QUEUE_PROVIDER=qstash` (see
`QUEUE_AND_WORKER_GUIDE.md`); QStash then wakes every job and retry on time.

## 5. Provider callbacks

| Provider | Configure | Value |
| --- | --- | --- |
| Meta (WhatsApp + Instagram webhooks) | Meta app → Webhooks | `https://<domain>/api/webhooks/meta`, verify token = `META_WEBHOOK_VERIFY_TOKEN` |
| Instagram Login | Meta app → Instagram → API setup → OAuth redirect | `https://<domain>/api/integrations/instagram/callback` |
| Paystack | Dashboard → Settings → API Keys & Webhooks | `https://<domain>/api/webhooks/paystack` |
| Resend | Domains | Verify the domain used in `EMAIL_FROM` |
| QStash (optional) | Nothing to register; the app publishes to `https://<domain>/api/queue/qstash` | — |

## 6. First deployment checklist

- [ ] `npm run db:deploy` and `npm run db:seed` ran against the production database.
- [ ] Deploy succeeded; `GET https://<domain>/api/health` returns `"status": "ok"` with the
      latest migration name.
- [ ] Register the first account with an email listed in `PLATFORM_ADMIN_EMAILS`, confirm the
      email, turn on two-factor authentication, then open `/admin`.
- [ ] Admin → Settings shows each provider you configured as "configured".
- [ ] Trigger the cron once manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/jobs`.
- [ ] Run the go-live checklists in `PAYSTACK_BILLING_GUIDE.md` and `WHATSAPP_INTEGRATION_GUIDE.md`.

## 7. Function limits used by the app

| Route | `maxDuration` | Why |
| --- | --- | --- |
| `/api/cron/jobs` | 60 s | Bounded sweep (35 s job budget) |
| `/api/queue/qstash` | 60 s | One job per call |
| `/api/export/business` | 60 s | Builds the workspace export |
| Server Actions | default (300 s on Fluid Compute) | Uploads limited to 11 MB (`next.config.ts`) |

## 8. Rollback

Vercel → Deployments → promote the previous deployment. Database migrations are
forward-only. If a release added a migration, roll the app back only to a build that is
compatible with the new schema, or restore a database backup (see `DATABASE_DEPLOYMENT.md`).
