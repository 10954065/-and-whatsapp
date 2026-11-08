import { headers } from "next/headers";

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Client IP and user agent for rate limiting and audit logs. On Vercel the
 * `x-forwarded-for` header is set by the platform edge, so its first entry is the
 * client address.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
  return {
    ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512) ?? null,
  };
}
