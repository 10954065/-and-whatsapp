import type { TokenPurpose } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail, verificationEmail } from "@/lib/email/templates";
import { AppError, fail } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";
import { hashToken, randomToken } from "@/lib/security/crypto";
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from "@/lib/security/password";
import { consumeRateLimit, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { invalidateUserSessions } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { recordAudit } from "@/modules/administration/audit.service";
import type { LoginInput, RegisterInput } from "@/modules/auth/auth.schemas";

const HOUR_MS = 3_600_000;
const EMAIL_VERIFICATION_TTL_MS = 24 * HOUR_MS;
const PASSWORD_RESET_TTL_MS = HOUR_MS;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function bootstrapAdminEmails(): Set<string> {
  return new Set(
    (env().PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  );
}

const invalidCredentials = () => new AppError("UNAUTHENTICATED", "Incorrect email or password.");

async function issueToken(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = randomToken(32);
  await prisma.authToken.create({
    data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

/** Marks a token used exactly once; concurrent attempts lose the race and fail. */
async function consumeToken(token: string, purpose: TokenPurpose): Promise<{ userId: string }> {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.purpose !== purpose) {
    throw fail.validation("This link is invalid. Request a new one.");
  }
  if (record.usedAt) throw fail.validation("This link has already been used.");
  if (record.expiresAt.getTime() < Date.now()) throw fail.validation("This link has expired. Request a new one.");
  const claimed = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) throw fail.validation("This link has already been used.");
  return { userId: record.userId };
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }): Promise<void> {
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", EMAIL_VERIFICATION_TTL_MS);
  await sendEmail(verificationEmail({ to: user.email, name: user.name, url: `${env().APP_URL}/verify-email?token=${token}` }));
}

export async function registerUser(input: RegisterInput, meta: RequestMeta): Promise<{ userId: string }> {
  await enforceRateLimit(RATE_LIMITS.register, meta.ipAddress ?? "unknown");
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw fail.conflict("An account with this email already exists. Sign in instead.");

  const user = await prisma.user.create({
    data: { email, name: input.name.trim(), passwordHash: await hashPassword(input.password) },
    select: { id: true, email: true, name: true },
  });
  await recordAudit({ actorType: "USER", actorId: user.id, action: "user.registered", ipAddress: meta.ipAddress });
  await sendVerificationEmail(user);
  logger.info("user.registered", { userId: user.id });
  return { userId: user.id };
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  await enforceRateLimit(RATE_LIMITS.verificationEmail, userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user) throw fail.notFound("Account");
  if (user.emailVerifiedAt) return;
  await sendVerificationEmail(user);
}

/**
 * Confirms an email address. Addresses listed in PLATFORM_ADMIN_EMAILS are promoted
 * to super-admin only here — after ownership of the mailbox has been proven.
 */
export async function verifyEmail(token: string): Promise<{ userId: string }> {
  const { userId } = await consumeToken(token, "EMAIL_VERIFICATION");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const promote = bootstrapAdminEmails().has(user.email);
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date(), ...(promote ? { platformRole: "SUPER_ADMIN" } : {}) },
  });
  await recordAudit({ actorType: "USER", actorId: userId, action: "user.email_verified", metadata: { promotedToAdmin: promote } });
  return { userId };
}

/** Password authentication with per-IP/per-account rate limits and temporary lockout. */
export async function authenticate(
  input: LoginInput,
  meta: RequestMeta,
): Promise<{ userId: string; requiresMfa: boolean }> {
  const email = normalizeEmail(input.email);
  await enforceRateLimit(RATE_LIMITS.loginIp, meta.ipAddress ?? "unknown");
  await enforceRateLimit(RATE_LIMITS.loginAccount, email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    await verifyAgainstDummyHash(input.password);
    throw invalidCredentials();
  }

  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil.getTime() > now) {
    throw new AppError("RATE_LIMITED", "This account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes or reset your password.");
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? new Date(now + LOCKOUT_MS) : null },
    });
    await recordAudit({
      actorType: "USER",
      actorId: user.id,
      action: lock ? "user.locked" : "user.login_failed",
      ipAddress: meta.ipAddress,
    });
    throw invalidCredentials();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(now) },
  });
  await recordAudit({ actorType: "USER", actorId: user.id, action: "user.login", ipAddress: meta.ipAddress });
  return { userId: user.id, requiresMfa: user.mfaEnabled };
}

/** Always behaves the same whether or not the account exists (no email enumeration). */
export async function requestPasswordReset(rawEmail: string, meta: RequestMeta): Promise<void> {
  const email = normalizeEmail(rawEmail);
  await enforceRateLimit(RATE_LIMITS.passwordResetIp, meta.ipAddress ?? "unknown");
  const accountLimit = await consumeRateLimit(RATE_LIMITS.passwordResetAccount, email);
  if (!accountLimit.allowed) return;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, deletedAt: true } });
  if (!user || user.deletedAt) return;

  const token = await issueToken(user.id, "PASSWORD_RESET", PASSWORD_RESET_TTL_MS);
  await sendEmail(passwordResetEmail({ to: user.email, name: user.name, url: `${env().APP_URL}/reset-password?token=${token}` }));
  await recordAudit({ actorType: "USER", actorId: user.id, action: "user.password_reset_requested", ipAddress: meta.ipAddress });
}

export async function resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
  const { userId } = await consumeToken(token, "PASSWORD_RESET");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.authToken.updateMany({
      where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  await invalidateUserSessions(userId);
  await recordAudit({ actorType: "USER", actorId: userId, action: "user.password_reset", ipAddress: meta.ipAddress });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  keepSessionId: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw fail.validation("Your current password is incorrect.", { currentPassword: ["Incorrect password."] });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await invalidateUserSessions(userId, keepSessionId);
  await recordAudit({ actorType: "USER", actorId: userId, action: "user.password_changed" });
}
