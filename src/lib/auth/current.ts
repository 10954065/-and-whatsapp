import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { fail } from "@/lib/monitoring/errors";
import { readSessionToken, validateSessionToken, type ValidatedSession } from "@/lib/auth/session";

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

/** For Server Actions and Route Handlers: throws a user-safe AppError. */
export async function requireUserForAction(options: RequireUserOptions = {}): Promise<ValidatedSession> {
  const session = await getCurrentSession();
  if (!session) throw fail.unauthenticated();
  if (!options.allowPendingMfa && !isFullyAuthenticated(session)) throw fail.unauthenticated();
  return session;
}

/** Platform administration is invisible (404) to everyone except super-admins. */
export async function requireSuperAdmin(): Promise<ValidatedSession> {
  const session = await requireUser();
  if (session.user.platformRole !== "SUPER_ADMIN") notFound();
  return session;
}

export async function requireSuperAdminForAction(): Promise<ValidatedSession> {
  const session = await requireUserForAction();
  if (session.user.platformRole !== "SUPER_ADMIN") throw fail.forbidden();
  return session;
}
