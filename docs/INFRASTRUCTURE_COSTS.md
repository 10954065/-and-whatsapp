# SUNLEON AI — Infrastructure Costs

Figures verified on 2026-11-08 from the providers' public pricing pages (USD, excluding
tax). Free tiers change; re-check before relying on them and watch the in-app
**Admin → Usage** page.

## 1. Launch stack (development and non-commercial testing)

| Service | Plan | Included | Monthly cost |
| --- | --- | --- | --- |
| Vercel | Hobby | 1M function invocations, 4 active-CPU hours, 100 GB transfer, 1 daily cron | $0 — **non-commercial use only** |
| Neon PostgreSQL | Free | 1 GB storage, 100 CU-hours, scale-to-zero after 5 min | $0 |
| Upstash QStash (optional) | Free | 1,000 messages/day, 10 schedules | $0 |
| Cloudflare R2 | Free | 10 GB-month, 1M writes, 10M reads, free egress | $0 |
| Resend | Free | 3,000 emails/month, 100/day | $0 |
| Voyage AI (optional) | Free allowance | Embeddings for knowledge base | $0 within allowance |
| Anthropic | Pay as you go | — | usage-based (see §3) |
| Meta WhatsApp | Per-message pricing set by Meta, billed to each business's own WhatsApp Business account | Since 2026-10-01 each business number gets 1,000 free delivered service messages (replies) a month; Meta charges each delivered reply after that, and template messages per country/category. Without a payment method in Meta Billing Hub, replies stop after the free 1,000. Explained to businesses on `/pricing#whatsapp-fees` and the Integrations page | paid by the business, not SUNLEON |
| Paystack | Per transaction | No monthly fee; Paystack charges a percentage per local transaction | usage-based |

**Fixed cost at launch: $0**, plus AI and messaging usage.

## 2. First commercial production (required before charging customers)

Vercel's fair-use policy restricts Hobby to personal, non-commercial use. Before the
first paying business is onboarded:

| Service | Plan | Why | Monthly cost |
| --- | --- | --- | --- |
| Vercel | **Pro** | Commercial use, per-minute cron, longer functions, spend management, 1-day logs | $20 per developer seat |
| Neon | Launch (usage-based) | Removes the 100 CU-hour cap, more storage | ≈ $15 for a small, intermittently loaded database |
| Resend | Free → Pro when > 100 emails/day | Daily cap | $0 → $20 |
| QStash | Pay as you go when > 1K messages/day | Message volume | $1 per 100K messages |

Expected fixed cost for the first paying customers: **≈ $35–$55 / month**.
No code changes are required for this upgrade — only plan changes and, on Vercel Pro,
changing the sweep cron in `vercel.json` from daily to every minute.

## 3. AI cost model

| Tier | Default model | Input $/MTok | Output $/MTok | Used for |
| --- | --- | --- | --- | --- |
| fast | `claude-haiku-5-5` | 0.10 | 0.50 | Greetings, FAQs, simple enquiries, classification |
| standard | `claude-sonnet-5-5` | 2.00 | 10.00 | Multi-turn sales/support conversations with tools |
| advanced | `claude-opus-5-5` | 4.00 | 20.00 | Complex complaints, multi-step reasoning, escalation summaries |

Example: a routine 6-message WhatsApp conversation on the fast tier with ~3K input
tokens per turn (cached system prompt) and ~150 output tokens per turn costs roughly
$0.002–$0.004. Prices are stored in `src/config/ai-pricing.ts` and every call is
recorded in `AiUsageRecord` with its estimated cost, so the real figure is visible in
**Analytics → AI usage** per business and **Admin → Usage** platform-wide.

Controls that bound AI spend:

* Per-business daily and monthly spend limits (agent settings) checked before every call.
* Plan limits on AI messages and conversations per month.
* Router defaults to the cheapest tier; escalation to higher tiers is rule-based.
* Platform-wide AI kill switch (`PlatformSetting ai.globalEnabled`).

## 4. Cost dashboard

**Admin → Usage** reports, from the application's own records:

* AI tokens and estimated cost (per model, per business, per day).
* Messages sent/received per channel (proxy for WhatsApp charges).
* Job executions and failures (proxy for QStash usage).
* Emails sent (Resend daily cap).
* Knowledge storage bytes per business (R2 usage).
* Database size (from `pg_database_size`).

Vercel function usage is not exposed to the application; check the Vercel dashboard
(Usage tab) weekly and configure **Spend Management** once on Pro.

## 5. Scaling triggers

| Signal | Action |
| --- | --- |
| Neon CU-hours > 70 % of plan | Move to Neon Launch/Scale; enable read replica for analytics |
| Job backlog > 5 min on Pro cron | Configure QStash dispatcher (`QUEUE_PROVIDER=qstash`) |
| Sustained > 50 jobs/min | Deploy `src/workers/worker.ts` to Railway (or any container host) |
| Knowledge chunks > 1M rows | Add HNSW index on `KnowledgeChunk.embedding` |
