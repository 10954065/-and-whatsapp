import "dotenv/config";
import { Client } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * E2E runs register several accounts from one IP, so repeated local runs would trip the real
 * sign-up rate limit. Clears rate-limit buckets — but only on a local database, never a remote one.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for E2E tests.");
  if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
    throw new Error("E2E tests reset rate limits and must run against a local database.");
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DELETE FROM "RateLimitBucket"');
  } finally {
    await client.end();
  }
}
