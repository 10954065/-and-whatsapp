import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { BusinessStatus, Industry, MemberRole } from "@/generated/prisma/enums";
import { can, type Permission } from "@/config/permissions";
import { prisma } from "@/lib/db/prisma";
import { fail } from "@/lib/monitoring/errors";
import { getCurrentSession, requireUser, requireUserForAction } from "@/lib/auth/current";
import type { SessionUser } from "@/lib/auth/session";

export const ACTIVE_BUSINESS_COOKIE = "sl_business";

export interface TenantBusiness {
  id: string;
  name: string;
  slug: string;
  industry: Industry;
  timezone: string;
  currency: string;
  status: BusinessStatus;
  onboardingCompletedAt: Date | null;
}

/**
 * Proof that the current user is an active member of `businessId`. Only produced by
 * this module after a database membership check — never from browser input alone.
 */
export interface TenantContext {
  sessionId: string;
  user: SessionUser;
  businessId: string;
  business: TenantBusiness;
  membershipId: string;
  role: MemberRole;
  can(permission: Permission): boolean;
}

const businessSelect = {
  id: true,
  name: true,
  slug: true,
  industry: true,
  timezone: true,
  currency: true,
  status: true,
  onboardingCompletedAt: true,
} as const;

export async function listUserMemberships(userId: string) {
  return prisma.businessMembership.findMany({
    where: { userId, status: "ACTIVE", business: { deletedAt: null } },
    select: { id: true, role: true, businessId: true, business: { select: businessSelect } },
    orderBy: { createdAt: "asc" },
  });
}

/** Resolves the active workspace from the cookie, re-verifying membership every request. */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const session = await getCurrentSession();
  if (!session) return null;
  if (session.user.mfaEnabled && !session.mfaVerified) return null;

  const memberships = await listUserMemberships(session.user.id);
  if (memberships.length === 0) return null;

  const store = await cookies();
  const preferredId = store.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const membership = memberships.find((entry) => entry.businessId === preferredId) ?? memberships[0];
  const role = membership.role;

  return {
    sessionId: session.sessionId,
    user: session.user,
    businessId: membership.businessId,
    business: membership.business,
    membershipId: membership.id,
    role,
    can: (permission: Permission) => can(role, permission),
  };
});

/** For pages and layouts under /app. */
export async function requireTenant(): Promise<TenantContext> {
  await requireUser();
  const context = await getTenantContext();
  if (!context) redirect("/onboarding");
  return context;
}

/** For tenant Server Actions and Route Handlers. */
export async function requireTenantAction(permission?: Permission): Promise<TenantContext> {
  await requireUserForAction();
  const context = await getTenantContext();
  if (!context) throw fail.precondition("Create or join a business workspace first.");
  if (context.business.status !== "ACTIVE") throw fail.forbidden("This workspace is suspended.");
  if (permission && !context.can(permission)) throw fail.forbidden();
  return context;
}

export function assertPermission(context: TenantContext, permission: Permission): void {
  if (!context.can(permission)) throw fail.forbidden();
}

/** Request-independent identity passed to services (keeps services testable). */
export interface TenantActor {
  userId: string;
  userName: string;
  emailVerified: boolean;
  businessId: string;
  businessName: string;
  role: MemberRole;
  ipAddress: string | null;
}

export function toActor(context: TenantContext, ipAddress: string | null = null): TenantActor {
  return {
    userId: context.user.id,
    userName: context.user.name,
    emailVerified: Boolean(context.user.emailVerifiedAt),
    businessId: context.businessId,
    businessName: context.business.name,
    role: context.role,
    ipAddress,
  };
}

/** Sets the active workspace after verifying the user belongs to it. */
export async function setActiveBusiness(userId: string, businessId: string): Promise<void> {
  const membership = await prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") throw fail.forbidden();
  const store = await cookies();
  store.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
}
