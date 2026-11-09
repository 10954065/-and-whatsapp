import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { invalidateUserSessions } from "@/lib/auth/session";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { randomToken } from "@/lib/security/crypto";
import { storage } from "@/lib/storage";
import { recordAudit } from "@/modules/administration/audit.service";
import { notifyTeam } from "@/modules/notifications/notification.service";

/** Days between a workspace deletion request and the permanent purge (the owner can cancel). */
export const DELETION_GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

function assertOwner(actor: TenantActor): void {
  if (actor.role !== "OWNER") throw fail.forbidden("Only the workspace owner can do this.");
}

/**
 * Everything the workspace holds about its business and customers, as plain JSON. Secrets
 * (channel tokens, password hashes, MFA data) and internal AI telemetry are never included.
 */
export async function exportBusinessData(actor: TenantActor) {
  assertOwner(actor);
  const businessId = actor.businessId;
  const where = { businessId };
  const [business, settings, members, customers, conversations, leads, tasks, products, orders, services, staff, bookings, knowledge, workflows, payments, subscription] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.businessSettings.findUnique({ where }),
    prisma.businessMembership.findMany({ where, select: { role: true, status: true, createdAt: true, user: { select: { name: true, email: true } } } }),
    prisma.customer.findMany({ where, include: { identities: { select: { channel: true, externalId: true, handle: true, profileName: true, consentStatus: true, createdAt: true } }, notes: { select: { body: true, createdAt: true } } } }),
    prisma.conversation.findMany({
      where,
      select: { id: true, channel: true, status: true, customerId: true, createdAt: true, messages: { orderBy: { createdAt: "asc" }, select: { direction: true, sender: true, type: true, text: true, deliveryStatus: true, createdAt: true } } },
    }),
    prisma.lead.findMany({ where }),
    prisma.followUpTask.findMany({ where }),
    prisma.product.findMany({ where, include: { variants: true } }),
    prisma.order.findMany({ where, include: { items: true } }),
    prisma.service.findMany({ where }),
    prisma.staffMember.findMany({ where, include: { workingHours: true } }),
    prisma.booking.findMany({ where }),
    prisma.knowledgeSource.findMany({ where: { ...where, deletedAt: null }, select: { type: true, title: true, question: true, content: true, fileName: true, sourceUrl: true, status: true, createdAt: true } }),
    prisma.workflow.findMany({ where, include: { versions: { select: { version: true, definition: true, createdAt: true } } } }),
    prisma.paymentTransaction.findMany({ where, select: { reference: true, purpose: true, amountMinor: true, currency: true, status: true, paidAt: true, createdAt: true } }),
    prisma.subscription.findUnique({ where, include: { plan: { select: { code: true, name: true } } } }),
  ]);
  await prisma.dataRequest.create({ data: { userId: actor.userId, businessId, type: "EXPORT", status: "COMPLETED", completedAt: new Date() } });
  await recordAudit({ businessId, actorType: "USER", actorId: actor.userId, action: "privacy.export_downloaded", ipAddress: actor.ipAddress });
  return {
    exportedAt: new Date().toISOString(),
    format: "sunleon-ai-export/1",
    business: { ...business, onboardingState: undefined },
    settings,
    subscription,
    members,
    customers,
    conversations,
    leads,
    tasks,
    products,
    orders,
    services,
    staff,
    bookings,
    knowledge,
    workflows,
    payments,
  };
}

export async function getPendingDeletion(businessId: string): Promise<{ requestedAt: Date; purgeAfter: Date } | null> {
  const request = await prisma.dataRequest.findFirst({ where: { businessId, type: "DELETION", status: "PENDING" }, orderBy: { requestedAt: "desc" } });
  return request ? { requestedAt: request.requestedAt, purgeAfter: new Date(request.requestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS) } : null;
}

export const deletionRequestSchema = z.object({ confirmName: z.string().trim().min(1, "Type the workspace name to confirm.") });

/** Schedules permanent deletion after the grace period; the workspace keeps working until then. */
export async function requestWorkspaceDeletion(actor: TenantActor, input: z.infer<typeof deletionRequestSchema>) {
  assertOwner(actor);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: { name: true } });
  if (input.confirmName !== business.name) throw fail.validation("The name doesn't match.", { confirmName: ["Type the workspace name exactly as shown."] });
  if (await getPendingDeletion(actor.businessId)) throw fail.conflict("Deletion is already scheduled for this workspace.");
  await prisma.dataRequest.create({ data: { userId: actor.userId, businessId: actor.businessId, type: "DELETION" } });
  await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "privacy.deletion_requested", ipAddress: actor.ipAddress });
  await notifyTeam({
    businessId: actor.businessId,
    kind: "billing",
    title: `This workspace will be deleted in ${DELETION_GRACE_DAYS} days`,
    body: "The owner asked to delete the workspace and all its data. The owner can cancel from Settings before then.",
    link: "/app/settings#data",
  });
}

export async function cancelWorkspaceDeletion(actor: TenantActor) {
  assertOwner(actor);
  const result = await prisma.dataRequest.deleteMany({ where: { businessId: actor.businessId, type: "DELETION", status: "PENDING" } });
  if (!result.count) throw fail.notFound("Scheduled deletion");
  await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "privacy.deletion_cancelled", ipAddress: actor.ipAddress });
}

/** Permanently removes one workspace and its stored files. */
async function purgeBusiness(businessId: string): Promise<void> {
  const [business, files] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    prisma.knowledgeSource.findMany({ where: { businessId, fileKey: { not: null } }, select: { fileKey: true } }),
  ]);
  if (!business) return;
  for (const file of files) {
    await storage()
      .delete(file.fileKey!)
      .catch((error: unknown) => logger.warn("privacy.file_delete_failed", { businessId, error }));
  }
  // Rows with RESTRICT foreign keys (bookings → services/staff/customers, orders → customers,
  // order items → variants) go first; the business delete cascades everything else.
  await prisma.$transaction([
    prisma.booking.deleteMany({ where: { businessId } }),
    prisma.orderItem.deleteMany({ where: { businessId } }),
    prisma.order.deleteMany({ where: { businessId } }),
    prisma.business.delete({ where: { id: businessId } }),
  ]);
  // Audit rows survive with businessId set to null; this one records what was removed.
  await recordAudit({ actorType: "SYSTEM", action: "privacy.workspace_purged", entityType: "Business", entityId: businessId, metadata: { name: business.name } });
}

/** Daily: purges workspaces whose deletion grace period has passed. */
export async function processScheduledDeletions(now: Date = new Date()): Promise<number> {
  const due = await prisma.dataRequest.findMany({
    where: { type: "DELETION", status: "PENDING", businessId: { not: null }, requestedAt: { lte: new Date(now.getTime() - DELETION_GRACE_DAYS * DAY_MS) } },
    select: { id: true, businessId: true },
    take: 20,
  });
  let purged = 0;
  for (const request of due) {
    try {
      await prisma.dataRequest.update({ where: { id: request.id }, data: { status: "PROCESSING" } });
      await purgeBusiness(request.businessId!);
      purged += 1;
    } catch (error) {
      await prisma.dataRequest.updateMany({ where: { id: request.id }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "unknown" } });
      await reportError(error, { source: "privacy.purge", businessId: request.businessId });
    }
  }
  return purged;
}

/** Daily: deletes message content older than each business's retention setting (0 = keep). */
export async function purgeExpiredMessages(now: Date = new Date()): Promise<number> {
  const policies = await prisma.businessSettings.findMany({ where: { messageRetentionDays: { gt: 0 } }, select: { businessId: true, messageRetentionDays: true } });
  let deleted = 0;
  for (const policy of policies) {
    const cutoff = new Date(now.getTime() - policy.messageRetentionDays * DAY_MS);
    const result = await prisma.message.deleteMany({ where: { businessId: policy.businessId, createdAt: { lt: cutoff } } });
    deleted += result.count;
  }
  return deleted;
}

export const accountDeletionSchema = z.object({ password: z.string().min(1, "Enter your password to confirm.") });

/**
 * Deletes the signed-in user's account: blocked while they own a workspace (delete it or hand it
 * over first). The row is kept for referential integrity but stripped of personal data.
 */
export async function deleteUserAccount(userId: string, input: z.infer<typeof accountDeletionSchema>, ipAddress: string | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, deletedAt: true } });
  if (user.deletedAt) throw fail.notFound("Account");
  if (!(await verifyPassword(user.passwordHash, input.password))) throw fail.validation("That password is incorrect.", { password: ["Incorrect password."] });
  const owned = await prisma.businessMembership.count({ where: { userId, role: "OWNER", status: "ACTIVE", business: { deletedAt: null } } });
  if (owned > 0) throw fail.precondition("You own a workspace. Delete it (Settings → Your data) or make someone else the owner first.");

  await prisma.$transaction([
    prisma.businessMembership.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.authToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        name: "Deleted user",
        passwordHash: await hashPassword(randomToken(32)),
        mfaEnabled: false,
        mfaSecretEnc: null,
        platformRole: "USER",
        deletedAt: new Date(),
      },
    }),
  ]);
  await invalidateUserSessions(userId);
  await recordAudit({ actorType: "USER", actorId: userId, action: "privacy.account_deleted", ipAddress });
}
