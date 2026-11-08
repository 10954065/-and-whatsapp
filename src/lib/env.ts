import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  APP_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
  OUTBOUND_MESSAGING_MODE: z.enum(["live", "sandbox"]).optional(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, "must be 32 bytes, base64 encoded"),
  CRON_SECRET: optionalString,
  PLATFORM_ADMIN_EMAILS: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  ANTHROPIC_MODEL_STANDARD: z.string().default("claude-sonnet-5-5"),
  ANTHROPIC_MODEL_ADVANCED: z.string().default("claude-opus-5-5"),
  VOYAGE_API_KEY: optionalString,
  VOYAGE_MODEL: z.string().default("voyage-4-lite"),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v27.0"),
  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_WEBHOOK_VERIFY_TOKEN: optionalString,
  META_WHATSAPP_CONFIG_ID: optionalString,
  INSTAGRAM_APP_ID: optionalString,
  INSTAGRAM_APP_SECRET: optionalString,
  PAYSTACK_PUBLIC_KEY: optionalString,
  PAYSTACK_SECRET_KEY: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("SUNLEON AI <no-reply@example.com>"),
  OBJECT_STORAGE_ENDPOINT: optionalString,
  OBJECT_STORAGE_REGION: z.string().default("auto"),
  OBJECT_STORAGE_BUCKET: optionalString,
  OBJECT_STORAGE_ACCESS_KEY: optionalString,
  OBJECT_STORAGE_SECRET_KEY: optionalString,
  QUEUE_PROVIDER: z.enum(["inline", "qstash"]).default("inline"),
  QSTASH_TOKEN: optionalString,
  QSTASH_CURRENT_SIGNING_KEY: optionalString,
  QSTASH_NEXT_SIGNING_KEY: optionalString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Parsed lazily so that `next build` can import
 * modules without every runtime secret being present.
 */
export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid environment configuration — ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Test helper: forces the next env() call to re-read process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function isProductionDeployment(): boolean {
  const current = env();
  return current.NODE_ENV === "production" && (current.VERCEL_ENV ?? "production") === "production";
}

/**
 * Outbound customer messages only reach Meta when the deployment is live.
 * Preview deployments are always sandboxed so they can never message real customers.
 */
export function outboundMessagingMode(): "live" | "sandbox" {
  const current = env();
  if (current.VERCEL_ENV === "preview") return "sandbox";
  if (current.OUTBOUND_MESSAGING_MODE) return current.OUTBOUND_MESSAGING_MODE;
  return isProductionDeployment() ? "live" : "sandbox";
}

/** Which optional providers have credentials. Used for honest status displays. */
export function providerStatus() {
  const current = env();
  return {
    anthropic: Boolean(current.ANTHROPIC_API_KEY),
    voyage: Boolean(current.VOYAGE_API_KEY),
    meta: Boolean(current.META_APP_ID && current.META_APP_SECRET && current.META_WEBHOOK_VERIFY_TOKEN),
    whatsappEmbeddedSignup: Boolean(current.META_APP_ID && current.META_WHATSAPP_CONFIG_ID),
    instagram: Boolean(current.INSTAGRAM_APP_ID && current.INSTAGRAM_APP_SECRET),
    paystack: Boolean(current.PAYSTACK_SECRET_KEY && current.PAYSTACK_PUBLIC_KEY),
    resend: Boolean(current.RESEND_API_KEY),
    objectStorage: Boolean(
      current.OBJECT_STORAGE_ENDPOINT &&
        current.OBJECT_STORAGE_BUCKET &&
        current.OBJECT_STORAGE_ACCESS_KEY &&
        current.OBJECT_STORAGE_SECRET_KEY,
    ),
    qstash: Boolean(current.QSTASH_TOKEN && current.QSTASH_CURRENT_SIGNING_KEY),
  };
}
