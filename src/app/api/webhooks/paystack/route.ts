import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/monitoring/logger";
import { enqueueJob } from "@/lib/queue";
import { sha256Hex } from "@/lib/security/crypto";
import { PAYSTACK_WEBHOOK_JOB } from "@/modules/billing/billing.service";
import { verifyPaystackSignature } from "@/modules/billing/paystack";

export const dynamic = "force-dynamic";

/** Paystack event bodies are a few kilobytes; anything far larger is not from Paystack. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Paystack events: verify `x-paystack-signature` on the raw body (before touching the
 * database, so unsigned floods cost no writes) → persist once → enqueue → acknowledge quickly.
 * A redelivery of a stored-but-unfinished event is enqueued again, so a failed enqueue can
 * never lose a payment. Payments are confirmed in the job via the verify API.
 */
export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    logger.warn("webhook.paystack.invalid_signature", { ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { event?: string; data?: { id?: number | string; reference?: string } };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const identity = payload.data?.reference ?? payload.data?.id ?? sha256Hex(rawBody);
  const dedupeKey = `paystack:${payload.event ?? "unknown"}:${identity}`;
  let event: { id: string; status: string };
  let duplicate = false;
  try {
    event = await prisma.webhookEvent.create({
      data: { provider: "PAYSTACK", dedupeKey, eventType: payload.event ?? null, signatureValid: true, payload: payload as Prisma.InputJsonValue },
      select: { id: true, status: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    event = await prisma.webhookEvent.findUniqueOrThrow({ where: { dedupeKey }, select: { id: true, status: true } });
    duplicate = true;
  }
  if (event.status !== "PROCESSED" && event.status !== "IGNORED") {
    // Idempotent: an existing job for this event is reused, a missing one is created.
    await enqueueJob(PAYSTACK_WEBHOOK_JOB, { eventId: event.id }, { idempotencyKey: `${PAYSTACK_WEBHOOK_JOB}:${event.id}`, priority: 20 });
  }
  return NextResponse.json({ received: true, ...(duplicate ? { duplicate: true } : {}) });
}
