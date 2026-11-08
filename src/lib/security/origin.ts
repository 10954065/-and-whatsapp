import { env } from "@/lib/env";

/**
 * Rejects cross-site requests to cookie-authenticated Route Handlers. Server Actions
 * get an equivalent check from Next.js; this covers our own state-changing routes and
 * complements SameSite=Lax session cookies.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(env().APP_URL).origin, new URL(request.url).origin]);
    return allowed.has(origin);
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin" || fetchSite === "none";
}
