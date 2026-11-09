import { NextResponse } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { isAppError } from "@/lib/monitoring/errors";
import { reportError } from "@/lib/monitoring/report";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { exportBusinessData } from "@/modules/privacy/privacy.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner-only download of the whole workspace as JSON (data portability). */
export async function GET() {
  try {
    const context = await requireTenantAction("business.delete");
    await enforceRateLimit(RATE_LIMITS.dataExport, context.businessId);
    const data = await exportBusinessData(toActor(context, (await getRequestMeta()).ipAddress));
    const fileName = `sunleon-export-${context.business.slug}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${fileName}"`, "cache-control": "no-store" },
    });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
    await reportError(error, { source: "privacy.export" });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
