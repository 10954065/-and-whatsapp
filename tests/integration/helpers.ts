import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/security/password";
import { randomToken } from "@/lib/security/crypto";

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "")}@example.test`;
}

export function testMeta() {
  return { ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}-${randomToken(4)}`, userAgent: "vitest" };
}

export async function createUser(overrides: { email?: string; password?: string; verified?: boolean } = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? uniqueEmail(),
      name: "Test User",
      passwordHash: await hashPassword(overrides.password ?? "test-password-123"),
      emailVerifiedAt: overrides.verified === false ? null : new Date(),
    },
  });
}

export async function createBusinessFor(userId: string, name = "Test Business") {
  return prisma.business.create({
    data: {
      name,
      slug: `test-${randomToken(8).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
}
