/**
 * Content-Security-Policy for SUNLEON AI. It is sent report-only for now: browsers report what it
 * would block to /api/csp-report and block nothing.
 *
 * Pages rendered per visit (sign-in, app, admin) get a strict policy with a fresh nonce, set by the
 * proxy. The pre-built marketing pages cannot carry a per-visit nonce, so they allow inline scripts;
 * they show no visitor content. next.config.ts imports this file, so it uses no "@/" imports.
 */

export const CSP_HEADER = "Content-Security-Policy-Report-Only";
export const CSP_REPORT_PATH = "/api/csp-report";

/** Path prefixes rendered per visit, which get the nonce policy. The proxy matcher lists the same paths. */
export const NONCE_PAGE_PREFIXES = ["/app", "/admin", "/onboarding", "/login", "/register", "/reset-password", "/verify-email", "/invite"] as const;

/**
 * next-themes' inline script, which picks light or dark before the first paint. Taken from a
 * production build; the CSP end-to-end test fails when a next-themes update changes it.
 */
export const THEME_SCRIPT_HASH = "'sha256-J9cZHZf5nVZbsm7Pqxc8RsURv1AIXkMgbhfrZvoOs/A='";

// Meta's SDK for WhatsApp Embedded Signup (Integrations page) loads from these.
const META_HOSTS = ["https://*.facebook.com", "https://connect.facebook.net"];
// Server Actions that send the browser on to Meta's login or Paystack's checkout.
const FORM_TARGETS = ["https://www.facebook.com", "https://checkout.paystack.com"];

type Directives = Record<string, readonly string[]>;

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

function shared(isDev: boolean): Directives {
  return {
    "default-src": ["'self'"],
    // React needs eval in development only, for its debugging tools.
    "script-src": isDev ? ["'self'", "'unsafe-eval'"] : ["'self'"],
    // Components set style attributes, which only 'unsafe-inline' allows.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "report-uri": [CSP_REPORT_PATH],
  };
}

/**
 * The strict policy for pages rendered per visit, in production. Development serves next-themes
 * unminified, so its script no longer matches THEME_SCRIPT_HASH; the proxy uses the marketing policy
 * there, and the CSP end-to-end test checks this one against a production build.
 */
export function noncePolicy(nonce: string): string {
  const base = shared(false);
  return serialize({
    ...base,
    "script-src": [...base["script-src"], `'nonce-${nonce}'`, THEME_SCRIPT_HASH, "'strict-dynamic'"],
    "connect-src": [...base["connect-src"], ...META_HOSTS],
    "frame-src": ["https://*.facebook.com"],
    "form-action": [...base["form-action"], ...FORM_TARGETS],
  });
}

/** The policy for pre-built marketing pages. */
export function staticPagePolicy(isDev: boolean): string {
  const base = shared(isDev);
  return serialize({ ...base, "script-src": [...base["script-src"], "'unsafe-inline'"] });
}

/** A next.config `headers()` source matching every path except the nonce pages. */
export function staticPagesSource(): string {
  const excluded = NONCE_PAGE_PREFIXES.map((prefix) => `${prefix.slice(1)}(?:/|$)`).join("|");
  return `/((?!${excluded}).*)`;
}
