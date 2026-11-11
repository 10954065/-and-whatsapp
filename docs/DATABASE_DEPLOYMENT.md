# Database deployment (Supabase PostgreSQL)

The schema is managed by Prisma migrations in `prisma/migrations`:
* `20261108203109_init` — tables, plus the `vector`, `btree_gist` and `pg_trgm` extensions.
* `20261108203500_integrity_and_rls` — CHECK constraints, the booking exclusion constraint,
  the `sunleon_tenant` role and row-level security policies.
* `20261108204940_contact_inquiries`.
* `20261111090000_supabase_data_api_lockdown` — revokes every privilege Supabase's Data API
  roles (`anon`, `authenticated`, `service_role`) get on `public`, now and for later tables.
  A no-op on servers without those roles.

## 1. Create the database

1. Create a Supabase project in the same region as the Vercel functions: **West EU
   (Paris), `eu-west-3`**, matching `"regions": ["cdg1"]` in `vercel.json`. Save the
   database password in a password manager.
2. From **Connect**, copy two connection strings and put the password in both:
   * **Transaction pooler** (port 6543) → `DATABASE_URL` (runtime). The app's `pg` driver
     adapter uses unnamed statements, so no `pgbouncer=true` flag is needed.
   * **Session pooler** (port 5432) → `DIRECT_URL` (migrations). The "direct connection"
     host is IPv6-only unless you buy the IPv4 add-on, so use the session pooler.
3. The default `postgres` role can create the extensions and the `sunleon_tenant` role
   (NOLOGIN, NOBYPASSRLS), which the migration grants to the migrating role.
4. SUNLEON AI never uses Supabase's Data API. The lockdown migration removes its access; also
   turn the Data API off (or at least **Automatically expose new tables**) in the project's
   Data API settings so nothing is exposed by default.
5. For knowledge-base uploads, create a **private** Storage bucket named `knowledge` and an
   S3 access key (Storage → S3 Configuration). Set `OBJECT_STORAGE_ENDPOINT` to
   `https://<project-ref>.storage.supabase.co/storage/v1/s3` and `OBJECT_STORAGE_REGION` to
   `eu-west-3`. These keys bypass Storage RLS: server-side only.

## 2. Apply migrations and seed

From a trusted machine with the production values exported:

```bash
export DIRECT_URL='postgresql://…'          # direct host
export DATABASE_URL='postgresql://…-pooler…' # pooled host
export PLATFORM_ADMIN_EMAILS='you@yourcompany.com'
npm ci
npm run db:deploy      # prisma migrate deploy (uses DIRECT_URL)
npm run db:seed        # creates Starter/Business/Enterprise plans in GHS; promotes admins
```

The seed never overwrites plan prices that already exist; edit prices in Admin → Plans.
Check the result with `npx prisma migrate status`. It should say "Database schema is up to date".

## 3. Verify row-level security

```sql
-- Should list every tenant table with rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity;
-- The tenant role must not bypass RLS
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'sunleon_tenant';
-- Supabase's Data API roles must reach no table (expect 0)
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT'));
```

The integration suite proves isolation on every run (`tests/integration/tenancy.test.ts`).
Run it against a disposable Neon branch to check a new environment:
`TEST_DATABASE_URL=… npm run test:integration`.

## 4. Future migrations

1. Locally: change `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>` and
   then `npx prisma generate`. Prisma 7's `migrate dev` does not regenerate the client.
2. Commit the migration folder with the code that needs it.
3. Before deploying the code, run `npm run db:deploy` against production. Keep migrations
   backwards-compatible (add first, remove later) so the running version keeps working
   during the deploy.

## 5. Backups and restore

* What Supabase backs up depends on the plan (Database → Backups shows it). Daily backups and
  point-in-time recovery are paid features; on the Free plan, rely on your own dumps.
* Before any risky migration, and on a schedule, run
  `pg_dump --format=custom "$DIRECT_URL" > backup.dump` from a trusted machine and keep it
  encrypted. Restore with `pg_restore` into a fresh project, check it, then point
  `DATABASE_URL`/`DIRECT_URL` at it and redeploy.
* Free-plan projects can be paused after a period of inactivity; check the current policy in
  the Supabase dashboard before relying on the Free plan for paying customers.

## 6. Data retention

| Data | Kept |
| --- | --- |
| Conversation messages | Until the business's retention setting (Settings → Notifications & data retention); 0 keeps them |
| Deleted workspaces | Purged 7 days after the owner's request; audit rows remain with the business id removed |
| Sessions, rate-limit buckets | Purged daily after expiry |
| Webhook events, jobs, error events, email logs | Kept for troubleshooting; prune periodically (see `OPERATIONS_RUNBOOK.md`) |

## 7. Local development database

```bash
docker run -d --name sunleon-db -e POSTGRES_USER=sunleon -e POSTGRES_PASSWORD=sunleon_dev_pw \
  -e POSTGRES_DB=sunleon -p 5440:5432 pgvector/pgvector:pg17
docker exec sunleon-db psql -U sunleon -c 'CREATE DATABASE sunleon_test'
npx prisma migrate deploy && npm run db:seed
```

Integration tests migrate `sunleon_test` automatically before each run.
