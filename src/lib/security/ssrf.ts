import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { fail } from "@/lib/monitoring/errors";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((total, part) => (total << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True for loopback, private, link-local (incl. cloud metadata 169.254.169.254), CGNAT, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return true;
}

/** Validates that a URL is https, on port 443 and resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw fail.validation("Enter a valid web address.");
  }
  if (url.protocol !== "https:") throw fail.validation("Only https:// addresses can be imported.");
  if (url.username || url.password) throw fail.validation("Addresses with credentials are not allowed.");
  if (url.port && url.port !== "443") throw fail.validation("Only the standard https port is allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw fail.validation("That address is not publicly reachable.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0) throw fail.validation("That website could not be found.");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw fail.validation("That address is not publicly reachable.");
  }
  return url;
}

/**
 * Fetches a public web page as text with SSRF protection: every hop (including redirects)
 * is re-validated, the body is size-capped and the request times out.
 */
export async function fetchPublicText(raw: string, options: { maxBytes?: number; timeoutMs?: number } = {}): Promise<{ url: string; text: string; contentType: string }> {
  const maxBytes = options.maxBytes ?? 2_000_000;
  let current = raw;
  for (let hop = 0; hop < 4; hop += 1) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      headers: { "user-agent": "SUNLEON-AI-KnowledgeImporter/1.0", accept: "text/html,text/plain;q=0.9" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw fail.validation("The website redirected without a destination.");
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw fail.validation(`The website responded with status ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^text\/(html|plain)/i.test(contentType)) throw fail.validation("Only HTML or plain-text pages can be imported.");
    const reader = response.body?.getReader();
    if (!reader) return { url: url.toString(), text: "", contentType };
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw fail.validation("That page is too large to import.");
      }
      chunks.push(value);
    }
    return { url: url.toString(), text: new TextDecoder().decode(Buffer.concat(chunks)), contentType };
  }
  throw fail.validation("The website redirected too many times.");
}
