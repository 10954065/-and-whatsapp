import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

const ENCRYPTION_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** URL-safe random token (default 32 bytes of entropy). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(algorithm: "sha256" | "sha512", secret: string, input: string | Buffer): string {
  return createHmac(algorithm, secret).update(input).digest("hex");
}

/**
 * Hash for session ids, verification tokens and invitation tokens. Keyed with
 * AUTH_SECRET so a leaked database cannot be used to mint valid tokens.
 */
export function hashToken(token: string): string {
  return hmacHex("sha256", env().AUTH_SECRET, token);
}

/** Constant-time string comparison (returns false for different lengths). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function encryptionKey(): Buffer {
  return Buffer.from(env().ENCRYPTION_KEY, "base64");
}

/** AES-256-GCM encryption for secrets at rest. Output: "v1:<base64url(iv|tag|ciphertext)>". */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, body] = payload.split(":", 2);
  if (version !== ENCRYPTION_VERSION || !body) {
    throw new Error("Unsupported encrypted payload format");
  }
  const raw = Buffer.from(body, "base64url");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decryptSecret(payload)) as T;
}
