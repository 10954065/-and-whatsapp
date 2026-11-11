/**
 * Meta's WhatsApp Embedded Signup popup reports its progress with window messages. This reads
 * one of them. It runs in the browser, so it trusts nothing: the origin must be facebook.com
 * over https, and ids must be Meta's numeric ids. The server checks them again with Meta.
 */

export type EmbeddedSignupEvent =
  | { kind: "finish"; wabaId: string; phoneNumberId: string }
  | { kind: "no_number" }
  | { kind: "cancel"; step: string | null }
  | { kind: "error"; message: string | null };

const META_ID = /^\d{1,30}$/;

function isMetaOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"));
  } catch {
    return false;
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readEmbeddedSignupMessage(origin: string, payload: unknown): EmbeddedSignupEvent | null {
  if (!isMetaOrigin(origin)) return null;
  let message: unknown = payload;
  if (typeof payload === "string") {
    try {
      message = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!message || typeof message !== "object") return null;
  const { type, event, data } = message as { type?: unknown; event?: unknown; data?: Record<string, unknown> };
  if (type !== "WA_EMBEDDED_SIGNUP" || typeof event !== "string") return null;
  const details = data && typeof data === "object" ? data : {};

  if (event.startsWith("FINISH")) {
    const wabaId = asText(details.waba_id);
    const phoneNumberId = asText(details.phone_number_id);
    if (!wabaId || !phoneNumberId || !META_ID.test(wabaId) || !META_ID.test(phoneNumberId)) return { kind: "no_number" };
    return { kind: "finish", wabaId, phoneNumberId };
  }
  if (event === "CANCEL") return { kind: "cancel", step: asText(details.current_step) };
  if (event === "ERROR") return { kind: "error", message: asText(details.error_message) };
  return null;
}
