import { describe, expect, it, vi } from "vitest";
import type { ValidatedSession } from "@/lib/auth/session";

// Server Actions read the signed-in session from cookies; here the current session is set directly.
const current = vi.hoisted(() => ({ session: null as ValidatedSession | null }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  readSessionToken: vi.fn(async () => (current.session ? "test-token" : undefined)),
  validateSessionToken: vi.fn(async () => current.session),
}));

import { requireUserForAction } from "@/lib/auth/current";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { changePassword } from "@/modules/auth/auth.service";
import { disableMfa } from "@/modules/auth/mfa.service";
import { deleteUserAccount } from "@/modules/privacy/privacy.service";
import { createUser, uniqueEmail } from "./helpers";

function signedIn(userId: string): ValidatedSession {
  return {
    sessionId: `session-${userId}`,
    expiresAt: new Date(Date.now() + 60_000),
    mfaVerified: false,
    user: { id: userId, email: uniqueEmail(), name: "Test User", emailVerifiedAt: new Date(), platformRole: "USER", mfaEnabled: false },
  };
}

describe("password re-checks", () => {
  it("share five attempts across changing the password, turning off two-factor and deleting the account", async () => {
    const user = await createUser({ password: "right-password-42" });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(changePassword(user.id, "wrong-password", "new-password-4242", "keep")).rejects.toThrow(/current password is incorrect/);
    }
    await expect(disableMfa(user.id, "wrong-password")).rejects.toThrow(/Incorrect password/);
    await expect(deleteUserAccount(user.id, { password: "wrong-password" }, null)).rejects.toThrow(/incorrect/);

    // The right password no longer helps until the window passes: guessing stops here.
    await expect(changePassword(user.id, "right-password-42", "new-password-4242", "keep")).rejects.toThrow(/Too many attempts/);
    await expect(deleteUserAccount(user.id, { password: "right-password-42" }, null)).rejects.toThrow(/Too many attempts/);
  });
});

describe("signed-in actions", () => {
  it("allow a steady pace and stop one person who goes far beyond it", async () => {
    const userId = `pace-${uniqueEmail().split("@")[0]}`;
    current.session = signedIn(userId);
    for (let call = 0; call < RATE_LIMITS.actionsPerUser.limit; call += 1) await requireUserForAction();
    await expect(requireUserForAction()).rejects.toThrow(/Too many attempts/);

    // Another person is unaffected.
    current.session = signedIn(`${userId}-other`);
    await expect(requireUserForAction()).resolves.toMatchObject({ user: { id: `${userId}-other` } });
    current.session = null;
  });
});
