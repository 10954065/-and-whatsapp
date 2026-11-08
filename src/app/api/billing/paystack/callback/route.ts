import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { reportError } from "@/lib/monitoring/report";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { confirmPayment, type PaymentOutcome } from "@/modules/billing/billing.service";

export const dynamic = "force-dynamic";

/**
 * Where Paystack sends the owner after checkout. The redirect itself proves nothing: the
 * payment is confirmed server-side with the verify API before anything changes.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference") ?? params.get("trxref");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await consumeRateLimit(RATE_LIMITS.billingCallback, ip);

  let outcome: PaymentOutcome = "unknown";
  if (limit.allowed && reference && /^[A-Za-z0-9.=-]{1,100}$/.test(reference)) {
    try {
      outcome = await confirmPayment(reference);
    } catch (error) {
      await reportError(error, { source: "billing.callback", reference });
      outcome = "pending";
    }
  }
  return NextResponse.redirect(`${env().APP_URL}/app/billing?payment=${outcome}`, { status: 303 });
}
