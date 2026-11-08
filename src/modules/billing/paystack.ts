import { z } from "zod";
import { env } from "@/lib/env";
import { fail } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";
import { hmacHex, safeEqual } from "@/lib/security/crypto";

const PAYSTACK_API = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = 15_000;
/** Paystack only redirects customers to its hosted checkout. */
const CHECKOUT_HOSTS = new Set(["checkout.paystack.com"]);

export function isPaystackConfigured(): boolean {
  return Boolean(env().PAYSTACK_SECRET_KEY);
}

function secretKey(): string {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key) throw fail.precondition("Online payments are not configured on this platform yet.");
  return key;
}

/** `x-paystack-signature` is the hex HMAC-SHA512 of the raw body, keyed with the secret key. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret = env().PAYSTACK_SECRET_KEY): boolean {
  if (!secret || !signature) return false;
  return safeEqual(hmacHex("sha512", secret, rawBody), signature);
}

const initializeResponse = z.object({
  status: z.literal(true),
  data: z.object({ authorization_url: z.url(), access_code: z.string(), reference: z.string() }),
});

const transactionSchema = z.object({
  id: z.number(),
  status: z.string(),
  reference: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  channel: z.string().nullish(),
  gateway_response: z.string().nullish(),
  paid_at: z.string().nullish(),
  customer: z.object({ customer_code: z.string().nullish(), email: z.string().nullish() }).nullish(),
});

export type PaystackTransaction = z.infer<typeof transactionSchema>;

const verifyResponse = z.object({ status: z.literal(true), data: transactionSchema });

async function paystackRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${secretKey()}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw fail.provider("We couldn't reach Paystack. Please try again in a moment.", error);
  }
  const body = (await response.json().catch(() => null)) as { status?: boolean; message?: string } | null;
  if (!response.ok || !body?.status) {
    // Paystack's message can describe our account setup; keep it in the logs, not the UI.
    logger.warn("paystack.request_rejected", { path: path.split("/").slice(0, 3).join("/"), status: response.status, message: body?.message });
    throw fail.provider("Paystack couldn't process this request. Please try again, or contact support if it keeps happening.");
  }
  return body;
}

export async function initializeTransaction(input: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const body = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountMinor),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify(input.metadata),
    }),
  });
  const parsed = initializeResponse.safeParse(body);
  if (!parsed.success) throw fail.provider("Paystack returned an unexpected response.");
  const url = new URL(parsed.data.data.authorization_url);
  if (url.protocol !== "https:" || !CHECKOUT_HOSTS.has(url.hostname)) throw fail.provider("Paystack returned an unexpected checkout address.");
  return { authorizationUrl: url.toString(), reference: parsed.data.data.reference };
}

/** Server-side confirmation: the only source of truth for whether a payment succeeded. */
export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  const body = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  const parsed = verifyResponse.safeParse(body);
  if (!parsed.success) throw fail.provider("Paystack returned an unexpected verification response.");
  return parsed.data.data;
}
