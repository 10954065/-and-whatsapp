import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // SUNLEON AI is mostly authenticated, per-tenant UI; the classic dynamic rendering
  // model is used instead of Cache Components (see docs/PROJECT_AUDIT.md).
  cacheComponents: false,
  // Do not generate AGENTS.md / CLAUDE.md files during `next dev`.
  agentRules: false,
  poweredByHeader: false,
  // Native / Node-only packages that must not be bundled.
  serverExternalPackages: ["@node-rs/argon2", "pg", "mammoth", "unpdf"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
