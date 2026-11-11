import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { resetEnvCache } from "@/lib/env";
import { AppError } from "@/lib/monitoring/errors";
import {
  checkIntegrationHealth,
  completeInstagramConnect,
  connectWhatsApp,
  connectWhatsAppEmbedded,
  credentialsFor,
  disconnectIntegration,
  instagramFailureNotice,
  listIntegrations,
  startInstagramConnect,
  whatsappConnectSchema,
  whatsappEmbeddedConnectSchema,
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
  delete process.env.META_INSTAGRAM_CONFIG_ID;
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  resetEnvCache();
});

/** Fake Graph API: the phone number check, the token's app, and the webhook subscription. */
function stubGraph({ tokenAppId, subscribe = "ok" }: { tokenAppId?: string; subscribe?: "ok" | "refused" } = {}) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.includes("/debug_token")) return Response.json({ data: { app_id: tokenAppId, is_valid: true } });
      if (url.endsWith("/subscribed_apps")) {
        return subscribe === "ok" ? Response.json({ success: true }) : Response.json({ error: { message: "(#200) Permissions error", code: 200 } }, { status: 403 });
      }
      return Response.json({ id: "1", display_phone_number: "+233 24 400 0222", verified_name: "Linked Shop" });
    }),
  );
  return calls;
}

function useMetaApp() {
  process.env.META_APP_ID = "sunleon_app";
  process.env.META_APP_SECRET = "sunleon_secret";
  resetEnvCache();
}

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

  it("links the WhatsApp account to the SUNLEON AI app so customer messages arrive", async () => {
    const { actor } = await setup();
    useMetaApp();
    const calls = stubGraph({ tokenAppId: "sunleon_app" });
    const wabaId = digits();
    await connectWhatsApp(actor, { phoneNumberId: digits(), wabaId, accessToken: "EAAG".padEnd(40, "l"), metaFeesAcknowledged: "on" });
    expect(calls).toContainEqual({ url: expect.stringContaining(`/${wabaId}/subscribed_apps`), method: "POST" });
  });

  it("refuses a token made for a different Meta app before linking anything", async () => {
    const { actor, business } = await setup();
    useMetaApp();
    const calls = stubGraph({ tokenAppId: "someone_elses_app" });
    await expect(connectWhatsApp(actor, { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "o"), metaFeesAcknowledged: "on" })).rejects.toThrow(/different Meta app/);
    expect(calls.some((call) => call.url.endsWith("/subscribed_apps"))).toBe(false);
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "WHATSAPP" } })).toBe(0);
  });

  it("explains when Meta will not send the number's messages to SUNLEON AI, and saves nothing", async () => {
    const { actor, business } = await setup();
    stubGraph({ subscribe: "refused" });
    await expect(connectWhatsApp(actor, { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "r"), metaFeesAcknowledged: "on" })).rejects.toThrow(
      /would not send this number's messages to SUNLEON AI: \(#200\) Permissions error/,
    );
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "WHATSAPP" } })).toBe(0);
  });
});

/** Fake Graph API for Embedded Signup: code exchange, the account's numbers, linking and activation. */
function stubEmbeddedGraph({
  accountNumbers,
  platformType = "NOT_APPLICABLE",
  exchange = "ok",
  register = "ok",
}: {
  accountNumbers: string[];
  platformType?: string;
  exchange?: "ok" | "expired";
  register?: "ok" | "refused";
}) {
  const calls: { url: string; method: string; body: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : null });
      if (url.includes("/oauth/access_token")) {
        return exchange === "ok"
          ? Response.json({ access_token: "EAAB_business_token", token_type: "bearer" })
          : Response.json({ error: { message: "This authorization code has expired.", code: 100 } }, { status: 400 });
      }
      if (url.includes("/phone_numbers")) return Response.json({ data: accountNumbers.map((id) => ({ id })) });
      if (url.endsWith("/subscribed_apps")) return Response.json({ success: true });
      if (url.endsWith("/register")) {
        return register === "ok"
          ? Response.json({ success: true })
          : Response.json({ error: { message: "Two-step verification PIN mismatch.", code: 133005 } }, { status: 400 });
      }
      return Response.json({ id: "1", display_phone_number: "+233 20 000 0333", verified_name: "Signup Shop", platform_type: platformType });
    }),
  );
  return calls;
}

describe("WhatsApp Embedded Signup", () => {
  const code = "AQB_one_time_code_from_meta";

  it("cannot be submitted without the code, numeric ids and the fees confirmation", () => {
    const details = { code, wabaId: digits(), phoneNumberId: digits() };
    expect(whatsappEmbeddedConnectSchema.safeParse(details).success).toBe(false);
    expect(whatsappEmbeddedConnectSchema.safeParse({ ...details, metaFeesAcknowledged: "on" }).success).toBe(true);
    expect(whatsappEmbeddedConnectSchema.safeParse({ ...details, wabaId: "12/../3", metaFeesAcknowledged: "on" }).success).toBe(false);
    expect(whatsappEmbeddedConnectSchema.safeParse({ ...details, code: "", metaFeesAcknowledged: "on" }).success).toBe(false);
  });

  it("is refused until the platform's Meta app is configured", async () => {
    const { actor } = await setup();
    const calls = stubEmbeddedGraph({ accountNumbers: [] });
    await expect(connectWhatsAppEmbedded(actor, { code, wabaId: digits(), phoneNumberId: digits(), metaFeesAcknowledged: "on" })).rejects.toThrow(/not set up on this platform/);
    expect(calls).toHaveLength(0);
  });

  it("swaps the code for the business's token, activates the number, links it and stores the secrets encrypted", async () => {
    const { actor } = await setup();
    useMetaApp();
    const wabaId = digits();
    const phoneNumberId = digits();
    const calls = stubEmbeddedGraph({ accountNumbers: [digits(), phoneNumberId] });

    await expect(connectWhatsAppEmbedded({ ...actor, emailVerified: false }, { code, wabaId, phoneNumberId, metaFeesAcknowledged: "on" })).rejects.toThrow(/Confirm your email/);
    const integration = await connectWhatsAppEmbedded(actor, { code, wabaId, phoneNumberId, metaFeesAcknowledged: "on" });

    expect(integration).toMatchObject({ channel: "WHATSAPP", status: "CONNECTED", externalAccountId: phoneNumberId, wabaId, displayHandle: "+233 20 000 0333" });
    const exchange = calls.find((call) => call.url.includes("/oauth/access_token"));
    expect(exchange?.url).toContain(`code=${code}`);
    expect(exchange?.url).toContain("client_id=sunleon_app");
    expect(calls).toContainEqual(expect.objectContaining({ url: expect.stringContaining(`/${wabaId}/subscribed_apps`), method: "POST" }));
    const registration = calls.find((call) => call.url.endsWith(`/${phoneNumberId}/register`));
    const sent = JSON.parse(registration?.body ?? "{}") as { messaging_product?: string; pin?: string };
    expect(sent.messaging_product).toBe("whatsapp");
    expect(sent.pin).toMatch(/^\d{6}$/);

    expect(integration.credentialsEnc).not.toContain("EAAB");
    expect(credentialsFor(integration)).toEqual({ accessToken: "EAAB_business_token", registrationPin: sent.pin });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "integration.connected", entityId: integration.id } });
    expect(audit.metadata).toMatchObject({ channel: "WHATSAPP", method: "embedded_signup", metaFeesAcknowledged: true });
  });

  it("does not register a number Meta already has on the Cloud API", async () => {
    const { actor } = await setup();
    useMetaApp();
    const phoneNumberId = digits();
    const calls = stubEmbeddedGraph({ accountNumbers: [phoneNumberId], platformType: "CLOUD_API" });
    const integration = await connectWhatsAppEmbedded(actor, { code, wabaId: digits(), phoneNumberId, metaFeesAcknowledged: "on" });
    expect(calls.some((call) => call.url.endsWith("/register"))).toBe(false);
    expect(credentialsFor(integration)).toEqual({ accessToken: "EAAB_business_token" });
  });

  it("refuses a number that is not in the WhatsApp account the owner picked, and links nothing", async () => {
    const { actor, business } = await setup();
    useMetaApp();
    const calls = stubEmbeddedGraph({ accountNumbers: [digits()] });
    await expect(connectWhatsAppEmbedded(actor, { code, wabaId: digits(), phoneNumberId: digits(), metaFeesAcknowledged: "on" })).rejects.toThrow(/not part of the WhatsApp account/);
    expect(calls.some((call) => call.url.endsWith("/subscribed_apps") || call.url.endsWith("/register"))).toBe(false);
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "WHATSAPP" } })).toBe(0);
  });

  it("asks the owner to try again when the code has expired", async () => {
    const { actor, business } = await setup();
    useMetaApp();
    stubEmbeddedGraph({ accountNumbers: [], exchange: "expired" });
    await expect(connectWhatsAppEmbedded(actor, { code, wabaId: digits(), phoneNumberId: digits(), metaFeesAcknowledged: "on" })).rejects.toThrow(
      /Meta did not accept the sign-in \(This authorization code has expired\.\)\. Click Connect WhatsApp and try again\./,
    );
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "WHATSAPP" } })).toBe(0);
  });

  it("refuses a number another workspace has connected before asking Meta for anything", async () => {
    const first = await setup();
    const second = await setup();
    useMetaApp();
    const phoneNumberId = digits();
    stubEmbeddedGraph({ accountNumbers: [phoneNumberId] });
    await connectWhatsAppEmbedded(first.actor, { code, wabaId: digits(), phoneNumberId, metaFeesAcknowledged: "on" });

    const calls = stubEmbeddedGraph({ accountNumbers: [phoneNumberId] });
    await expect(connectWhatsAppEmbedded(second.actor, { code, wabaId: digits(), phoneNumberId, metaFeesAcknowledged: "on" })).rejects.toThrow(
      /already connected to another SUNLEON AI workspace/,
    );
    expect(calls).toHaveLength(0);
  });

  it("reconnects the same number within the plan's allowance and keeps its PIN", async () => {
    const { actor } = await setup();
    useMetaApp();
    const phoneNumberId = digits();
    const wabaId = digits();
    stubEmbeddedGraph({ accountNumbers: [phoneNumberId] });
    const first = await connectWhatsAppEmbedded(actor, { code, wabaId, phoneNumberId, metaFeesAcknowledged: "on" });
    const pin = credentialsFor(first).registrationPin;
    expect(pin).toMatch(/^\d{6}$/);

    stubEmbeddedGraph({ accountNumbers: [phoneNumberId], platformType: "CLOUD_API" });
    const again = await connectWhatsAppEmbedded(actor, { code, wabaId, phoneNumberId, metaFeesAcknowledged: "on" });
    expect(again.id).toBe(first.id);
    expect(credentialsFor(again)).toEqual({ accessToken: "EAAB_business_token", registrationPin: pin });

    // A fresh token pasted into the manual form also replaces the old one without losing the PIN.
    stubGraph();
    const manual = await connectWhatsApp(actor, { phoneNumberId, wabaId, accessToken: "EAAG".padEnd(40, "n"), metaFeesAcknowledged: "on" });
    expect(credentialsFor(manual)).toEqual({ accessToken: "EAAG".padEnd(40, "n"), registrationPin: pin });
  });

  it("explains a refused activation and links nothing", async () => {
    const { actor, business } = await setup();
    useMetaApp();
    const phoneNumberId = digits();
    const calls = stubEmbeddedGraph({ accountNumbers: [phoneNumberId], register: "refused" });
    await expect(connectWhatsAppEmbedded(actor, { code, wabaId: digits(), phoneNumberId, metaFeesAcknowledged: "on" })).rejects.toThrow(
      /WhatsApp would not switch this number on: Two-step verification PIN mismatch\./,
    );
    expect(calls.some((call) => call.url.endsWith("/subscribed_apps"))).toBe(false);
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "WHATSAPP" } })).toBe(0);
  });
});

/**
 * Fake Graph API for Instagram with Unified Login: code exchange, shared accounts and linking.
 * `granted` are accounts the token's message permission covers without being listed as shared.
 */
function stubInstagramGraph({
  accounts,
  granted = [],
  subscribe = "ok",
}: {
  accounts: { id: string; username: string }[];
  granted?: { id: string; username: string }[];
  subscribe?: "ok" | "refused";
}) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.includes("/oauth/access_token")) return Response.json({ access_token: "EAAB_ig_business_token", token_type: "bearer" });
      if (url.includes("/me/assigned_instagram_accounts")) return Response.json({ data: accounts });
      if (url.includes("/debug_token")) {
        const ids = granted.map((account) => account.id);
        return Response.json({ data: { app_id: "sunleon_app", granular_scopes: [{ scope: "instagram_basic", target_ids: ids }, { scope: "instagram_manage_messages", target_ids: ids }] } });
      }
      const lookup = granted.find((account) => url.includes(`/${account.id}?fields=`));
      if (lookup) return Response.json(lookup);
      if (url.includes("/subscribed_apps")) {
        return subscribe === "ok" ? Response.json({ success: true }) : Response.json({ error: { message: "(#200) Permissions error", code: 200 } }, { status: 403 });
      }
      return Response.json({ error: { message: `Unexpected request ${url}`, code: 1 } }, { status: 400 });
    }),
  );
  return calls;
}

function configureInstagramApp() {
  process.env.META_APP_ID = "sunleon_app";
  process.env.META_APP_SECRET = "sunleon_secret";
  process.env.META_INSTAGRAM_CONFIG_ID = "ig_config";
  resetEnvCache();
}

/** Starts the connection as the owner and returns the one-time state Meta sends back. */
async function startState(actor: TenantActor): Promise<string> {
  return new URL(await startInstagramConnect(actor)).searchParams.get("state")!;
}

describe("Instagram connection (Unified Login)", () => {
  it("binds the single-use state to the user, then connects and links the shared professional account", async () => {
    const { owner, actor, business } = await setup();
    configureInstagramApp();
    const igId = digits();
    const calls = stubInstagramGraph({ accounts: [{ id: igId, username: "channel_shop" }] });

    const login = new URL(await startInstagramConnect(actor));
    expect(`${login.origin}${login.pathname}`).toBe("https://www.facebook.com/dialog/oauth");
    expect(login.searchParams.get("config_id")).toBe("ig_config");
    expect(login.searchParams.get("redirect_uri")).toMatch(/\/api\/integrations\/instagram\/callback$/);
    const state = login.searchParams.get("state")!;
    const stranger = await createUser();
    await expect(completeInstagramConnect(stranger.id, state, "code")).rejects.toThrow(/expired/);

    expect(await completeInstagramConnect(owner.id, state, "code")).toEqual({ businessId: business.id });
    const integration = await prisma.integration.findFirstOrThrow({ where: { businessId: business.id, channel: "INSTAGRAM" } });
    expect(integration).toMatchObject({ status: "CONNECTED", displayHandle: "@channel_shop", externalAccountId: igId, tokenExpiresAt: null });
    expect(credentialsFor(integration)).toEqual({ accessToken: "EAAB_ig_business_token" });
    const exchange = calls.find((call) => call.url.includes("/oauth/access_token"));
    expect(exchange?.url).toContain("code=code&");
    expect(exchange?.url).toContain("redirect_uri=");
    expect(calls).toContainEqual({ url: expect.stringContaining(`/${igId}/subscribed_apps?subscribed_fields=messages,messaging_seen`), method: "POST" });

    await expect(completeInstagramConnect(owner.id, state, "code")).rejects.toThrow(/expired/);
  });

  it("asks the owner to choose an account when none was shared, and saves nothing", async () => {
    const { owner, actor, business } = await setup();
    configureInstagramApp();
    stubInstagramGraph({ accounts: [] });
    await expect(completeInstagramConnect(owner.id, await startState(actor), "code")).rejects.toThrow(/No Instagram professional account was shared/);
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "INSTAGRAM" } })).toBe(0);
  });

  it("connects the account the token was granted when Meta lists none as shared", async () => {
    const { owner, actor, business } = await setup();
    configureInstagramApp();
    const igId = digits();
    const calls = stubInstagramGraph({ accounts: [], granted: [{ id: igId, username: "granted_shop" }] });

    await completeInstagramConnect(owner.id, await startState(actor), "code");
    const integration = await prisma.integration.findFirstOrThrow({ where: { businessId: business.id, channel: "INSTAGRAM" } });
    expect(integration).toMatchObject({ status: "CONNECTED", displayHandle: "@granted_shop", externalAccountId: igId });
    const debug = calls.find((call) => call.url.includes("/debug_token"));
    expect(debug?.url).not.toContain("sunleon_secret");
    expect(calls).toContainEqual({ url: expect.stringContaining(`/${igId}/subscribed_apps`), method: "POST" });
  });

  it("refuses an account another workspace has connected, before linking it", async () => {
    const first = await setup();
    const second = await setup();
    configureInstagramApp();
    const account = { id: digits(), username: "shared_shop" };
    stubInstagramGraph({ accounts: [account] });
    await completeInstagramConnect(first.owner.id, await startState(first.actor), "code");

    const calls = stubInstagramGraph({ accounts: [account] });
    await expect(completeInstagramConnect(second.owner.id, await startState(second.actor), "code")).rejects.toThrow(/already connected to another SUNLEON AI workspace/);
    expect(calls.some((call) => call.url.includes("/subscribed_apps"))).toBe(false);
  });

  it("reconnects the same account without using another channel", async () => {
    const { owner, actor, business } = await setup();
    configureInstagramApp();
    const account = { id: digits(), username: "loyal_shop" };
    stubInstagramGraph({ accounts: [account] });
    await completeInstagramConnect(owner.id, await startState(actor), "code");
    await completeInstagramConnect(owner.id, await startState(actor), "code");
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "INSTAGRAM" } })).toBe(1);
  });

  it("explains a refused link, and enforces the plan's channel allowance once the account is known", async () => {
    const { owner, actor, business } = await setup();
    configureInstagramApp();
    stubInstagramGraph({ accounts: [{ id: digits(), username: "quiet_shop" }], subscribe: "refused" });
    await expect(completeInstagramConnect(owner.id, await startState(actor), "code")).rejects.toThrow(
      /would not send this account's messages to SUNLEON AI: \(#200\) Permissions error/,
    );
    expect(await prisma.integration.count({ where: { businessId: business.id, channel: "INSTAGRAM" } })).toBe(0);

    stubGraph();
    await connectWhatsApp(actor, { phoneNumberId: digits(), wabaId: digits(), accessToken: "EAAG".padEnd(40, "i"), metaFeesAcknowledged: "on" });
    stubInstagramGraph({ accounts: [{ id: digits(), username: "second_channel" }] });
    await expect(completeInstagramConnect(owner.id, await startState(actor), "code")).rejects.toThrow(/allows 1 connected channel/);
  });

  it("picks the shared account this workspace has not connected yet, skipping ones another workspace owns", async () => {
    const first = await setup();
    const second = await setup();
    configureInstagramApp();
    const owned = { id: digits(), username: "agency_owned" };
    const fresh = { id: digits(), username: "new_brand" };
    stubInstagramGraph({ accounts: [owned] });
    await completeInstagramConnect(first.owner.id, await startState(first.actor), "code");

    stubInstagramGraph({ accounts: [owned, fresh] });
    await completeInstagramConnect(second.owner.id, await startState(second.actor), "code");
    const connected = await prisma.integration.findFirstOrThrow({ where: { businessId: second.business.id, channel: "INSTAGRAM" } });
    expect(connected.externalAccountId).toBe(fresh.id);
  });

  it("uses up the one-time state only once, even when Meta's redirect arrives twice at the same moment", async () => {
    const { owner, actor } = await setup();
    configureInstagramApp();
    stubInstagramGraph({ accounts: [{ id: digits(), username: "double_tap" }] });
    const state = await startState(actor);
    const results = await Promise.allSettled([completeInstagramConnect(owner.id, state, "code"), completeInstagramConnect(owner.id, state, "code")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.objectContaining({ message: expect.stringMatching(/expired/) }) });
  });

  it("stops Meta sending an Instagram account's messages when it is disconnected, even if Meta is unreachable", async () => {
    const { owner, actor, business } = await setup();
    configureInstagramApp();
    const account = { id: digits(), username: "leaving_shop" };
    stubInstagramGraph({ accounts: [account] });
    await completeInstagramConnect(owner.id, await startState(actor), "code");
    const integration = await prisma.integration.findFirstOrThrow({ where: { businessId: business.id, channel: "INSTAGRAM" } });

    const calls = stubInstagramGraph({ accounts: [account] });
    await disconnectIntegration(actor, integration.id);
    expect(calls).toContainEqual({ url: expect.stringContaining(`/${account.id}/subscribed_apps`), method: "DELETE" });
    expect(await prisma.integration.findUniqueOrThrow({ where: { id: integration.id } })).toMatchObject({ status: "DISCONNECTED", credentialsEnc: null });

    await completeInstagramConnect(owner.id, await startState(actor), "code");
    const again = await prisma.integration.findUniqueOrThrow({ where: { id: integration.id } });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));
    await disconnectIntegration(actor, again.id);
    expect(await prisma.integration.findUniqueOrThrow({ where: { id: again.id } })).toMatchObject({ status: "DISCONNECTED" });
  });

  it("tells the page why a connection failed", () => {
    expect(instagramFailureNotice(new AppError("LIMIT_EXCEEDED", "limit"))).toBe("limit");
    expect(instagramFailureNotice(new AppError("CONFLICT", "taken"))).toBe("taken");
    expect(instagramFailureNotice(new AppError("VALIDATION", "no account"))).toBe("failed");
    expect(instagramFailureNotice(new Error("network"))).toBe("failed");
  });
});
