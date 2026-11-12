import { logger } from "@/lib/monitoring/logger";
import { parseCspReports } from "@/lib/security/csp-report";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;
/**
 * The endpoint is public and browsers resend the same violation on every page view, so each server
 * instance logs a violation once and stops logging new ones after this many. Nothing touches the database.
 */
const MAX_LOGGED = 500;
const logged = new Set<string>();

/** Browsers post Content-Security-Policy violation reports here (see lib/security/csp.ts). */
export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  for (const violation of parseCspReports(body)) {
    const key = `${violation.page}|${violation.directive}|${violation.blocked}`;
    if (logged.has(key) || logged.size >= MAX_LOGGED) continue;
    logged.add(key);
    logger.warn("security.csp_violation", { ...violation });
  }
  return new Response(null, { status: 204 });
}
