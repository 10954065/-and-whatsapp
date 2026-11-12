import { cookies } from "next/headers";
import type { PlatformRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { hashToken, randomToken } from "@/lib/security/crypto";

const DAY_MS = 86_400_000;
const SESSION_TTL_MS = 30 * DAY_MS;
const RENEW_WHEN_REMAINING_MS = 15 * DAY_MS;
const LAST_SEEN_THROTTLE_MS = 5 * 60_000;
// The database row is the source of truth for expiry; the cookie simply outlives it.
const COOKIE_MAX_AGE_SECONDS = 400 * 86_400;

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sl_session" : "sl_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  platformRole: PlatformRole;
  mfaEnabled: boolean;
}

export interface ValidatedSession {
  sessionId: string;
  expiresAt: Date;
  mfaVerified: boolean;
  user: SessionUser;
}

export interface NewSessionMeta {
  ipAddress: string | null;
  userAgent: string | null;
  mfaVerified: boolean;
}

export async function createSession(userId: string, meta: NewSessionMeta): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      mfaVerified: meta.mfaVerified,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  return { token, expiresAt };
}

/** Validates a raw session token, sliding the expiry window when it is past half-life. */
export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  if (!token || token.length > 128) return null;
  const sessionId = hashToken(token);
  const row = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerifiedAt: true,
          platformRole: true,
          mfaEnabled: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now || row.user.deletedAt) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
    return null;
  }

  let expiresAt = row.expiresAt;
  const renew = row.expiresAt.getTime() - now < RENEW_WHEN_REMAINING_MS;
  const touch = now - row.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;
  if (renew || touch) {
    expiresAt = renew ? new Date(now + SESSION_TTL_MS) : row.expiresAt;
    await prisma.session.update({ where: { id: sessionId }, data: { expiresAt, lastSeenAt: new Date(now) } });
  }

  const user: SessionUser = {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    emailVerifiedAt: row.user.emailVerifiedAt,
    platformRole: row.user.platformRole,
    mfaEnabled: row.user.mfaEnabled,
  };
  return { sessionId, expiresAt, mfaVerified: row.mfaVerified, user };
}

export async function markSessionMfaVerified(sessionId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { mfaVerified: true } });
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** Signs a user out everywhere (optionally keeping the current session). */
export async function invalidateUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

export async function purgeExpiredSessions(now: Date = new Date()): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}

export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Setting the session cookie makes Next.js re-render the sign-in page, which would redirect a
 * signed-in visitor at once and cut the welcome animation short. This short-lived marker tells
 * the sign-in and sign-up pages to stay put while the browser plays it and then navigates.
 */
const ARRIVAL_COOKIE = "sl_arriving";
const ARRIVAL_SECONDS = 8;

export async function markArrival(): Promise<void> {
  const store = await cookies();
  store.set(ARRIVAL_COOKIE, "1", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ARRIVAL_SECONDS });
}

export async function isArriving(): Promise<boolean> {
  const store = await cookies();
  return store.has(ARRIVAL_COOKIE);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
