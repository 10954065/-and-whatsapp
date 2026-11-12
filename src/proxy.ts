import { NextResponse, type NextRequest } from "next/server";
import { CSP_HEADER, noncePolicy, staticPagePolicy } from "@/lib/security/csp";

// Both cookie names: "__Host-" prefixed in production, plain in development.
const SESSION_COOKIES = ["__Host-sl_session", "sl_session"];
const SIGNED_IN_PREFIXES = ["/app", "/admin", "/onboarding"];

/**
 * Two jobs on the pages rendered per visit:
 * 1. Optimistic sign-in check: requests to the signed-in areas without a session cookie go to
 *    sign-in early. Real authentication and tenant authorisation happen in the data access layer
 *    (lib/auth/current.ts, lib/auth/tenant.ts) on every request.
 * 2. A fresh CSP nonce (lib/security/csp.ts). Next.js reads it from the request header and puts it
 *    on its own scripts. Development gets the looser marketing policy instead (see noncePolicy).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsSession = SIGNED_IN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (needsSession && !SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
    return NextResponse.redirect(loginUrl);
  }

  const policy = process.env.NODE_ENV === "development" ? staticPagePolicy(true) : noncePolicy(Buffer.from(crypto.randomUUID()).toString("base64"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

// The same paths as NONCE_PAGE_PREFIXES in lib/security/csp.ts (a test keeps them in step).
export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/onboarding/:path*", "/login/:path*", "/register/:path*", "/reset-password/:path*", "/verify-email/:path*", "/invite/:path*"],
};
