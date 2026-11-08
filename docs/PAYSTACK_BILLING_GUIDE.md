# Paystack billing guide

SUNLEON AI charges workspaces for their subscription through Paystack. This guide covers
setup, how a payment flows, and what is deliberately out of scope.

## Status

**Implemented, not live-verified.** The flow is covered by integration tests against a
scripted Paystack API (no keys are configured in this environment). Before launch, run one
real test-mode payment end to end (see "Go-live checklist").

## Setup

1. In the Paystack dashboard (Ghana business account, GHS enabled), copy the **secret key**.
2. Set `PAYSTACK_SECRET_KEY` in Vercel (Production). `PAYSTACK_PUBLIC_KEY` is not required:
   checkout is initialised on the server.
3. Set the webhook URL in Paystack → Settings → API Keys & Webhooks:
   `https://<your-domain>/api/webhooks/paystack`
4. No callback URL is needed in the dashboard; each checkout sets
   `https://<APP_URL>/api/billing/paystack/callback`.
5. Make sure plans exist (`npm run db:seed` creates Starter / Business / Enterprise in GHS).

Without `PAYSTACK_SECRET_KEY` the billing page says that online payments are not configured
and shows no pay buttons.

## How a payment flows

1. The owner chooses a plan and period in **Billing**. The server creates a `PENDING`
   `PaymentTransaction` (reference `sl-<uuid>`, amount in pesewas, plan and period in
   metadata) and calls `POST /transaction/initialize`. Only a `https://checkout.paystack.com`
   URL is accepted; the owner is redirected there.
2. Paystack redirects back to `/api/billing/paystack/callback?reference=…`. The callback calls
   `GET /transaction/verify/:reference`. The redirect itself never changes anything.
3. Paystack also sends `charge.success` to the webhook. The webhook checks
   `x-paystack-signature` (the HMAC-SHA512 of the raw body, keyed with the secret key) before any
   database work, rejects bodies over 256 KB, stores the event once (`WebhookEvent`, dedupe key
   `paystack:<event>:<reference>`), enqueues `webhook.paystack`, and returns 200. A redelivery
   of a stored event that has not finished is enqueued again, so a failed enqueue never loses
   a payment. The job confirms the payment through the verify API. If Paystack still reports
   the payment as pending, the job throws and the queue retries it with back-off.
4. `confirmPayment` applies a payment only if Paystack reports `success` **and** the
   reference, amount and currency match the stored checkout. The transaction is then claimed
   atomically (`status ≠ SUCCESS → SUCCESS`) while the business row is locked (`FOR UPDATE`).
   Callbacks, webhooks and retries therefore apply it exactly once, and two different payments
   never compute their period from the same state. A mismatch is marked `FAILED` and reported
   as an error.
5. The subscription becomes `ACTIVE` for one month or year. Paying early for the same plan
   and period extends it from the current end. Switching plan or period starts today and adds
   the unused paid time, converted at the two plans' daily rates.
6. **Safety net:** the daily sweep re-verifies `PENDING` checkouts older than 5 minutes. After
   48 hours it closes them as `ABANDONED`.

## Lifecycle (daily cron)

`runBillingLifecycle` runs in `/api/cron/jobs`:

| From | When | To |
| --- | --- | --- |
| `TRIALING` | trial end passed | `EXPIRED` |
| `ACTIVE` / `PAST_DUE` | period end passed | `GRACE` (3 days) |
| `GRACE` | grace end passed | `EXPIRED` |

Owners get a reminder 3 days before a paid period ends, and a notice on each transition
(in the app and by email). Lapsed workspaces keep all their data. AI replies, automations
and new channels pause through the plan limits, and a banner links to Billing.

## Plan limits enforced

AI replies per month, automation runs per month, connected channels, team seats (members
plus pending invitations) and knowledge storage. `aiConversationsPerMonth` is stored on
plans but **not enforced** yet.

## Deliberately out of scope

* **Automatic renewal.** Paystack subscriptions charge saved cards only, and most Ghanaian
  customers pay with mobile money, so each payment buys a prepaid period. The
  `paystackPlanCode*` columns are unused.
* **Collecting customer order payments through Paystack.** That would route a business's
  sales into the platform's Paystack account. It needs per-business subaccounts or split
  payments. Staff record order payments instead (orders page → Mark paid), which emits
  `PAYMENT_CONFIRMED` for automations.
* **Refunds and disputes.** `refund.*` and `charge.dispute.*` webhooks are stored and flagged
  as `ErrorEvent` "needs manual review"; nothing is changed automatically. Handle them in the
  Paystack dashboard and adjust the subscription from the admin console.
* **Seat limits under concurrent invitations.** The seat check runs just before the
  invitation is created; two simultaneous invitations could both pass (bounded by the
  invitation rate limit).

## Go-live checklist

- [ ] Test-mode secret key set in a preview environment; webhook pointed at that preview.
- [ ] Pay for a plan with a Paystack test card and with test mobile money; the billing page shows
      "Payment confirmed" and the subscription is `ACTIVE`.
- [ ] Paystack dashboard → Webhooks shows the `charge.success` delivery returned 200; the
      `WebhookEvent` row is `PROCESSED`.
- [ ] Re-send the webhook from the dashboard; nothing changes (idempotent).
- [ ] Switch to live keys only after the above pass.
