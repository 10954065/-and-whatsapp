import { z } from "zod";
import type { MemberRole } from "@/generated/prisma/enums";
import { assignableRoles, ROLE_LABELS } from "@/config/permissions";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/email/templates";
import { fail } from "@/lib/monitoring/errors";
import { hashToken, randomToken } from "@/lib/security/crypto";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import type { TenantActor } from "@/lib/auth/tenant";
import { recordAudit } from "@/modules/administration/audit.service";
import { emailSchema } from "@/modules/auth/auth.schemas";

const INVITATION_TTL_MS = 7 * 86_400_000;
const MEMBER_ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF", "READONLY"] as const;

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBER_ROLES, { error: "Choose a role." }),
});

export const changeRoleSchema = z.object({
  membershipId: z.string().min(1).max(64),
  role: z.enum(MEMBER_ROLES),
});

export const idSchema = z.object({ id: z.string().min(1).max(64) });

export async function listTeam(businessId: string) {
  const [members, invitations] = await Promise.all([
    prisma.businessMembership.findMany({
      where: { businessId },
      include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { businessId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { members, invitations };
}

function assertCanAssign(actor: TenantActor, role: MemberRole): void {
  if (!assignableRoles(actor.role).includes(role)) {
    throw fail.forbidden(`Your role can't assign the ${ROLE_LABELS[role]} role.`);
  }
}

export async function inviteMember(actor: TenantActor, input: z.infer<typeof inviteSchema>): Promise<void> {
  if (!actor.emailVerified) throw fail.precondition("Confirm your email address before inviting your team.");
  assertCanAssign(actor, input.role);
  await enforceRateLimit(RATE_LIMITS.invitation, actor.businessId);

  const existingUser = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existingUser) {
    const membership = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: actor.businessId, userId: existingUser.id } },
    });
    if (membership) throw fail.conflict("That person is already a member of this workspace.");
  }

  const token = randomToken(32);
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.invitation.updateMany({
      where: { businessId: actor.businessId, email: input.email, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    const invitation = await tx.invitation.create({
      data: {
        businessId: actor.businessId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedById: actor.userId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
    await recordAudit(
      {
        businessId: actor.businessId,
        actorType: "USER",
        actorId: actor.userId,
        action: "team.invited",
        entityType: "Invitation",
        entityId: invitation.id,
        metadata: { role: input.role },
        ipAddress: actor.ipAddress,
      },
      tx,
    );
  });

  await sendEmail(
    invitationEmail({
      to: input.email,
      businessName: actor.businessName,
      inviterName: actor.userName,
      roleLabel: ROLE_LABELS[input.role],
      url: `${env().APP_URL}/invite/${token}`,
      businessId: actor.businessId,
    }),
  );
}

export async function revokeInvitation(actor: TenantActor, invitationId: string): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    const result = await tx.invitation.updateMany({
      where: { id: invitationId, businessId: actor.businessId, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    if (result.count === 0) throw fail.notFound("Invitation");
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "team.invitation_revoked", entityType: "Invitation", entityId: invitationId },
      tx,
    );
  });
}

async function loadManageableMembership(actor: TenantActor, membershipId: string) {
  const membership = await prisma.businessMembership.findFirst({
    where: { id: membershipId, businessId: actor.businessId },
  });
  if (!membership) throw fail.notFound("Member");
  if (membership.userId === actor.userId) throw fail.forbidden("You can't change your own membership here.");
  if (!assignableRoles(actor.role).includes(membership.role)) {
    throw fail.forbidden(`Your role can't manage a ${ROLE_LABELS[membership.role]}.`);
  }
  return membership;
}

export async function changeMemberRole(actor: TenantActor, membershipId: string, role: MemberRole): Promise<void> {
  const membership = await loadManageableMembership(actor, membershipId);
  assertCanAssign(actor, role);
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.businessMembership.update({ where: { id: membership.id }, data: { role } });
    await recordAudit(
      {
        businessId: actor.businessId,
        actorType: "USER",
        actorId: actor.userId,
        action: "team.role_changed",
        entityType: "BusinessMembership",
        entityId: membership.id,
        metadata: { from: membership.role, to: role },
        ipAddress: actor.ipAddress,
      },
      tx,
    );
  });
}

export async function removeMember(actor: TenantActor, membershipId: string): Promise<void> {
  const membership = await loadManageableMembership(actor, membershipId);
  await withTenantTx(actor.businessId, async (tx) => {
    // Access ends immediately: membership is re-verified from the database on every request.
    await tx.businessMembership.delete({ where: { id: membership.id } });
    await recordAudit(
      {
        businessId: actor.businessId,
        actorType: "USER",
        actorId: actor.userId,
        action: "team.member_removed",
        entityType: "BusinessMembership",
        entityId: membership.id,
        metadata: { userId: membership.userId, role: membership.role },
        ipAddress: actor.ipAddress,
      },
      tx,
    );
  });
}

export async function findInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { business: { select: { id: true, name: true, deletedAt: true } }, invitedBy: { select: { name: true } } },
  });
  if (!invitation || invitation.business.deletedAt) return null;
  const isUsable = invitation.status === "PENDING" && invitation.expiresAt.getTime() > Date.now();
  return { invitation, isUsable };
}

/**
 * Accepts an invitation for the signed-in user. The account email must match the
 * invited address; possession of the emailed token also proves mailbox ownership.
 */
export async function acceptInvitation(user: { id: string; email: string }, token: string): Promise<{ businessId: string }> {
  const found = await findInvitation(token);
  if (!found || !found.isUsable) throw fail.validation("This invitation is no longer valid. Ask for a new one.");
  const { invitation } = found;
  if (invitation.email !== user.email.toLowerCase()) {
    throw fail.forbidden(`This invitation was sent to ${invitation.email}. Sign in with that email to accept it.`);
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw fail.validation("This invitation has already been used.");
    await tx.businessMembership.upsert({
      where: { businessId_userId: { businessId: invitation.businessId, userId: user.id } },
      update: { role: invitation.role, status: "ACTIVE" },
      create: { businessId: invitation.businessId, userId: user.id, role: invitation.role },
    });
    await tx.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    await recordAudit(
      {
        businessId: invitation.businessId,
        actorType: "USER",
        actorId: user.id,
        action: "team.invitation_accepted",
        entityType: "Invitation",
        entityId: invitation.id,
        metadata: { role: invitation.role },
      },
      tx,
    );
  });
  return { businessId: invitation.businessId };
}
