import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/monitoring/logger";
import { runJobById } from "@/lib/queue";
import { qstashDestination, verifyQStashSignature } from "@/lib/queue/qstash";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ jobId: z.string().min(1).max(64) });

/**
 * QStash wake-up for one stored job. The signature proves the call came from QStash; the job
 * itself is claimed atomically, so duplicate or late deliveries are harmless. Always answers 200
 * once verified: retries are scheduled by our own queue, not by QStash.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyQStashSignature(request.headers.get("upstash-signature"), rawBody, qstashDestination())) {
    logger.warn("qstash.invalid_signature");
    return new Response("Invalid signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });
  const outcome = await runJobById(parsed.data.jobId, "qstash");
  return NextResponse.json({ ran: outcome !== null, succeeded: outcome === true });
}
