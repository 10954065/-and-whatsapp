import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { fetchPublicText } from "@/lib/security/ssrf";
import {
  exchangeInstagramCode,
  getInstagramProfile,
  getWhatsAppPhoneNumber,
  instagramAuthorizeUrl,
  listWhatsAppTemplates,
  markWhatsAppRead,
  refreshInstagramToken,
  sendInstagramText,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "@/modules/integrations/meta";
import { EMBEDDING_DIMENSIONS, embedTexts, toVectorLiteral } from "@/modules/knowledge/embeddings";

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input instanceof Request ? input.url : input), init));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ["VOYAGE_API_KEY", "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"]) delete process.env[key];
  resetEnvCache();
});

describe("SSRF-safe page fetching", () => {
  // IP literals skip DNS, so these tests never touch the network.
  const PUBLIC = "https://93.184.216.34";

  it("follows public redirects and returns the page text", async () => {
    stubFetch((url) =>
      url === `${PUBLIC}/` ? new Response(null, { status: 301, headers: { location: "/about" } }) : new Response("<h1>About us</h1>", { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
    expect(await fetchPublicText(`${PUBLIC}/`)).toMatchObject({ url: `${PUBLIC}/about`, text: "<h1>About us</h1>" });
  });

  it("re-validates every hop, so a redirect to a private address is refused", async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }));
    await expect(fetchPublicText(`${PUBLIC}/`)).rejects.toThrow(/not publicly reachable/);
  });

  it("refuses non-text content, oversized pages, endless redirects and error statuses", async () => {
    stubFetch(() => new Response("binary", { headers: { "content-type": "application/pdf" } }));
    await expect(fetchPublicText(`${PUBLIC}/`)).rejects.toThrow(/Only HTML or plain-text/);
    stubFetch(() => new Response("x".repeat(5_000), { headers: { "content-type": "text/plain" } }));
    await expect(fetchPublicText(`${PUBLIC}/`, { maxBytes: 1_000 })).rejects.toThrow(/too large/);
    stubFetch(() => new Response(null, { status: 302, headers: { location: `${PUBLIC}/loop` } }));
    await expect(fetchPublicText(`${PUBLIC}/`)).rejects.toThrow(/too many times/);
    stubFetch(() => new Response("gone", { status: 404 }));
    await expect(fetchPublicText(`${PUBLIC}/`)).rejects.toThrow(/status 404/);
  });
});

describe("Voyage embeddings", () => {
  const vector = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? seed : 0));

  it("is unavailable without a key", async () => {
    await expect(embedTexts(["hello"], "query")).rejects.toThrow(/not configured/);
  });

  it("batches requests and keeps vectors in input order", async () => {
    process.env.VOYAGE_API_KEY = "voyage_test";
    resetEnvCache();
    const fetchMock = stubFetch((_url, init) => {
      const { input } = JSON.parse(String(init?.body)) as { input: string[] };
      const data = input.map((text, index) => ({ index, embedding: vector(Number(text)) })).reverse();
      return Response.json({ data });
    });
    const texts = Array.from({ length: 70 }, (_, index) => String(index));
    const vectors = await embedTexts(texts, "document");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vectors.map((entry) => entry[0])).toEqual(texts.map(Number));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ model: "voyage-4-lite", input_type: "document", output_dimension: 1024 });
  });

  it("rejects provider errors and wrong dimensions", async () => {
    process.env.VOYAGE_API_KEY = "voyage_test";
    resetEnvCache();
    stubFetch(() => new Response("rate limited", { status: 429 }));
    await expect(embedTexts(["a"], "query")).rejects.toThrow(/429/);
    stubFetch(() => Response.json({ data: [{ index: 0, embedding: [0.1, 0.2] }] }));
    await expect(embedTexts(["a"], "query")).rejects.toThrow(/dimension/);
  });

  it("formats pgvector literals safely", () => {
    expect(toVectorLiteral([0.5, Number.NaN, -1])).toBe("[0.5,0,-1]");
  });
});

describe("Meta Graph clients", () => {
  const credentials = { accessToken: "EAAG-test" };

  it("sends WhatsApp text, templates and read receipts with the bearer token", async () => {
    const fetchMock = stubFetch(() => Response.json({ messages: [{ id: "wamid.123" }] }));
    expect(await sendWhatsAppText("1055", "233244000111", "Akwaaba!", credentials)).toEqual({ providerMessageId: "wamid.123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v27.0/1055/messages");
    expect(init?.headers).toMatchObject({ authorization: "Bearer EAAG-test" });
    expect(JSON.parse(String(init?.body))).toMatchObject({ messaging_product: "whatsapp", to: "233244000111", type: "text", text: { body: "Akwaaba!" } });

    await sendWhatsAppTemplate("1055", "233244000111", { name: "order_update", language: "en" }, credentials);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ type: "template", template: { name: "order_update", language: { code: "en" }, components: [] } });
    await markWhatsAppRead("1055", "wamid.9", credentials);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ status: "read", message_id: "wamid.9" });
  });

  it("surfaces Graph errors with their status and code", async () => {
    stubFetch(() => Response.json({ error: { message: "Invalid OAuth access token", code: 190 } }, { status: 401 }));
    await expect(getWhatsAppPhoneNumber("1055", credentials)).rejects.toMatchObject({ message: "Invalid OAuth access token", graph: { status: 401, code: 190 } });
    stubFetch(() => Response.json({ data: [] }));
    expect(await listWhatsAppTemplates("waba_1", credentials)).toEqual({ data: [] });
  });

  it("runs the Instagram Login flow: authorise URL, code exchange, refresh, profile and send", async () => {
    expect(() => instagramAuthorizeUrl("state", "https://app.example/cb")).toThrow(/not configured/);
    process.env.INSTAGRAM_APP_ID = "ig_app";
    process.env.INSTAGRAM_APP_SECRET = "ig_secret";
    resetEnvCache();
    const authorize = new URL(instagramAuthorizeUrl("state123", "https://app.example/cb"));
    expect(authorize.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_manage_messages");

    stubFetch((url) => {
      if (url === "https://api.instagram.com/oauth/access_token") return Response.json({ access_token: "short", user_id: 17841400000, permissions: ["instagram_business_basic"] });
      if (url.startsWith("https://graph.instagram.com/access_token")) return Response.json({ access_token: "long", expires_in: 5_184_000 });
      if (url.startsWith("https://graph.instagram.com/refresh_access_token")) return Response.json({ access_token: "refreshed", expires_in: 5_184_000 });
      if (url.includes("/me?fields=")) return Response.json({ user_id: "17841400000", username: "kente_shop" });
      return Response.json({ message_id: "ig-mid-1" });
    });
    const exchanged = await exchangeInstagramCode("code", "https://app.example/cb");
    expect(exchanged).toMatchObject({ accessToken: "long", userId: "17841400000", scopes: ["instagram_business_basic"] });
    expect((await refreshInstagramToken("long")).accessToken).toBe("refreshed");
    expect((await getInstagramProfile("long")).username).toBe("kente_shop");
    expect(await sendInstagramText("igsid_1", "Hello", "long")).toEqual({ providerMessageId: "ig-mid-1" });

    stubFetch(() => Response.json({ error_message: "Invalid code" }, { status: 400 }));
    await expect(exchangeInstagramCode("bad", "https://app.example/cb")).rejects.toThrow(/Invalid code/);
  });
});
