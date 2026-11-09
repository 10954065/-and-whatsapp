import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env, resetEnvCache } from "@/lib/env";
import { publishJobWakeUp, verifyQStashSignature } from "@/lib/queue/qstash";

const URL = "http://localhost:3000/api/queue/qstash";
const CURRENT = "sig_current_key";
const NEXT = "sig_next_key";

/** Builds an `Upstash-Signature` the way QStash does (HS256 JWT over the body hash). */
function sign(body: string, key: string, claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "Upstash", sub: URL, exp: now + 300, nbf: now - 5, iat: now, jti: "jwt_1", body: createHash("sha256").update(body).digest("base64url"), ...claims }),
  ).toString("base64url");
  const signature = createHmac("sha256", key).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("QStash signature verification", () => {
  const body = JSON.stringify({ jobId: "job_123" });
  const keys = [CURRENT, NEXT];

  it("accepts a valid signature with the current or the next signing key", () => {
    expect(verifyQStashSignature(sign(body, CURRENT), body, URL, keys)).toBe(true);
    expect(verifyQStashSignature(sign(body, NEXT), body, URL, keys)).toBe(true);
  });

  it("rejects wrong keys, tampered bodies, other URLs, other issuers and expired tokens", () => {
    expect(verifyQStashSignature(sign(body, "attacker"), body, URL, keys)).toBe(false);
    expect(verifyQStashSignature(sign(body, CURRENT), JSON.stringify({ jobId: "job_999" }), URL, keys)).toBe(false);
    expect(verifyQStashSignature(sign(body, CURRENT, { sub: "https://evil.example/api" }), body, URL, keys)).toBe(false);
    expect(verifyQStashSignature(sign(body, CURRENT, { iss: "Someone" }), body, URL, keys)).toBe(false);
    expect(verifyQStashSignature(sign(body, CURRENT, { exp: Math.floor(Date.now() / 1000) - 1 }), body, URL, keys)).toBe(false);
    expect(verifyQStashSignature(sign(body, CURRENT, { nbf: Math.floor(Date.now() / 1000) + 600 }), body, URL, keys)).toBe(false);
    expect(verifyQStashSignature("not-a-jwt", body, URL, keys)).toBe(false);
    expect(verifyQStashSignature(null, body, URL, keys)).toBe(false);
    expect(verifyQStashSignature(sign(body, CURRENT), body, URL, [undefined, undefined])).toBe(false);
  });
});

describe("QStash wake-ups", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.QSTASH_TOKEN;
    delete process.env.QSTASH_URL;
    resetEnvCache();
  });

  it("publishes the job id to our endpoint, delayed until the run time and deduplicated", async () => {
    process.env.QSTASH_TOKEN = "qstash_test_token";
    process.env.QSTASH_URL = "https://qstash-eu-central-1.upstash.io";
    resetEnvCache();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const runAt = new Date(Date.now() + 120_000);
    await publishJobWakeUp({ id: "job_42", runAt });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://qstash-eu-central-1.upstash.io/v2/publish/${URL}`);
    expect(JSON.parse(String(init.body))).toEqual({ jobId: "job_42" });
    const notBefore = String(Math.ceil(runAt.getTime() / 1000));
    expect(init.headers).toMatchObject({ authorization: "Bearer qstash_test_token", "upstash-not-before": notBefore, "upstash-deduplication-id": `job_42-${notBefore}` });
  });

  it("treats an empty QSTASH_URL from .env.example as unset", () => {
    process.env.QSTASH_URL = "";
    resetEnvCache();
    expect(env().QSTASH_URL).toBeUndefined();
  });

  it("never throws when QStash is unreachable (the cron sweeper is the fallback)", async () => {
    process.env.QSTASH_TOKEN = "qstash_test_token";
    resetEnvCache();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));
    await expect(publishJobWakeUp({ id: "job_43", runAt: new Date() })).resolves.toBeUndefined();
  });
});
