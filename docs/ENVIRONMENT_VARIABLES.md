# Environment variables

All variables are **platform-wide** and are validated at runtime by `src/lib/env.ts`. A missing
required variable stops the server with a clear message.
* **Per-business credentials** (WhatsApp tokens, Instagram tokens) are entered in the app and
  stored encrypted in the database. They never go in environment variables.
* **Local development:** copy `.env.example` to `.env`.
* **Vercel:** set the same keys under Project → Settings → Environment Variables. Use separate
  values for Preview and Production.

Optional variables can be left empty. Each feature that needs one reports itself as "not
configured" in the app (and in Admin → Settings) instead of failing.

## Required

| Variable | Purpose | How to generate |
| --- | --- | --- |
| `APP_URL` | Public base URL, no trailing slash. Used for email links, OAuth redirects, the Paystack callback and the QStash destination. | e.g. `https://app.sunleonrouterenterprise.com` |
| `DATABASE_URL` | Runtime PostgreSQL connection. On Neon use the **pooled** (`-pooler`) host. | Neon console |
| `DIRECT_URL` | Direct (non-pooled) connection used by `prisma migrate deploy`. | Neon console |
| `AUTH_SECRET` | Keys session and token hashing (HMAC). At least 32 characters. **Rotating it signs everyone out.** | `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | AES-256-GCM key for integration credentials and MFA secrets. Exactly 32 bytes, base64. **Never rotate without re-encrypting stored data.** | `openssl rand -base64 32` |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/jobs`. Without it the sweeper refuses every call. | `openssl rand -hex 32` |

## Platform administration

| Variable | Purpose |
| --- | --- |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails promoted to super-admin by `npm run db:seed`, and on email verification, once ownership is proven. Super-admins must turn on two-factor authentication before using `/admin`. |

## Messaging safety

| Variable | Default | Purpose |
| --- | --- | --- |
| `OUTBOUND_MESSAGING_MODE` | `live` on production deployments, `sandbox` everywhere else | `sandbox` records outbound WhatsApp/Instagram messages without sending them. **Preview deployments are always sandboxed**, whatever this says. |

## AI provider

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `anthropic` | `anthropic` (Claude, native API) or `openai-compatible` (any provider that speaks the OpenAI Chat Completions format). |
| `AI_API_KEY` | — | The provider's API key. Enables AI replies and the test console; without it, AI runs are skipped and messages wait for the team. For `anthropic`, the older `ANTHROPIC_API_KEY` is also accepted. |
| `AI_BASE_URL` | `https://api.openai.com/v1` for `openai-compatible`; none for `anthropic` | The provider's API endpoint (table below). For Anthropic, set it only to route through a proxy or gateway. |
| `AI_MODEL` | Claude 5.5 models for `anthropic`; **required** for `openai-compatible` | Model id used for every tier. |
| `AI_MODEL_FAST` | `AI_MODEL` (Anthropic: `claude-haiku-5-5`) | Fast tier (short, simple messages). |
| `AI_MODEL_STANDARD` | `AI_MODEL` (Anthropic: `claude-sonnet-5-5`), else the fast model | Standard tier. |
| `AI_MODEL_ADVANCED` | `AI_MODEL` (Anthropic: `claude-opus-5-5`), else the standard model | Advanced tier. |
| `AI_MODEL_PRICES` | — | JSON, USD per million tokens, for models without built-in prices: `{"model-id":{"input":0.5,"output":1.5}}` (optional `cacheRead`, `cacheWrite`; left out, they are charged at the input rate). Unpriced models are estimated at the Claude Opus rate so budgets never under-count. Invalid JSON stops the app at startup. |

`openai-compatible` endpoints for common providers (the app appends `/chat/completions`):

| Provider | `AI_BASE_URL` |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` (default) |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter (one key, many models) | `https://openrouter.ai/api/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| DeepSeek | `https://api.deepseek.com` |
| Mistral | `https://api.mistral.ai/v1` |
| Ollama (self-hosted) | `http://localhost:11434/v1` (any non-empty key) |

The model must support tool (function) calling. Prompt caching, effort and the server-side
safety fallback are Anthropic features and apply to `anthropic` only. For `anthropic`, the
older `ANTHROPIC_MODEL_FAST` / `_STANDARD` / `_ADVANCED` names are still read, below the
`AI_MODEL*` settings. A provider that reports no token usage (some self-hosted servers)
records zero cost, so spend limits do not apply to it; plan message allowances still do.

## Knowledge embeddings

| Variable | Default | Purpose |
| --- | --- | --- |
| `VOYAGE_API_KEY` | — | Optional semantic knowledge search; without it, retrieval uses PostgreSQL full-text search. |
| `VOYAGE_MODEL` | `voyage-4-lite` | Embedding model (1024 dimensions; must match the `vector(1024)` column). |

## Meta (WhatsApp Business Platform and Instagram)

| Variable | Purpose |
| --- | --- |
| `META_GRAPH_API_VERSION` | Graph API version, default `v27.0`. |
| `META_APP_ID`, `META_APP_SECRET` | Meta app credentials. The secret verifies `X-Hub-Signature-256` on webhooks. |
| `META_WEBHOOK_VERIFY_TOKEN` | Any random string; enter the same value in the Meta app's webhook settings. |
| `META_WHATSAPP_CONFIG_ID` | WhatsApp Embedded Signup configuration id. |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Instagram API with Instagram Login credentials. |

See `META_INTEGRATION_GUIDE.md` and `WHATSAPP_INTEGRATION_GUIDE.md`.

## Payments (Paystack)

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Initialises and verifies checkouts, and verifies webhook signatures (HMAC-SHA512). Required for online subscription payments. |
| `PAYSTACK_PUBLIC_KEY` | Not used by the server-initialised checkout; may be left empty. |

See `PAYSTACK_BILLING_GUIDE.md`.

## Email (Resend)

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | — | Sends verification, password reset, invitation and notification emails. In development, emails are written to the server log. In production, email features fail visibly and are logged in `EmailLog`. |
| `EMAIL_FROM` | `SUNLEON AI <no-reply@example.com>` | Sender; must be on a domain verified in Resend. |

## Object storage (S3-compatible, e.g. Cloudflare R2)

| Variable | Default | Purpose |
| --- | --- | --- |
| `OBJECT_STORAGE_ENDPOINT` | — | e.g. `https://<account>.r2.cloudflarestorage.com` |
| `OBJECT_STORAGE_REGION` | `auto` | `auto` for R2. |
| `OBJECT_STORAGE_BUCKET` | — | Private bucket for knowledge uploads. |
| `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY` | — | Bucket-scoped API token. |

Without these, development stores files under `./.data/storage`. **Production uploads need
object storage**: Vercel's filesystem is not persistent.

## Background jobs

| Variable | Default | Purpose |
| --- | --- | --- |
| `QUEUE_PROVIDER` | `inline` | `inline`: jobs run right after the request, and the daily cron sweeps the rest. `qstash`: QStash wakes each job and retry on time. |
| `QSTASH_TOKEN` | — | QStash publish token. |
| `QSTASH_URL` | `https://qstash.upstash.io` | Regional endpoint from the QStash console (optional). |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | — | Verify `Upstash-Signature` on `/api/queue/qstash` (both keys, for rotation). |

## Test-only

| Variable | Purpose |
| --- | --- |
| `TEST_DATABASE_URL` | Database for Vitest integration tests (default `…/sunleon_test` on the local Docker database). Tests never use `DATABASE_URL`. |
| `SHADOW_DATABASE_URL` | Optional shadow database for `prisma migrate dev`. |
| `E2E_PORT` | Port for Playwright's `next start` (default 3100). |
