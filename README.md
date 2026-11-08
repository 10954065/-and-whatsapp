# SUNLEON AI

AI-powered business communication and operations automation for businesses in Ghana and
beyond — by **Sunleon Router Enterprise** ([sunleonrouterenterprise.com](https://sunleonrouterenterprise.com)).

SUNLEON AI gives every business an AI employee that answers customers on WhatsApp and
Instagram, qualifies leads, takes authorised orders and bookings, follows up, and keeps
the owner in control.

> Status: under active development. See [BUILD_PROGRESS.md](./BUILD_PROGRESS.md).

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/PROJECT_AUDIT.md](./docs/PROJECT_AUDIT.md) | Starting state and verified provider facts |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design |
| [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | Phase plan |
| [docs/INFRASTRUCTURE_COSTS.md](./docs/INFRASTRUCTURE_COSTS.md) | Free tiers, commercial upgrade path, AI cost model |
| [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Data model, constraints, row-level security |
| [docs/SECURITY_PLAN.md](./docs/SECURITY_PLAN.md) | Security controls and their status |
| [docs/AI_SYSTEM_DOCUMENTATION.md](./docs/AI_SYSTEM_DOCUMENTATION.md) | AI engine, routing, tools, guardrails, cost |
| [docs/QUEUE_AND_WORKER_GUIDE.md](./docs/QUEUE_AND_WORKER_GUIDE.md) | Background jobs, cron sweeper, worker |
| [docs/META_INTEGRATION_GUIDE.md](./docs/META_INTEGRATION_GUIDE.md) | Meta app, webhooks and Instagram setup |
| [docs/WHATSAPP_INTEGRATION_GUIDE.md](./docs/WHATSAPP_INTEGRATION_GUIDE.md) | WhatsApp Business Platform connection |
| [docs/PAYSTACK_BILLING_GUIDE.md](./docs/PAYSTACK_BILLING_GUIDE.md) | Subscription payments, webhooks, lifecycle |
| [docs/TEST_REPORT.md](./docs/TEST_REPORT.md) | What is tested and the latest results |
| [CHANGELOG.md](./CHANGELOG.md) | Changes by phase |

## Local development

```bash
docker run -d --name sunleon-db -e POSTGRES_USER=sunleon -e POSTGRES_PASSWORD=sunleon_dev_pw \
  -e POSTGRES_DB=sunleon -p 5440:5432 pgvector/pgvector:pg17
cp .env.example .env          # then fill AUTH_SECRET, ENCRYPTION_KEY (see comments)
npm install
npx prisma migrate deploy && npm run db:seed
npm run dev                   # http://localhost:3000
npm test                      # unit + integration (needs database "sunleon_test")
```
