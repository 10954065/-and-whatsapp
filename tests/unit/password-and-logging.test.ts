import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/security/password";
import { redact } from "@/lib/monitoring/logger";
import { outboundMessagingMode, resetEnvCache } from "@/lib/env";

describe("passwordSchema", () => {
  it.each(["short1", "onlyletterslong", "a".repeat(129)])("rejects %s", (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });

  it("accepts a long password with a number", () => {
    expect(passwordSchema.safeParse("kente-market-2026").success).toBe(true);
  });
});

describe("hashPassword", () => {
  it("produces an Argon2id hash that verifies only the right password", async () => {
    const hash = await hashPassword("kente-market-2026");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "kente-market-2026")).toBe(true);
    expect(await verifyPassword(hash, "kente-market-2027")).toBe(false);
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("redact", () => {
  it("removes secrets at any depth", () => {
    const output = redact({
      userId: "u1",
      password: "hunter2",
      nested: { accessToken: "EAAG", apiKey: "sk", items: [{ authorization: "Bearer x" }] },
    }) as Record<string, unknown>;
    expect(JSON.stringify(output)).not.toMatch(/hunter2|EAAG|Bearer x|"sk"/);
    expect(output.userId).toBe("u1");
  });
});

describe("outboundMessagingMode", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  it("always sandboxes preview deployments, even if live is requested", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.OUTBOUND_MESSAGING_MODE = "live";
    resetEnvCache();
    expect(outboundMessagingMode()).toBe("sandbox");
  });

  it("honours an explicit mode outside previews", () => {
    delete process.env.VERCEL_ENV;
    process.env.OUTBOUND_MESSAGING_MODE = "live";
    resetEnvCache();
    expect(outboundMessagingMode()).toBe("live");
  });
});
