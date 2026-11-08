import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

// OWASP-recommended Argon2id parameters (m = 19 MiB, t = 2, p = 1). Argon2id is the
// library default algorithm.
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 };

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .refine(
    (value) => /[A-Za-z]/.test(value) && /[^A-Za-z]/.test(value),
    "Include letters and at least one number or symbol.",
  );

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Spends the same time as a real verification so unknown emails cannot be detected by timing. */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  dummyHash ??= hashPassword("sunleon-timing-equaliser-not-a-real-password");
  await verifyPassword(await dummyHash, password);
}
