-- SUNLEON AI: integrity constraints and row-level security.
-- Prisma does not model CHECK/EXCLUDE constraints, roles or policies, so they live here.
-- New tenant tables added in later migrations must be added to the RLS loop below
-- (copy the block into the new migration).

-- ───────────────────────── Integrity constraints ─────────────────────────

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_stock_nonnegative" CHECK ("stockQuantity" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_amounts_nonnegative" CHECK ("unitPriceMinor" >= 0 AND "lineTotalMinor" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amounts_nonnegative"
  CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "deliveryFeeMinor" >= 0 AND "totalMinor" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_price_nonnegative" CHECK ("priceMinor" >= 0);

ALTER TABLE "Discount"
  ADD CONSTRAINT "Discount_value_valid" CHECK ("value" >= 0 AND ("type" <> 'PERCENT' OR "value" <= 100));

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_duration_valid" CHECK ("durationMinutes" > 0 AND "bufferMinutes" >= 0);

ALTER TABLE "WorkingHours"
  ADD CONSTRAINT "WorkingHours_range_valid"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute");

ALTER TABLE "TimeOff"
  ADD CONSTRAINT "TimeOff_range_valid" CHECK ("endsAt" > "startsAt");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_range_valid" CHECK ("endsAt" > "startsAt" AND "blockedUntil" >= "endsAt");

-- Database-level double-booking guard: two active bookings for the same staff member
-- can never overlap (timestamps are stored as UTC TIMESTAMP(3), hence tsrange).
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist ("staffId" WITH =, tsrange("startsAt", "blockedUntil", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_attempts_valid" CHECK ("attempts" >= 0 AND "maxAttempts" >= 1);

-- ─────────────────────────── Row-level security ───────────────────────────
-- Tenant transactions (src/lib/db/tenant.ts → withTenantTx) run
--   SET LOCAL ROLE sunleon_tenant;
--   SELECT set_config('app.business_id', '<id>', true);
-- sunleon_tenant has no BYPASSRLS and owns nothing, so the policies below always
-- apply to it. Missing app.business_id raises an error (fail closed).
-- System code paths (webhook routing, jobs, platform admin) run as the connection
-- owner role, which is not subject to these policies.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sunleon_tenant') THEN
    CREATE ROLE sunleon_tenant NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- Allow the migrating (owner) role to switch into the tenant role.
DO $$
BEGIN
  EXECUTE format('GRANT sunleon_tenant TO %I', current_user);
END
$$;

GRANT USAGE ON SCHEMA public TO sunleon_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sunleon_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sunleon_tenant;

-- Credentials and platform internals are never reachable from a tenant transaction.
REVOKE ALL ON "Session", "AuthToken", "MfaRecoveryCode", "PlatformSetting", "RateLimitBucket"
  FROM sunleon_tenant;

CREATE OR REPLACE FUNCTION app_current_business_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.business_id') $$;

-- The tenant itself.
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Business" TO sunleon_tenant
  USING ("id" = app_current_business_id())
  WITH CHECK ("id" = app_current_business_id());

-- Every table that carries a businessId column.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'BusinessSettings', 'BusinessMembership', 'Invitation', 'AuditLog',
    'Subscription', 'PaymentTransaction', 'UsageCounter', 'AiUsageRecord',
    'Integration', 'OAuthState', 'MessageTemplate',
    'Customer', 'CustomerIdentity', 'CustomerNote', 'ConsentRecord', 'Lead', 'FollowUpTask',
    'Conversation', 'Message', 'ConversationNote',
    'AiAgent', 'AiRun', 'AiAction', 'ApprovalRequest',
    'KnowledgeSource', 'KnowledgeChunk',
    'ProductCategory', 'Product', 'ProductVariant', 'StockMovement', 'Discount',
    'BusinessCounter', 'Order', 'OrderItem',
    'Service', 'StaffMember', 'StaffService', 'WorkingHours', 'TimeOff', 'Booking',
    'Workflow', 'WorkflowVersion', 'WorkflowRun',
    'Notification', 'DataRequest', 'SupportNote'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO sunleon_tenant
         USING ("businessId" = app_current_business_id())
         WITH CHECK ("businessId" = app_current_business_id())',
      t
    );
  END LOOP;
END
$$;

-- Jobs and webhook events are written from tenant transactions but only for the
-- current tenant (or with no tenant).
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Job" TO sunleon_tenant
  USING ("businessId" IS NULL OR "businessId" = app_current_business_id())
  WITH CHECK ("businessId" IS NULL OR "businessId" = app_current_business_id());
