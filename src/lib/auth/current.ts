import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { fail } from "@/lib/monitoring/errors";
import { readSessionToken, validateSessionToken, type ValidatedSession } from "@/lib/auth/session";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

/** The current request's session, memoised for the duration of the request. */
export const getCurrentSession = cache(async (): Promise<ValidatedSession | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSessionToken(token);
});

interface RequireUserOptions {
  /** Allow a session whose second factor has not been verified yet (MFA page only). */
  allowPendingMfa?: boolean;
}

function isFullyAuthenticated(session: ValidatedSession): boolean {
  return !session.user.mfaEnabled || session.mfaVerified;
}

/** For pages and layouts: redirects instead of throwing. */
export async function requireUser(options: RequireUserOptions = {}): Promise<ValidatedSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!options.allowPendingMfa && !isFullyAuthenticated(session)) redirect("/login/mfa");
  return session;
}

/**
 * For Server Actions and Route Handlers: throws a user-safe AppError. Every signed-in action passes
 * through here, so this is also where one person's overall pace is capped.
 */
export async function requireUserForAction(options: RequireUserOptions = {}): Promise<ValidatedSession> {
  const session = await getCurrentSession();
  if (!session) throw fail.unauthenticated();
  if (!options.allowPendingMfa && !isFullyAuthenticated(session)) throw fail.unauthenticated();
  await enforceRateLimit(RATE_LIMITS.actionsPerUser, session.user.id);
  return session;
}

/** Platform administration is invisible (404) to everyone except super-admins. */
export async function requireSuperAdmin(): Promise<ValidatedSession> {
  const session = await requireUser();
  if (session.user.platformRole !== "SUPER_ADMIN") notFound();
  return session;
}

/**
 * For admin pages (pages render independently of their layout, so each page checks itself):
 * 404 for non-admins, null when two-factor authentication isn't active on this session.
 */
export async function requireAdminConsole(): Promise<ValidatedSession | null> {
  const session = await requireSuperAdmin();
  return session.user.mfaEnabled && session.mfaVerified ? session : null;
}

export async function requireSuperAdminForAction(): Promise<ValidatedSession> {
  const session = await requireUserForAction();
  if (session.user.platformRole !== "SUPER_ADMIN") throw fail.forbidden();
  return session;
}
