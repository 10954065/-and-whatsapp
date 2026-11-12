/** One CSP violation, trimmed to what helps tune the policy: no query strings, no page content. */
export interface CspViolation {
  page: string;
  directive: string;
  blocked: string;
  source: string | null;
  line: number | null;
}

const MAX_REPORTS_PER_BODY = 20;
const MAX_FIELD_LENGTH = 200;

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(fields: Fields, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/** Drops the query and fragment (reset links carry tokens there); keeps keywords such as "inline" and "eval". */
function withoutQuery(value: string | null, keepOrigin: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${keepOrigin ? url.origin : ""}${url.pathname}`.slice(0, MAX_FIELD_LENGTH);
  } catch {
    return value.split(/[?#]/)[0].slice(0, MAX_FIELD_LENGTH);
  }
}

function toViolation(fields: Fields): CspViolation | null {
  const directive = text(fields, "effective-directive", "effectiveDirective", "violated-directive");
  if (!directive) return null;
  const line = fields["line-number"] ?? fields.lineNumber;
  return {
    page: withoutQuery(text(fields, "document-uri", "documentURL"), false) ?? "unknown",
    directive: directive.split(" ")[0].slice(0, MAX_FIELD_LENGTH),
    blocked: withoutQuery(text(fields, "blocked-uri", "blockedURL"), true) ?? "unknown",
    source: withoutQuery(text(fields, "source-file", "sourceFile"), true),
    line: typeof line === "number" && Number.isFinite(line) ? line : null,
  };
}

/**
 * Reads a browser's CSP report body in either format: `report-uri` ({"csp-report": {...}}) or the
 * Reporting API ([{ type: "csp-violation", body: {...} }]). Anything else gives an empty list.
 */
export function parseCspReports(body: string): CspViolation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const reports = Array.isArray(parsed) ? parsed.map((entry) => (isFields(entry) ? entry.body : null)) : [isFields(parsed) ? parsed["csp-report"] : null];
  return reports
    .slice(0, MAX_REPORTS_PER_BODY)
    .filter(isFields)
    .map(toViolation)
    .filter((violation): violation is CspViolation => violation !== null);
}
