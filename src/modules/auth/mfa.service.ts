import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/prisma";
import { fail } from "@/lib/monitoring/errors";
import { decryptSecret, encryptSecret, hashToken, randomToken } from "@/lib/security/crypto";
import { verifyPassword } from "@/lib/security/password";
import { recordAudit } from "@/modules/administration/audit.service";

const ISSUER = "SUNLEON AI";
const RECOVERY_CODE_COUNT = 10;

function buildTotp(email: string, secretBase32: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

/** Accepts the current, previous and next 30-second code to tolerate clock drift. */
export function verifyTotpCode(email: string, secretBase32: string, code: string): boolean {
  const token = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  return buildTotp(email, secretBase32).validate({ token, window: 1 }) !== null;
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

function generateRecoveryCode(): string {
  const raw = randomToken(8).replace(/[^A-Za-z0-9]/g, "").toUpperCase().padEnd(10, "X").slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Step 1: generate a secret (stored encrypted, not yet active) and a QR code. */
export async function beginMfaEnrollment(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
  if (user.mfaEnabled) throw fail.conflict("Two-factor authentication is already enabled.");
  const secret = new Secret({ size: 20 }).base32;
  await prisma.user.update({ where: { id: userId }, data: { mfaSecretEnc: encryptSecret(secret) } });
  const otpauthUrl = buildTotp(user.email, secret).toString();
  return { secret, otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }) };
}

/** Step 2: prove possession of the authenticator; returns one-time recovery codes. */
export async function confirmMfaEnrollment(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, mfaEnabled: true, mfaSecretEnc: true },
  });
  if (user.mfaEnabled) throw fail.conflict("Two-factor authentication is already enabled.");
  if (!user.mfaSecretEnc) throw fail.precondition("Start two-factor setup again.");
  if (!verifyTotpCode(user.email, decryptSecret(user.mfaSecretEnc), code)) {
    throw fail.validation("That code is not valid. Check your authenticator app and try again.", { code: ["Invalid code."] });
  }

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((entry) => ({ userId, codeHash: hashToken(normalizeRecoveryCode(entry)) })),
    }),
    prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
  ]);
  await recordAudit({ actorType: "USER", actorId: userId, action: "user.mfa_enabled" });
  return { recoveryCodes };
}

/** Second-factor check at sign-in: an authenticator code or a single-use recovery code. */
export async function verifyMfaChallenge(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, mfaEnabled: true, mfaSecretEnc: true },
  });
  if (!user.mfaEnabled || !user.mfaSecretEnc) return true;
  if (verifyTotpCode(user.email, decryptSecret(user.mfaSecretEnc), code)) return true;

  const claimed = await prisma.mfaRecoveryCode.updateMany({
    where: { userId, codeHash: hashToken(normalizeRecoveryCode(code)), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 1) {
    await recordAudit({ actorType: "USER", actorId: userId, action: "user.mfa_recovery_code_used" });
    return true;
  }
  return false;
}

export async function disableMfa(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw fail.validation("Incorrect password.", { password: ["Incorrect password."] });
  }
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEnc: null } }),
  ]);
  await recordAudit({ actorType: "USER", actorId: userId, action: "user.mfa_disabled" });
}
