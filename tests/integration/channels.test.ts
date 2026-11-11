import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { resetEnvCache } from "@/lib/env";
import {
  checkIntegrationHealth,
  completeInstagramConnect,
  connectWhatsApp,
  credentialsFor,
  disconnectIntegration,
  listIntegrations,
  startInstagramConnect,
  whatsappConnectSchema,
} from "@/modules/integrations/integration.service";
import { createBusinessFor, createUser } from "./helpers";

async function setup() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Channel Shop");
  const actor: TenantActor = { userId: owner.id, userName: "Owner", emailVerified: true, businessId: business.id, businessName: business.name, role: "OWNER", ipAddress: null };
  return { owner, business, actor };
}

const digits = () => String(Math.floor(1e14 + Math.random() * 9e14));

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.INSTAGRAM_APP_ID;
  delete process.env.INSTAGRAM_APP_SECRET;
  resetEnvCache();
});

describe("WhatsApp connection", () => {
  it("cannot be submitted until the owner confirms Meta's WhatsApp fees", () => {
    const details = { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "v") };
    const missing = whatsappConnectSchema.safeParse(details);
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.map((issue) => issue.path.join("."))).toEqual(["metaFeesAcknowledged"]);
    expect(missing.error?.issues[0]?.message).toBe("Confirm that you understand Meta's WhatsApp fees.");
    expect(whatsappConnectSchema.safeParse({ ...details, metaFeesAcknowledged: "on" }).success).toBe(true);
  });

  it("verifies the number with Graph, stores the token encrypted, checks health and disconnects", async () => {
    const { actor, business } = await setup();
    const phoneNumberId = digits();
    let tokenValid = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        tokenValid
          ? Response.json({ id: phoneNumberId, display_phone_number: "+233 24 400 0111", verified_name: "Channel Shop" })
          : Response.json({ error: { message: "Error validating access token", code: 190 } }, { status: 401 }),
      ),
    );

    await expect(connectWhatsApp({ ...actor, emailVerified: false }, { phoneNumberId, wabaId: digits(), accessToken: "EAAG".padEnd(40, "x"), metaFeesAcknowledged: "on" })).rejects.toThrow(/Confirm your email/);
    const integration = await connectWhatsApp(actor, { phoneNumberId, wabaId: digits(), accessToken: "EAAG".padEnd(40, "x"), metaFeesAcknowledged: "on" });
    expect(integration).toMatchObject({ channel: "WHATSAPP", status: "CONNECTED", displayHandle: "+233 24 400 0111", externalAccountName: "Channel Shop" });
    expect(integration.credentialsEnc).not.toContain("EAAG");
    expect(credentialsFor(integration).accessToken).toBe("EAAG".padEnd(40, "x"));
    expect((await listIntegrations(business.id)).map((entry) => entry.id)).toContain(integration.id);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "integration.connected", entityId: integration.id } });
    expect(audit.metadata).toMatchObject({ channel: "WHATSAPP", metaFeesAcknowledged: true, metaFreeRepliesShown: 1_000 });

    tokenValid = false;
    const unhealthy = await checkIntegrationHealth(actor, integration.id);
    expect(unhealthy).toMatchObject({ status: "ERROR", lastError: "Error validating access token" });
    tokenValid = true;
    expect((await checkIntegrationHealth(actor, integration.id)).status).toBe("CONNECTED");

    await disconnectIntegration(actor, integration.id);
    expect(await prisma.integration.findUniqueOrThrow({ where: { id: integration.id } })).toMatchObject({ status: "DISCONNECTED", credentialsEnc: null });
    await expect(disconnectIntegration(actor, "missing")).rejects.toThrow(/not found/i);
  });

  it("explains a rejected token and enforces the plan's channel allowance", async () => {
    const { actor } = await setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Unsupported get request", code: 100 } }, { status: 400 })));
    await expect(connectWhatsApp(actor, { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "y"), metaFeesAcknowledged: "on" })).rejects.toThrow(/WhatsApp rejected these details: Unsupported get request/);

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "1", display_phone_number: "+233", verified_name: "Shop" })));
    await connectWhatsApp(actor, { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "z"), metaFeesAcknowledged: "on" });
    // Default limits allow one connected channel.
    await expect(connectWhatsApp(actor, { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "w"), metaFeesAcknowledged: "on" })).rejects.toThrow(/allows 1 connected channel/);
  });
});

describe("Instagram Login connection", () => {
  it("binds the single-use state to the user and connects the professional account", async () => {
    const { owner, actor, business } = await setup();
    process.env.INSTAGRAM_APP_ID = "ig_app";
    process.env.INSTAGRAM_APP_SECRET = "ig_secret";
    resetEnvCache();
    const igUserId = digits();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url === "https://api.instagram.com/oauth/access_token") return Response.json({ access_token: "short", user_id: igUserId, permissions: "instagram_business_basic,instagram_business_manage_messages" });
        if (url.startsWith("https://graph.instagram.com/access_token")) return Response.json({ access_token: "long-lived", expires_in: 5_184_000 });
        if (url.includes("/me?fields=")) return Response.json({ user_id: igUserId, username: "channel_shop", name: "Channel Shop" });
        return Response.json({ success: true });
      }),
    );

    const authorizeUrl = new URL(await startInstagramConnect(actor));
    const state = authorizeUrl.searchParams.get("state")!;
    const stranger = await createUser();
    await expect(completeInstagramConnect(stranger.id, state, "code")).rejects.toThrow(/expired/);

    expect(await completeInstagramConnect(owner.id, state, "code#_")).toEqual({ businessId: business.id });
    const integration = await prisma.integration.findFirstOrThrow({ where: { businessId: business.id, channel: "INSTAGRAM" } });
    expect(integration).toMatchObject({ status: "CONNECTED", displayHandle: "@channel_shop", externalAccountId: igUserId, scopes: ["instagram_business_basic", "instagram_business_manage_messages"] });
    expect(credentialsFor(integration).accessToken).toBe("long-lived");

    await expect(completeInstagramConnect(owner.id, state, "code")).rejects.toThrow(/expired/);
  });
});
