import { Secret, TOTP } from "otpauth";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { beginMfaEnrollment, confirmMfaEnrollment, disableMfa, verifyMfaChallenge } from "@/modules/auth/mfa.service";
import { createUser } from "./helpers";

const codeFor = (secret: string, offsetSeconds = 0) =>
  new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({ timestamp: Date.now() + offsetSeconds * 1000 });

describe("two-factor authentication", () => {
  it("enrols with a real TOTP code, stores the secret encrypted and accepts each recovery code once", async () => {
    const user = await createUser({ password: "mfa-password-123" });
    const { secret, otpauthUrl, qrDataUrl } = await beginMfaEnrollment(user.id);
    expect(otpauthUrl).toContain("issuer=SUNLEON%20AI");
    expect(qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.mfaSecretEnc).toMatch(/^v1:/);
    expect(stored.mfaSecretEnc).not.toContain(secret);

    await expect(confirmMfaEnrollment(user.id, "000000")).rejects.toThrow();
    const { recoveryCodes } = await confirmMfaEnrollment(user.id, codeFor(secret));
    expect(recoveryCodes).toHaveLength(10);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mfaEnabled).toBe(true);
    await expect(beginMfaEnrollment(user.id)).rejects.toThrow(/already enabled/);

    expect(await verifyMfaChallenge(user.id, codeFor(secret))).toBe(true);
    expect(await verifyMfaChallenge(user.id, codeFor(secret, -30))).toBe(true); // clock drift tolerated
    expect(await verifyMfaChallenge(user.id, codeFor(secret, -120))).toBe(false);
    expect(await verifyMfaChallenge(user.id, "123456")).toBe(false);

    expect(await verifyMfaChallenge(user.id, recoveryCodes[0])).toBe(true);
    expect(await verifyMfaChallenge(user.id, recoveryCodes[0])).toBe(false);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: "user.mfa_recovery_code_used" } })).toBe(1);

    await expect(disableMfa(user.id, "wrong-password")).rejects.toThrow(/Incorrect password/);
    await disableMfa(user.id, "mfa-password-123");
    const disabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(disabled).toMatchObject({ mfaEnabled: false, mfaSecretEnc: null });
    expect(await prisma.mfaRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
  });
});
