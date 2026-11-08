# SUNLEON AI — Database Schema

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma) plus the hand-written SQL in
[`prisma/migrations/*_integrity_and_rls`](../prisma/migrations).

## Conventions

| Convention | Detail |
| --- | --- |
| Identifiers | `cuid2` strings (`@default(cuid(2))`). |
| Money | Integer minor units (`*Minor`, pesewas for GHS) + ISO currency. Never floats. |
| Time | UTC `TIMESTAMP(3)`; business-local rendering uses `Business.timezone`. |
| Tenancy | Every tenant row has `businessId` with `onDelete: Cascade` from `Business`. |
| Soft delete | `deletedAt` on `User`, `Business`, `Customer`, `Product`, `KnowledgeSource`. |
| Secrets | Integration credentials (`Integration.credentialsEnc`) and TOTP secrets (`User.mfaSecretEnc`) are AES-256-GCM encrypted. Session/verification/invitation tokens are stored only as HMAC-SHA256 hashes. |

## Domains

| Domain | Models |
| --- | --- |
| Identity | `User`, `Session`, `AuthToken`, `MfaRecoveryCode`, `OAuthState` |
| Tenancy | `Business`, `BusinessSettings`, `BusinessMembership`, `Invitation`, `AuditLog` |
| Billing | `SubscriptionPlan`, `Subscription`, `PaymentTransaction`, `UsageCounter`, `AiUsageRecord` |
| Channels | `Integration`, `WebhookEvent`, `MessageTemplate` |
| CRM | `Customer`, `CustomerIdentity`, `CustomerNote`, `ConsentRecord`, `Lead`, `FollowUpTask` |
| Messaging | `Conversation`, `Message`, `ConversationNote` |
| AI | `AiAgent`, `PromptVersion`, `AiRun`, `AiAction`, `ApprovalRequest` |
| Knowledge | `KnowledgeSource`, `KnowledgeChunk` (`embedding vector(1024)`) |
| Commerce | `ProductCategory`, `Product`, `ProductVariant`, `StockMovement`, `Discount`, `BusinessCounter`, `Order`, `OrderItem` |
| Bookings | `Service`, `StaffMember`, `StaffService`, `WorkingHours`, `TimeOff`, `Booking` |
| Automation | `Workflow`, `WorkflowVersion`, `WorkflowRun` |
| Operations | `Job`, `RateLimitBucket`, `Notification`, `Announcement`, `PlatformSetting`, `ErrorEvent`, `EmailLog`, `DataRequest`, `SupportNote`, `ContactInquiry` |

## Objects outside Prisma's model (hand-written SQL)

| Object | Purpose |
| --- | --- |
| Extensions `vector`, `btree_gist`, `pg_trgm` | Embeddings, exclusion constraints, fuzzy search. Created at the top of the `init` migration. |
| CHECK constraints | Non-negative stock, prices and order amounts; valid discount ranges; valid working-hour ranges; booking/time-off ranges; job attempts. |
| `Booking_no_overlap` | `EXCLUDE USING gist (staffId WITH =, tsrange(startsAt, blockedUntil) WITH &&) WHERE status IN ('PENDING','CONFIRMED')` — the database itself rejects double bookings. |
| Role `sunleon_tenant` | `NOLOGIN NOBYPASSRLS`; DML privileges on application tables except `Session`, `AuthToken`, `MfaRecoveryCode`, `PlatformSetting`, `RateLimitBucket`. |
| Function `app_current_business_id()` | Returns `current_setting('app.business_id')`; raises if unset (fail closed). |
| Policies `tenant_isolation` | On `Business` (`id = …`) and every table with `businessId` (`businessId = …`), applying to `sunleon_tenant`. `Job` also allows `businessId IS NULL`. |

`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma`
reports no drift: Prisma ignores these objects, so future migrations will not drop them.

### Adding a tenant table

Add the model with a `businessId` column, generate the migration with
`prisma migrate dev --create-only`, then append to it:

```sql
ALTER TABLE "NewTable" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "NewTable" TO sunleon_tenant
  USING ("businessId" = app_current_business_id())
  WITH CHECK ("businessId" = app_current_business_id());
```

Grants are inherited through `ALTER DEFAULT PRIVILEGES`.

## Indexes

Every tenant table is indexed by `businessId` plus its dominant sort/filter column
(e.g. `Conversation(businessId, lastMessageAt DESC)`, `Order(businessId, createdAt)`,
`Booking(staffId, startsAt)`). Provider ids are unique for deduplication:
`Message(channel, providerMessageId)`, `WebhookEvent.dedupeKey`, `Job.idempotencyKey`,
`Integration(channel, externalAccountId)`, `PaymentTransaction.reference`.
