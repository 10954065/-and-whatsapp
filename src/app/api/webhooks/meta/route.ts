import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/monitoring/logger";
import { enqueueJob } from "@/lib/queue";
import { safeEqual, sha256Hex } from "@/lib/security/crypto";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseMetaWebhook, verifyMetaSignature } from "@/modules/integrations/meta";

export const dynamic = "force-dynamic";

/** Meta webhook verification handshake. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = env().META_WEBHOOK_VERIFY_TOKEN;
  if (params.get("hub.mode") === "subscribe" && token && safeEqual(params.get("hub.verify_token") ?? "", token)) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Receives WhatsApp and Instagram events: verify signature on the raw body → persist once
 * (dedupe key) → enqueue processing → acknowledge quickly. Heavy work happens in jobs.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await consumeRateLimit(RATE_LIMITS.webhookIp, ip);
  if (!limit.allowed) return new Response("Too many requests", { status: 429 });

  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    logger.warn("webhook.meta.invalid_signature", { ip });
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(rawBody) as Prisma.InputJsonValue;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const events = parseMetaWebhook(payload);
  const ids = events.map((event) => `${event.kind}:${event.providerMessageId}:${event.kind === "status" ? event.status : ""}`).sort();
  const dedupeKey = `meta:${ids.length ? sha256Hex(ids.join("|")) : sha256Hex(rawBody)}`;

  try {
    const event = await prisma.webhookEvent.create({
      data: { provider: "META", dedupeKey, eventType: (payload as { object?: string }).object ?? null, signatureValid: true, payload },
    });
    await enqueueJob("webhook.meta", { eventId: event.id }, { idempotencyKey: `webhook.meta:${event.id}`, priority: 20 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    throw error;
  }
  return NextResponse.json({ received: true });
}
