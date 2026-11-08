import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { parseMetaWebhook, verifyMetaSignature } from "@/modules/integrations/meta";
import { isWithinServiceWindow } from "@/modules/messaging/outbound.service";

describe("verifyMetaSignature", () => {
  afterEach(() => {
    delete process.env.META_APP_SECRET;
    resetEnvCache();
  });

  it("accepts only a valid HMAC-SHA256 of the raw body", () => {
    process.env.META_APP_SECRET = "meta-app-secret";
    resetEnvCache();
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = `sha256=${createHmac("sha256", "meta-app-secret").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature)).toBe(true);
    expect(verifyMetaSignature(`${body} `, signature)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=deadbeef")).toBe(false);
    expect(verifyMetaSignature(body, null)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(verifyMetaSignature("{}", `sha256=${createHmac("sha256", "").update("{}").digest("hex")}`)).toBe(false);
  });
});

describe("parseMetaWebhook", () => {
  it("normalises WhatsApp messages and delivery statuses", () => {
    const events = parseMetaWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "111" },
                contacts: [{ wa_id: "233241234567", profile: { name: "Efua" } }],
                messages: [{ from: "233241234567", id: "wamid.A", timestamp: "1762620000", type: "text", text: { body: "Hi" } }],
                statuses: [{ id: "wamid.B", status: "delivered", timestamp: "1762620005" }],
              },
            },
          ],
        },
      ],
    });
    expect(events).toEqual([
      expect.objectContaining({ kind: "message", channel: "WHATSAPP", accountId: "111", customerName: "Efua", providerMessageId: "wamid.A", type: "TEXT", text: "Hi" }),
      expect.objectContaining({ kind: "status", providerMessageId: "wamid.B", status: "DELIVERED" }),
    ]);
  });

  it("normalises Instagram DMs and ignores echoes of our own messages", () => {
    const events = parseMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          messaging: [
            { sender: { id: "IGSID1" }, recipient: { id: "17841400000000000" }, timestamp: 1762620000000, message: { mid: "m1", text: "Price?" } },
            { sender: { id: "17841400000000000" }, recipient: { id: "IGSID1" }, timestamp: 1762620001000, message: { mid: "m2", text: "echo", is_echo: true } },
          ],
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "message", channel: "INSTAGRAM", customerExternalId: "IGSID1", providerMessageId: "m1", text: "Price?" });
  });

  it("ignores unknown payloads", () => {
    expect(parseMetaWebhook({ object: "page", entry: [{}] })).toEqual([]);
    expect(parseMetaWebhook(null)).toEqual([]);
  });
});

describe("isWithinServiceWindow", () => {
  it("allows free-form replies only within 24 hours of the last customer message", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(isWithinServiceWindow(new Date("2026-11-08T00:00:00Z"), now)).toBe(true);
    expect(isWithinServiceWindow(new Date("2026-11-07T11:59:00Z"), now)).toBe(false);
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });
});
