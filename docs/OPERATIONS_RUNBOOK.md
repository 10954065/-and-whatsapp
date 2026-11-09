# Operations runbook

For whoever operates SUNLEON AI in production. Most tasks happen in the admin console
(`/admin`, super-admins with two-factor authentication). Database access is needed only where
noted.

## Daily checks (5 minutes)

1. `GET /api/health`: `status: ok` and `queue.overdueJobs` near 0.
2. **Admin → Overview**: failed jobs and webhooks, errors in the last 24 hours, new inquiries.
3. **Admin → Monitoring**: read new errors by source. Retry dead jobs once the cause is
   fixed.
4. The Vercel dashboard shows a successful daily cron run.

## Incidents

### AI replies are wrong, unsafe or the provider is down

1. **Admin → Settings → Turn AI off everywhere** and record a reason. AI runs stop immediately.
   Customer messages keep arriving and wait in each business's inbox.
2. For one workspace only: its owner can use the emergency stop on the AI employee page, or
   you can suspend the workspace (below).
3. Check the Anthropic status page and the `ai.orchestrator` errors in Monitoring.
4. Turn AI back on with a reason once resolved.

### Messages are not arriving from WhatsApp or Instagram

1. **Admin → Monitoring → Webhook problems**: FAILED Meta events show the error.
2. A burst of `webhook.meta.invalid_signature` warnings in the logs means `META_APP_SECRET`
   does not match the Meta app. Fix it in Vercel and redeploy.
3. In the Meta app dashboard → Webhooks, check that the callback URL and subscribed fields
   are correct and deliveries return 200.
4. For one business: **Admin → Businesses → the business → Channels** shows the channel status
   and last error (expired token, revoked permission). The owner reconnects from Integrations.

### A customer paid but their plan is not active

1. **Admin → Businesses → the business → Payments**: find the reference (`sl-…`).
2. PENDING: the daily cron re-verifies checkouts older than 5 minutes. To act now, trigger
   the cron manually (below). It confirms with Paystack's verify API.
3. FAILED with "Amount or currency did not match": do not activate. Check the transaction in
   the Paystack dashboard and refund there if needed.
4. If Paystack confirms the payment but the reference is unknown (paid outside the app), use
   **Activate or extend manually** with the reference in the reason.

### Background jobs are piling up

* Trigger a sweep: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/jobs`.
* On Hobby the cron is daily. Set `QUEUE_PROVIDER=qstash` (or a more frequent cron on Pro) so
  retries run on time.
* A DEAD job means every retry failed. Fix the cause, then **Retry** it in Monitoring.

### Abusive or non-paying workspace

**Admin → Businesses → the business → Suspend workspace**, with a reason. The data is kept, the
workspace UI is blocked and AI replies stop. **Restore** reverses it. Both actions are audited.

### Suspected credential leak

| Secret | Action |
| --- | --- |
| `CRON_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | Generate a new value, update Vercel (and Meta for the verify token), redeploy. |
| `META_APP_SECRET`, `INSTAGRAM_APP_SECRET` | Reset in the Meta dashboard, update Vercel, redeploy. |
| `PAYSTACK_SECRET_KEY` | Roll the key in Paystack, update Vercel, redeploy. Webhooks are verified with the new key immediately. |
| `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `RESEND_API_KEY`, `QSTASH_*`, storage keys | Rotate at the provider, update Vercel, redeploy. |
| `AUTH_SECRET` | Rotating it invalidates every session and outstanding email link (everyone signs in again). |
| `ENCRYPTION_KEY` | **Do not simply rotate.** Stored channel tokens and MFA secrets would become unreadable. Re-encrypt them with a migration script first, or ask affected businesses to reconnect channels and users to re-enrol MFA. |
| A business's WhatsApp/Instagram token | The owner disconnects and reconnects the channel; the old token is replaced. |

## Data requests

* **Export:** owners download everything from Settings → Your data. Platform staff never need
  to extract data by hand.
* **Workspace deletion:** the owner schedules it in Settings; it is purged 7 days later by the
  cron. The owner can cancel until then.
* **Account deletion:** users delete their own account on the Account page (owners must delete
  or hand over their workspace first).
* A request that arrives by email instead: verify the requester owns the account, then ask
  them to use the in-app tools. If they can't, record it as a support note on the business.

## Housekeeping (monthly, database access)

Operational tables grow over time. Prune old successful rows:

```sql
DELETE FROM "Job" WHERE "status" = 'SUCCEEDED' AND "completedAt" < now() - interval '30 days';
DELETE FROM "WebhookEvent" WHERE "status" IN ('PROCESSED', 'IGNORED') AND "receivedAt" < now() - interval '90 days';
DELETE FROM "ErrorEvent" WHERE "createdAt" < now() - interval '90 days';
DELETE FROM "EmailLog" WHERE "createdAt" < now() - interval '180 days';
```

Keep `AuditLog` and `PaymentTransaction`. They are the accountability and financial record.

## Releases

1. CI-equivalent locally: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.
2. Apply new migrations to production (`npm run db:deploy`) **before** promoting the code that
   needs them.
3. Deploy, then check `/api/health` and Monitoring.
4. Roll back by promoting the previous Vercel deployment (schema permitting, see
   `VERCEL_DEPLOYMENT.md`).
