import { env } from "@/lib/env";
import { hmacHex, safeEqual } from "@/lib/security/crypto";
import { fail } from "@/lib/monitoring/errors";

/** Verifies `X-Hub-Signature-256: sha256=<hex>` with the Meta app secret (WhatsApp and Instagram both use it). */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const secret = env().META_APP_SECRET;
  if (!secret) return false;
  return safeEqual(hmacHex("sha256", secret, rawBody), header.slice("sha256=".length));
}

const graphBase = () => `https://graph.facebook.com/${env().META_GRAPH_API_VERSION}`;

export interface GraphError {
  status: number;
  code?: number;
  message: string;
}

async function graphRequest<T>(url: string, init: RequestInit & { accessToken: string | null }): Promise<T> {
  const { accessToken, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), "content-type": "application/json", ...(rest.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!response.ok || body.error) {
    const error: GraphError = { status: response.status, code: body.error?.code, message: body.error?.message ?? `Meta API error ${response.status}` };
    throw Object.assign(new Error(error.message), { graph: error });
  }
  return body;
}

// ───────────────────────────── WhatsApp Cloud API ─────────────────────────────

export interface MetaCredentials {
  accessToken: string;
}

/**
 * The Meta app a token was issued for, read with the platform's own app token. Null when the
 * platform app is not configured or Meta does not say.
 */
export async function getTokenAppId(accessToken: string): Promise<string | null> {
  const { META_APP_ID: appId, META_APP_SECRET: appSecret } = env();
  if (!appId || !appSecret) return null;
  const body = await graphRequest<{ data?: { app_id?: string } }>(`${graphBase()}/debug_token?input_token=${encodeURIComponent(accessToken)}`, {
    method: "GET",
    accessToken: `${appId}|${appSecret}`,
  });
  return body.data?.app_id ?? null;
}

/** Sends a WhatsApp Business Account's webhooks (incoming messages, delivery statuses) to the token's app. */
export async function subscribeWhatsAppWebhooks(wabaId: string, credentials: MetaCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST", accessToken: credentials.accessToken });
}

export async function getWhatsAppPhoneNumber(phoneNumberId: string, credentials: MetaCredentials) {
  return graphRequest<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string; platform_type?: string }>(
    `${graphBase()}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating,platform_type`,
    { method: "GET", accessToken: credentials.accessToken },
  );
}

/**
 * Facebook Login for Business (WhatsApp Embedded Signup, Instagram Unified Login) returns a
 * one-time code. Swapping it with the platform's app secret gives the business token for the
 * assets the owner just shared. A code from a redirect needs the same redirect URI back.
 */
export async function exchangeBusinessLoginCode(code: string, redirectUri?: string): Promise<string> {
  const { META_APP_ID: appId, META_APP_SECRET: appSecret } = env();
  if (!appId || !appSecret) throw fail.precondition("Meta is not configured on this platform yet.");
  const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code, ...(redirectUri ? { redirect_uri: redirectUri } : {}) });
  const body = await graphRequest<{ access_token?: string }>(`${graphBase()}/oauth/access_token?${params.toString()}`, { method: "GET", accessToken: null });
  if (!body.access_token) throw new Error("Meta returned no access token.");
  return body.access_token;
}

/** Ids of the phone numbers in a WhatsApp Business Account. */
export async function listWhatsAppAccountNumberIds(wabaId: string, credentials: MetaCredentials): Promise<string[]> {
  const body = await graphRequest<{ data?: { id: string }[] }>(`${graphBase()}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id&limit=100`, {
    method: "GET",
    accessToken: credentials.accessToken,
  });
  return (body.data ?? []).map((number) => number.id);
}

/** Switches a number on for the Cloud API. The PIN becomes the number's two-step verification PIN. */
export async function registerWhatsAppNumber(phoneNumberId: string, pin: string, credentials: MetaCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/register`, {
    method: "POST",
    accessToken: credentials.accessToken,
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
}

export async function sendWhatsAppText(phoneNumberId: string, to: string, text: string, credentials: MetaCredentials) {
  const body = await graphRequest<{ messages: { id: string }[] }>(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    accessToken: credentials.accessToken,
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }),
  });
  return { providerMessageId: body.messages[0]?.id ?? null };
}

export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  to: string,
  template: { name: string; language: string; components?: unknown[] },
  credentials: MetaCredentials,
) {
  const body = await graphRequest<{ messages: { id: string }[] }>(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    accessToken: credentials.accessToken,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template.name, language: { code: template.language }, components: template.components ?? [] },
    }),
  });
  return { providerMessageId: body.messages[0]?.id ?? null };
}

export async function markWhatsAppRead(phoneNumberId: string, messageId: string, credentials: MetaCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    accessToken: credentials.accessToken,
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
}

export async function listWhatsAppTemplates(wabaId: string, credentials: MetaCredentials) {
  return graphRequest<{ data: { id: string; name: string; language: string; category: string; status: string; components: unknown[] }[] }>(
    `${graphBase()}/${encodeURIComponent(wabaId)}/message_templates?limit=100`,
    { method: "GET", accessToken: credentials.accessToken },
  );
}

// ───────────────────────── Instagram API with Unified Login ─────────────────────────
// Built on Facebook Login for Business: the owner logs in with Instagram or Facebook, and the
// platform receives a business token (system user, set to never expire) for graph.facebook.com.

/** Meta's login dialog for the Instagram configuration. Its code comes back to `redirectUri`. */
export function instagramLoginUrl(state: string, redirectUri: string): string {
  const { META_APP_ID: appId, META_INSTAGRAM_CONFIG_ID: configId } = env();
  if (!appId || !configId) throw fail.precondition("Instagram is not configured on this platform yet.");
  // prompt=login always offers both the Instagram and the Facebook login.
  const params = new URLSearchParams({ client_id: appId, config_id: configId, redirect_uri: redirectUri, response_type: "code", state, prompt: "login" });
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

/** Instagram professional accounts the owner shared with the platform during login. */
export async function listInstagramAccounts(credentials: MetaCredentials): Promise<{ id: string; username: string }[]> {
  const body = await graphRequest<{ data?: { id: string; username?: string }[] }>(`${graphBase()}/me/assigned_instagram_accounts?fields=id,username&limit=100`, {
    method: "GET",
    accessToken: credentials.accessToken,
  });
  return (body.data ?? []).map((account) => ({ id: account.id, username: account.username ?? account.id }));
}

export async function getInstagramAccount(accountId: string, credentials: MetaCredentials) {
  return graphRequest<{ id: string; username?: string; name?: string }>(`${graphBase()}/${encodeURIComponent(accountId)}?fields=id,username,name`, {
    method: "GET",
    accessToken: credentials.accessToken,
  });
}

/** Sends the account's message webhooks to the platform; without this, DMs never arrive. */
export async function subscribeInstagramWebhooks(accountId: string, credentials: MetaCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(accountId)}/subscribed_apps?subscribed_fields=messages,messaging_seen`, {
    method: "POST",
    accessToken: credentials.accessToken,
  });
}

/** Stops the account's webhooks; the business token itself stays with the business until it removes the app. */
export async function unsubscribeInstagramWebhooks(accountId: string, credentials: MetaCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(accountId)}/subscribed_apps`, { method: "DELETE", accessToken: credentials.accessToken });
}

export async function sendInstagramText(accountId: string, recipientId: string, text: string, credentials: MetaCredentials) {
  const body = await graphRequest<{ message_id?: string }>(`${graphBase()}/${encodeURIComponent(accountId)}/messages`, {
    method: "POST",
    accessToken: credentials.accessToken,
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  return { providerMessageId: body.message_id ?? null };
}

// ───────────────────────────── Webhook parsing ─────────────────────────────

export type NormalizedEvent =
  | {
      kind: "message";
      channel: "WHATSAPP" | "INSTAGRAM";
      accountId: string;
      customerExternalId: string;
      customerName: string | null;
      providerMessageId: string;
      type: "TEXT" | "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "STICKER" | "LOCATION" | "INTERACTIVE" | "REACTION" | "UNSUPPORTED";
      text: string | null;
      timestamp: Date;
      attachments: { kind: string; providerMediaId?: string; url?: string; mimeType?: string }[];
    }
  | {
      kind: "status";
      channel: "WHATSAPP" | "INSTAGRAM";
      accountId: string;
      providerMessageId: string;
      status: "SENT" | "DELIVERED" | "READ" | "FAILED";
      timestamp: Date;
      errorCode?: string;
      errorMessage?: string;
    };

type InboundMessageType = Extract<NormalizedEvent, { kind: "message" }>["type"];

const WHATSAPP_TYPES: Record<string, InboundMessageType> = {
  text: "TEXT",
  image: "IMAGE",
  audio: "AUDIO",
  voice: "AUDIO",
  video: "VIDEO",
  document: "DOCUMENT",
  sticker: "STICKER",
  location: "LOCATION",
  interactive: "INTERACTIVE",
  button: "INTERACTIVE",
  reaction: "REACTION",
};

interface WhatsAppValue {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
    button?: { text?: string };
    image?: { id?: string; mime_type?: string; caption?: string };
    document?: { id?: string; mime_type?: string; caption?: string };
    audio?: { id?: string; mime_type?: string };
    video?: { id?: string; mime_type?: string; caption?: string };
    location?: { latitude?: number; longitude?: number; name?: string };
  }[];
  statuses?: { id: string; status: string; timestamp: string; errors?: { code?: number; title?: string; message?: string }[] }[];
}

interface InstagramMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: { type?: string; payload?: { url?: string } }[] };
  read?: { mid?: string };
}

/** Converts a Meta webhook payload into channel-agnostic events. Unknown shapes are ignored. */
export function parseMetaWebhook(payload: unknown): NormalizedEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { object?: string; entry?: { id?: string; changes?: { field?: string; value?: WhatsAppValue }[]; messaging?: InstagramMessaging[] }[] };
  const events: NormalizedEvent[] = [];
  if (body.object === "whatsapp_business_account") {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const accountId = value?.metadata?.phone_number_id;
        if (!value || !accountId) continue;
        const names = new Map((value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null]));
        for (const message of value.messages ?? []) {
          const media = message.image ?? message.document ?? message.audio ?? message.video;
          const text =
            message.text?.body ??
            message.interactive?.button_reply?.title ??
            message.interactive?.list_reply?.title ??
            message.button?.text ??
            message.image?.caption ??
            message.document?.caption ??
            message.video?.caption ??
            (message.location ? `Location: ${message.location.name ?? ""} (${message.location.latitude}, ${message.location.longitude})` : null);
          events.push({
            kind: "message",
            channel: "WHATSAPP",
            accountId,
            customerExternalId: message.from,
            customerName: names.get(message.from) ?? null,
            providerMessageId: message.id,
            type: WHATSAPP_TYPES[message.type] ?? "UNSUPPORTED",
            text: text ?? null,
            timestamp: new Date(Number(message.timestamp) * 1_000),
            attachments: media ? [{ kind: message.type, providerMediaId: media.id, mimeType: media.mime_type }] : [],
          });
        }
        for (const status of value.statuses ?? []) {
          const mapped = ({ sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as const)[status.status as "sent"];
          if (!mapped) continue;
          events.push({
            kind: "status",
            channel: "WHATSAPP",
            accountId,
            providerMessageId: status.id,
            status: mapped,
            timestamp: new Date(Number(status.timestamp) * 1_000),
            errorCode: status.errors?.[0]?.code?.toString(),
            errorMessage: status.errors?.[0]?.message ?? status.errors?.[0]?.title,
          });
        }
      }
    }
  }
  if (body.object === "instagram") {
    for (const entry of body.entry ?? []) {
      for (const messaging of entry.messaging ?? []) {
        const accountId = entry.id;
        if (!accountId) continue;
        if (messaging.message?.mid && !messaging.message.is_echo && messaging.sender?.id && messaging.sender.id !== accountId) {
          const attachment = messaging.message.attachments?.[0];
          events.push({
            kind: "message",
            channel: "INSTAGRAM",
            accountId,
            customerExternalId: messaging.sender.id,
            customerName: null,
            providerMessageId: messaging.message.mid,
            type: messaging.message.text ? "TEXT" : attachment?.type === "image" ? "IMAGE" : attachment ? "UNSUPPORTED" : "TEXT",
            text: messaging.message.text ?? null,
            timestamp: new Date(messaging.timestamp ?? Date.now()),
            attachments: attachment ? [{ kind: attachment.type ?? "file", url: attachment.payload?.url }] : [],
          });
        }
        if (messaging.read?.mid) {
          events.push({ kind: "status", channel: "INSTAGRAM", accountId, providerMessageId: messaging.read.mid, status: "READ", timestamp: new Date(messaging.timestamp ?? Date.now()) });
        }
      }
    }
  }
  return events;
}
