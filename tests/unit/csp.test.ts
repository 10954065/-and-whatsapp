import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/csp-report/route";
import { logger } from "@/lib/monitoring/logger";
import { CSP_HEADER, NONCE_PAGE_PREFIXES, noncePolicy, staticPagePolicy, staticPagesSource, THEME_SCRIPT_HASH } from "@/lib/security/csp";
import { parseCspReports } from "@/lib/security/csp-report";
import { config, proxy } from "@/proxy";

function directive(policy: string, name: string): string {
  return policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("Content-Security-Policy", () => {
  it("gives pages rendered per visit a nonce, the theme script's hash and no inline scripts", () => {
    const scripts = directive(noncePolicy("abc123"), "script-src");
    expect(scripts).toBe(`script-src 'self' 'nonce-abc123' ${THEME_SCRIPT_HASH} 'strict-dynamic'`);
    expect(noncePolicy("abc123")).toContain("form-action 'self' https://www.facebook.com https://checkout.paystack.com");
  });

  it("lets pre-built marketing pages run inline scripts but nothing from other sites", () => {
    expect(directive(staticPagePolicy(false), "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(staticPagePolicy(false)).toContain("frame-ancestors 'none'");
    expect(staticPagePolicy(false)).toContain("report-uri /api/csp-report");
  });

  it("allows eval only in development", () => {
    expect(directive(staticPagePolicy(true), "script-src")).toContain("'unsafe-eval'");
    expect(directive(staticPagePolicy(false), "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(noncePolicy("n"), "script-src")).not.toContain("'unsafe-eval'");
  });

  it("sends the marketing policy everywhere except the pages the proxy covers", () => {
    const marketing = new RegExp(`^${staticPagesSource()}$`);
    for (const path of ["/", "/industries", "/pricing", "/api/health", "/application"]) expect(marketing.test(path), path).toBe(true);
    for (const path of ["/app", "/app/inbox", "/login", "/login/mfa", "/invite/abc", "/onboarding"]) expect(marketing.test(path), path).toBe(false);
  });
});

describe("proxy", () => {
  it("covers exactly the pages that get the nonce policy", () => {
    expect(config.matcher.map((entry) => entry.replace("/:path*", ""))).toEqual([...NONCE_PAGE_PREFIXES]);
  });

  it("still sends visitors without a session to sign-in", () => {
    const response = proxy(new NextRequest("https://www.sunleon-ai.com/app/inbox?conversation=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.sunleon-ai.com/login?next=%2Fapp%2Finbox%3Fconversation%3D1");
  });

  it("gives every visit its own nonce, on the response and on the request Next.js renders from", () => {
    const first = proxy(new NextRequest("https://www.sunleon-ai.com/login"));
    const second = proxy(new NextRequest("https://www.sunleon-ai.com/login"));
    const policy = first.headers.get(CSP_HEADER) ?? "";
    expect(policy).toMatch(/'nonce-[A-Za-z0-9+/=]{20,}'/);
    expect(first.headers.get(`x-middleware-request-${CSP_HEADER.toLowerCase()}`)).toBe(policy);
    expect(second.headers.get(CSP_HEADER)).not.toBe(policy);
  });
});

describe("CSP reports", () => {
  const legacy = JSON.stringify({
    "csp-report": {
      "document-uri": "https://www.sunleon-ai.com/reset-password?token=secret-token",
      "effective-directive": "script-src-elem",
      "blocked-uri": "https://evil.example/x.js?key=1",
      "source-file": "https://www.sunleon-ai.com/_next/static/chunks/a.js?v=2",
      "line-number": 12,
    },
  });

  it("reads both report formats and drops query strings, so reset tokens never reach the logs", () => {
    expect(parseCspReports(legacy)).toEqual([
      { page: "/reset-password", directive: "script-src-elem", blocked: "https://evil.example/x.js", source: "https://www.sunleon-ai.com/_next/static/chunks/a.js", line: 12 },
    ]);
    const modern = JSON.stringify([{ type: "csp-violation", body: { documentURL: "https://www.sunleon-ai.com/login", effectiveDirective: "script-src-elem", blockedURL: "inline" } }]);
    expect(parseCspReports(modern)).toEqual([{ page: "/login", directive: "script-src-elem", blocked: "inline", source: null, line: null }]);
    expect(parseCspReports("not json")).toEqual([]);
  });

  it("logs each violation once and refuses oversized bodies", async () => {
    const send = (body: string) => POST(new Request("https://www.sunleon-ai.com/api/csp-report", { method: "POST", body }));
    expect((await send(legacy)).status).toBe(204);
    expect((await send(legacy)).status).toBe(204);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith("security.csp_violation", expect.objectContaining({ page: "/reset-password" }));
    expect((await send("x".repeat(20_000))).status).toBe(413);
  });
});
