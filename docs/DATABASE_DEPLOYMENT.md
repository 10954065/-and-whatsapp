# Database deployment (Neon PostgreSQL)

The schema is managed by Prisma migrations in `prisma/migrations`:
* `20261108203109_init` — tables, plus the `vector` and `btree_gist` extensions.
* `20261108203500_integrity_and_rls` — CHECK constraints, the booking exclusion constraint,
  the `sunleon_tenant` role and row-level security policies.
* `20261108204940_contact_inquiries`.

## 1. Create the database

1. Create a Neon project (PostgreSQL 17) in the region you chose for Vercel functions.
2. From the Neon console, copy two connection strings:
   * **pooled** (host contains `-pooler`) → `DATABASE_URL` (runtime)
   * **direct** → `DIRECT_URL` (migrations)
   Both must use `sslmode=require`.
3. The connecting role must be able to create extensions and roles. The default Neon owner
   role can. The migration creates `sunleon_tenant` (NOLOGIN, NOBYPASSRLS) and grants it to
   the migrating role.

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

* Neon keeps point-in-time history (the restore window depends on the plan: short on Free,
  longer on paid plans).
* Before any risky migration, create a branch: Neon console → Branches → *Create branch* from
  `main`. It is an instant copy-on-write snapshot.
* To restore: create a branch at a timestamp before the incident, check it, then point
  `DATABASE_URL`/`DIRECT_URL` at it (or promote it to primary) and redeploy.
* For an off-platform copy, run a periodic `pg_dump --format=custom "$DIRECT_URL" > backup.dump`
  from a trusted machine and keep it encrypted.

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
