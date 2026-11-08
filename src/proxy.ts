import { NextResponse, type NextRequest } from "next/server";

// Both cookie names: "__Host-" prefixed in production, plain in development.
const SESSION_COOKIES = ["__Host-sl_session", "sl_session"];

/**
 * Optimistic check only: requests without a session cookie are sent to sign-in early.
 * Real authentication and tenant authorisation happen in the data access layer
 * (lib/auth/current.ts, lib/auth/tenant.ts) on every request.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(`${request.nextUrl.pathname}${request.nextUrl.search}`)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/onboarding"],
};
