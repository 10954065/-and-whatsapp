import { describe, expect, it } from "vitest";
import {
  decryptJson,
  decryptSecret,
  encryptJson,
  encryptSecret,
  hashToken,
  randomToken,
  safeEqual,
} from "@/lib/security/crypto";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips plaintext", () => {
    const encrypted = encryptSecret("EAAG-whatsapp-access-token");
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain("EAAG");
    expect(decryptSecret(encrypted)).toBe("EAAG-whatsapp-access-token");
  });

  it("uses a fresh IV so equal plaintexts encrypt differently", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("secret value");
    const raw = Buffer.from(encrypted.slice(3), "base64url");
    raw[raw.length - 1] ^= 0xff;
    expect(() => decryptSecret(`v1:${raw.toString("base64url")}`)).toThrow();
  });

  it("rejects unknown payload versions", () => {
    expect(() => decryptSecret("v9:abcdef")).toThrow("Unsupported encrypted payload format");
  });

  it("round-trips JSON payloads", () => {
    const credentials = { accessToken: "abc", expiresAt: 123 };
    expect(decryptJson<typeof credentials>(encryptJson(credentials))).toEqual(credentials);
  });
});

describe("hashToken", () => {
  it("is deterministic, keyed and hides the token", () => {
    const token = randomToken();
    const hashed = hashToken(token);
    expect(hashed).toBe(hashToken(token));
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toContain(token);
  });
});

describe("safeEqual", () => {
  it("compares in constant time and handles different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("randomToken", () => {
  it("produces unique url-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
