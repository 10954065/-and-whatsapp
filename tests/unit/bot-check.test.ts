import { afterEach, describe, expect, it, vi } from "vitest";

const botid = vi.hoisted(() => ({ isBot: false }));
vi.mock("botid/server", () => ({
  checkBotId: vi.fn(async () => ({ isHuman: !botid.isBot, isBot: botid.isBot, isVerifiedBot: false, bypassed: false })),
}));

import { checkBotId } from "botid/server";
import { assertHuman, BOT_BLOCKED_MESSAGE } from "@/lib/security/bot-check";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(checkBotId).mockClear();
  botid.isBot = false;
});

describe("assertHuman", () => {
  it("skips BotID away from Vercel, where it cannot verify", async () => {
    vi.stubEnv("VERCEL", "");
    botid.isBot = true;
    await expect(assertHuman("auth.login")).resolves.toBeUndefined();
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("lets a person through on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    await expect(assertHuman("auth.login")).resolves.toBeUndefined();
    expect(checkBotId).toHaveBeenCalledOnce();
  });

  it("refuses a bot on Vercel with a message that asks a person to refresh", async () => {
    vi.stubEnv("VERCEL", "1");
    botid.isBot = true;
    await expect(assertHuman("auth.register")).rejects.toMatchObject({ code: "FORBIDDEN", message: BOT_BLOCKED_MESSAGE });
  });
});
