import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/monitoring/logger";
import { createKeyRotatingClient } from "@/modules/ai/llm/key-pool";
import { LlmProviderError, type LlmClient, type LlmRequest, type LlmResponse } from "@/modules/ai/llm/types";

const REQUEST: LlmRequest = {
  model: "test-model",
  system: "You are the assistant.",
  messages: [{ role: "user", content: "Hi" }],
  tools: [],
  maxOutputTokens: 256,
  effort: "low",
  endUserId: "biz_1",
};

const reply = (text: string): LlmResponse => ({
  text,
  toolCalls: [],
  stopReason: "end_turn",
  usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
  providerTurn: { provider: "openai-compatible", raw: null },
});

type Outcome = number | null | "ok";

/** Fake per-key clients: each key answers with its own name or fails with the given HTTP status. */
function fakeKeys(outcomes: Record<string, Outcome>) {
  const calls: { key: string; isLastResort: boolean }[] = [];
  const factory = (key: string, options: { isLastResort: boolean }): LlmClient => ({
    async create() {
      calls.push({ key, isLastResort: options.isLastResort });
      const outcome = outcomes[key];
      if (outcome === "ok") return reply(key);
      throw new LlmProviderError(`Provider error ${outcome}`, outcome);
    },
  });
  return { calls, factory, keysTried: () => calls.map((call) => call.key) };
}

function clock(start = 1_000_000) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("AI key rotation", () => {
  it("starts each request on the next key in turn", async () => {
    const keys = fakeKeys({ a: "ok", b: "ok", c: "ok" });
    const client = createKeyRotatingClient(["a", "b", "c"], keys.factory);
    const answers = [];
    for (let i = 0; i < 4; i += 1) answers.push((await client.create(REQUEST)).text);
    expect(answers).toEqual(["a", "b", "c", "a"]);
  });

  it("moves straight to the next key when one is rate-limited, and rests it for a minute", async () => {
    const time = clock();
    const keys = fakeKeys({ a: 429, b: "ok", c: "ok" });
    const client = createKeyRotatingClient(["a", "b", "c"], keys.factory, time.now);
    expect((await client.create(REQUEST)).text).toBe("b");
    expect(keys.calls[0]).toEqual({ key: "a", isLastResort: false });

    await client.create(REQUEST);
    await client.create(REQUEST);
    keys.calls.length = 0;
    expect((await client.create(REQUEST)).text).toBe("b");
    expect(keys.keysTried()).toEqual(["b"]);

    time.advance(61_000);
    keys.calls.length = 0;
    await client.create(REQUEST);
    await client.create(REQUEST);
    await client.create(REQUEST);
    expect(keys.keysTried()).toContain("a");
  });

  it("rests a refused key much longer than a rate-limited one", async () => {
    const time = clock();
    const keys = fakeKeys({ a: 401, b: "ok" });
    const client = createKeyRotatingClient(["a", "b"], keys.factory, time.now);
    await client.create(REQUEST);
    time.advance(5 * 60_000);
    keys.calls.length = 0;
    await client.create(REQUEST);
    await client.create(REQUEST);
    expect(keys.keysTried()).toEqual(["b", "b"]);

    time.advance(11 * 60_000);
    keys.calls.length = 0;
    await client.create(REQUEST);
    await client.create(REQUEST);
    expect(keys.keysTried()).toContain("a");
  });

  it("does not try other keys when the request itself is wrong", async () => {
    const keys = fakeKeys({ a: 400, b: "ok" });
    const client = createKeyRotatingClient(["a", "b"], keys.factory);
    await expect(client.create(REQUEST)).rejects.toMatchObject({ status: 400 });
    expect(keys.keysTried()).toEqual(["a"]);
  });

  it("moves on after a server error or network failure without resting the key", async () => {
    const keys = fakeKeys({ a: 503, b: null, c: "ok" });
    const client = createKeyRotatingClient(["a", "b", "c"], keys.factory);
    expect((await client.create(REQUEST)).text).toBe("c");
    keys.calls.length = 0;
    for (let i = 0; i < 3; i += 1) await client.create(REQUEST);
    expect(keys.keysTried()[0]).toBe("b");
    expect(keys.keysTried()).toContain("a");
  });

  it("gives the last key in line the full retries, so a single key behaves as before", async () => {
    const single = fakeKeys({ a: "ok" });
    await createKeyRotatingClient(["a"], single.factory).create(REQUEST);
    expect(single.calls).toEqual([{ key: "a", isLastResort: true }]);

    const limited = fakeKeys({ a: 429, b: 429 });
    await expect(createKeyRotatingClient(["a", "b"], limited.factory).create(REQUEST)).rejects.toMatchObject({ status: 429 });
    expect(limited.calls).toEqual([
      { key: "a", isLastResort: false },
      { key: "b", isLastResort: true },
    ]);
  });

  it("still tries resting keys when every key is resting, the soonest ready first", async () => {
    const time = clock();
    // a rests for a minute (rate-limited), b for fifteen (refused); the next request would start on b.
    const outcomes: Record<string, Outcome> = { a: 429, b: 401 };
    const keys = fakeKeys(outcomes);
    const client = createKeyRotatingClient(["a", "b"], keys.factory, time.now);
    await client.create(REQUEST).catch(() => undefined);
    time.advance(10_000);
    outcomes.a = "ok";
    keys.calls.length = 0;
    expect((await client.create(REQUEST)).text).toBe("a");
    expect(keys.keysTried()).toEqual(["a"]);
  });

  it("logs which key failed by its place in the list, never the key itself", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const keys = fakeKeys({ gsk_secret_one: 429, gsk_secret_two: "ok" });
    await createKeyRotatingClient(["gsk_secret_one", "gsk_secret_two"], keys.factory).create(REQUEST);
    expect(warn).toHaveBeenCalledWith("ai.key_failover", expect.objectContaining({ keyPosition: 1, keyCount: 2, status: 429 }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("gsk_secret");
    warn.mockRestore();
  });
});
