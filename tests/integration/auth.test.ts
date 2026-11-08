import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";

const mail = vi.hoisted(() => ({ sent: [] as EmailMessage[] }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (message: EmailMessage) => {
    mail.sent.push(message);
    return true;
  }),
}));

import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  authenticate,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "@/modules/auth/auth.service";
import { createUser, testMeta, uniqueEmail } from "./helpers";

function lastToken(): string {
  const message = mail.sent.at(-1);
  const match = message?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("No token found in the last email");
  return match[1];
}

beforeEach(() => {
  mail.sent.length = 0;
});

describe("registration and email verification", () => {
  it("stores an Argon2 hash, emails a single-use verification link and verifies", async () => {
    const email = uniqueEmail("register");
    const { userId } = await registerUser(
      { name: "Kwame Mensah", email, password: "kente-market-2026", acceptTerms: "on" },
      testMeta(),
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(user.emailVerifiedAt).toBeNull();
    expect(mail.sent.at(-1)?.template).toBe("email_verification");

    const token = lastToken();
    await verifyEmail(token);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).emailVerifiedAt).not.toBeNull();
    await expect(verifyEmail(token)).rejects.toThrow(/already been used/);
  });

  it("rejects duplicate emails", async () => {
    const email = uniqueEmail("dup");
    await registerUser({ name: "First", email, password: "kente-market-2026", acceptTerms: "on" }, testMeta());
    await expect(
      registerUser({ name: "Second", email: email.toUpperCase(), password: "kente-market-2026", acceptTerms: "on" }, testMeta()),
    ).rejects.toThrow(/already exists/);
  });

  it("rejects forged verification tokens", async () => {
    await expect(verifyEmail("forged-token-forged-token-forged")).rejects.toThrow(/invalid/);
  });
});

describe("password authentication", () => {
  it("accepts the right password and rejects the wrong one generically", async () => {
    const user = await createUser({ password: "correct-horse-42" });
    await expect(authenticate({ email: user.email, password: "correct-horse-42" }, testMeta())).resolves.toEqual({
      userId: user.id,
      requiresMfa: false,
    });
    await expect(authenticate({ email: user.email, password: "wrong-horse-42" }, testMeta())).rejects.toThrow(
      "Incorrect email or password.",
    );
    await expect(authenticate({ email: uniqueEmail("ghost"), password: "whatever-123" }, testMeta())).rejects.toThrow(
      "Incorrect email or password.",
    );
  });

  it("locks the account after five consecutive failures", async () => {
    const user = await createUser({ password: "correct-horse-42" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(authenticate({ email: user.email, password: "nope-nope-1" }, testMeta())).rejects.toThrow();
    }
    await expect(authenticate({ email: user.email, password: "correct-horse-42" }, testMeta())).rejects.toThrow(
      /temporarily locked/,
    );
  });
});

describe("password reset", () => {
  it("does nothing visible for unknown emails", async () => {
    await expect(requestPasswordReset(uniqueEmail("unknown"), testMeta())).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });

  it("resets the password once and signs out every session", async () => {
    const user = await createUser({ password: "old-password-42" });
    await createSession(user.id, { ipAddress: null, userAgent: null, mfaVerified: true });
    await requestPasswordReset(user.email, testMeta());
    const token = lastToken();

    await resetPassword(token, "new-password-42", testMeta());
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(authenticate({ email: user.email, password: "new-password-42" }, testMeta())).resolves.toMatchObject({
      userId: user.id,
    });
    await expect(resetPassword(token, "another-password-42", testMeta())).rejects.toThrow(/already been used/);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window, then blocks", async () => {
    const rule = { name: "test:rule", limit: 3, windowSeconds: 60 };
    const identifier = uniqueEmail("rl");
    const now = new Date("2026-11-08T12:00:30Z");
    const results = [];
    for (let attempt = 0; attempt < 4; attempt += 1) results.push(await consumeRateLimit(rule, identifier, now));
    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBe(30);
    const nextWindow = await consumeRateLimit(rule, identifier, new Date("2026-11-08T12:01:05Z"));
    expect(nextWindow.allowed).toBe(true);
  });
});
