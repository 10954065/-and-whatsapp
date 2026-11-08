import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type TenantTx = Prisma.TransactionClient;

const TENANT_ROLE = "sunleon_tenant";

/**
 * Runs `fn` inside a transaction restricted by PostgreSQL row-level security to one
 * business (see prisma/migrations/*_integrity_and_rls). Even a query that forgets its
 * `businessId` filter cannot read or write another tenant's rows here.
 *
 * Application code must still filter by businessId — RLS is the second line of defence.
 */
export async function withTenantTx<T>(
  businessId: string,
  fn: (tx: TenantTx) => Promise<T>,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  if (!businessId) throw new Error("withTenantTx requires a businessId");
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${TENANT_ROLE}`);
      await tx.$queryRaw`SELECT set_config('app.business_id', ${businessId}, true)`;
      return fn(tx);
    },
    { maxWait: 5_000, timeout: options.timeoutMs ?? 15_000 },
  );
}
