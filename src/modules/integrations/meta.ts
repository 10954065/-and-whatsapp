import { env } from "@/lib/env";
import { hmacHex, safeEqual } from "@/lib/security/crypto";
import { fail } from "@/lib/monitoring/errors";

/** Verifies `X-Hub-Signature-256: sha256=<hex>` against any configured Meta/Instagram app secret. */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const config = env();
  const secrets = [config.META_APP_SECRET, config.INSTAGRAM_APP_SECRET].filter((secret): secret is string => Boolean(secret));
  return secrets.some((secret) => safeEqual(hmacHex("sha256", secret, rawBody), provided));
}

const graphBase = () => `https://graph.facebook.com/${env().META_GRAPH_API_VERSION}`;
const instagramBase = () => `https://graph.instagram.com/${env().META_GRAPH_API_VERSION}`;

export interface GraphError {
  status: number;
  code?: number;
  message: string;
}

async function graphRequest<T>(url: string, init: RequestInit & { accessToken: string }): Promise<T> {
  const { accessToken, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(rest.headers ?? {}) },
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

export interface WhatsAppCredentials {
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
export async function subscribeWhatsAppWebhooks(wabaId: string, credentials: WhatsAppCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST", accessToken: credentials.accessToken });
}

export async function getWhatsAppPhoneNumber(phoneNumberId: string, credentials: WhatsAppCredentials) {
  return graphRequest<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }>(
    `${graphBase()}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
    { method: "GET", accessToken: credentials.accessToken },
  );
}

export async function sendWhatsAppText(phoneNumberId: string, to: string, text: string, credentials: WhatsAppCredentials) {
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
  credentials: WhatsAppCredentials,
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

export async function markWhatsAppRead(phoneNumberId: string, messageId: string, credentials: WhatsAppCredentials): Promise<void> {
  await graphRequest(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    accessToken: credentials.accessToken,
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
}

export async function listWhatsAppTemplates(wabaId: string, credentials: WhatsAppCredentials) {
  return graphRequest<{ data: { id: string; name: string; language: string; category: string; status: string; components: unknown[] }[] }>(
    `${graphBase()}/${encodeURIComponent(wabaId)}/message_templates?limit=100`,
    { method: "GET", accessToken: credentials.accessToken },
  );
}

// ───────────────────────── Instagram API with Instagram Login ─────────────────────────

export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"];

export function instagramAuthorizeUrl(state: string, redirectUri: string): string {
  const appId = env().INSTAGRAM_APP_ID;
  if (!appId) throw fail.precondition("Instagram is not configured on this platform yet.");
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: INSTAGRAM_SCOPES.join(","), state });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/** Exchanges an OAuth code for a long-lived (≈60 day) Instagram user access token. */
export async function exchangeInstagramCode(code: string, redirectUri: string): Promise<{ accessToken: string; userId: string; expiresAt: Date; scopes: string[] }> {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET } = env();
  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) throw fail.precondition("Instagram is not configured on this platform yet.");
  const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({ client_id: INSTAGRAM_APP_ID, client_secret: INSTAGRAM_APP_SECRET, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
    signal: AbortSignal.timeout(15_000),
  });
  const short = (await shortResponse.json()) as { access_token?: string; user_id?: string | number; permissions?: string[] | string; error_message?: string };
  if (!shortResponse.ok || !short.access_token) throw fail.provider(short.error_message ?? "Instagram rejected the authorisation code.");
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.search = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: INSTAGRAM_APP_SECRET, access_token: short.access_token }).toString();
  const longResponse = await fetch(longUrl, { signal: AbortSignal.timeout(15_000) });
  const long = (await longResponse.json()) as { access_token?: string; expires_in?: number };
  if (!longResponse.ok || !long.access_token) throw fail.provider("Could not obtain a long-lived Instagram token.");
  const permissions = Array.isArray(short.permissions) ? short.permissions : String(short.permissions ?? "").split(",").filter(Boolean);
  return {
    accessToken: long.access_token,
    userId: String(short.user_id),
    expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 86_400) * 1_000),
    scopes: permissions,
  };
}

export async function refreshInstagramToken(accessToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.search = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !body.access_token) throw fail.provider("Instagram token refresh failed.");
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + (body.expires_in ?? 60 * 86_400) * 1_000) };
}

export async function getInstagramProfile(accessToken: string) {
  return graphRequest<{ user_id: string; username: string; name?: string; account_type?: string }>(
    `${instagramBase()}/me?fields=user_id,username,name,account_type`,
    { method: "GET", accessToken },
  );
}

export async function subscribeInstagramWebhooks(accessToken: string): Promise<void> {
  await graphRequest(`${instagramBase()}/me/subscribed_apps?subscribed_fields=messages,messaging_seen`, { method: "POST", accessToken });
}

export async function sendInstagramText(recipientId: string, text: string, accessToken: string) {
  const body = await graphRequest<{ message_id?: string }>(`${instagramBase()}/me/messages`, {
    method: "POST",
    accessToken,
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
