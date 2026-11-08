import type { Prisma } from "@/generated/prisma/client";
import type { ActorType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { redact } from "@/lib/monitoring/logger";

export interface AuditEntry {
  businessId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Appends to the audit trail. Pass the transaction client to make the audit entry
 * atomic with the change it describes.
 */
export async function recordAudit(entry: AuditEntry, db: AuditWriter = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      businessId: entry.businessId ?? null,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
