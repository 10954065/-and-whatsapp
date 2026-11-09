import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

const price = z.number().nonnegative();
const modelPricesSchema = z.record(
  z.string(),
  z.object({ input: price, output: price, cacheRead: price.optional(), cacheWrite: price.optional() }),
);

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
  /** The API format the AI speaks. "openai-compatible" covers OpenAI, Gemini, OpenRouter, Groq, DeepSeek, Mistral, Ollama and similar. */
  AI_PROVIDER: z.enum(["anthropic", "openai-compatible"]).default("anthropic"),
  AI_API_KEY: optionalString,
  /** Provider endpoint. Defaults to https://api.openai.com/v1 for "openai-compatible"; optional for Anthropic (proxies, gateways). */
  AI_BASE_URL: optionalString.pipe(z.url().optional()),
  /** One model for every tier; AI_MODEL_FAST / _STANDARD / _ADVANCED override it per tier. */
  AI_MODEL: optionalString,
  AI_MODEL_FAST: optionalString,
  AI_MODEL_STANDARD: optionalString,
  AI_MODEL_ADVANCED: optionalString,
  /** JSON prices in USD per million tokens for models without built-in pricing, e.g. {"model-id":{"input":0.5,"output":1.5}}. */
  AI_MODEL_PRICES: optionalString.transform((value, context) => {
    if (!value) return undefined;
    let json: unknown;
    try {
      json = JSON.parse(value);
    } catch {
      context.addIssue({ code: "custom", message: "must be valid JSON" });
      return z.NEVER;
    }
    const prices = modelPricesSchema.safeParse(json);
    if (!prices.success) {
      context.addIssue({ code: "custom", message: 'must map model ids to {"input": number, "output": number}' });
      return z.NEVER;
    }
    return prices.data;
  }),
  /** Older names for AI_API_KEY and AI_MODEL_*, still honoured when AI_PROVIDER is anthropic. */
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL_FAST: optionalString,
  ANTHROPIC_MODEL_STANDARD: optionalString,
  ANTHROPIC_MODEL_ADVANCED: optionalString,
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
  /** Regional QStash API base URL; defaults to https://qstash.upstash.io. */
  QSTASH_URL: optionalString.pipe(z.url().optional()),
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
      throw new Error(`Invalid environment configuration: ${issues}`);
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

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_MODELS = { fast: "claude-haiku-5-5", standard: "claude-sonnet-5-5", advanced: "claude-opus-5-5" };

export interface AiProviderSettings {
  provider: Env["AI_PROVIDER"];
  apiKey: string | undefined;
  baseUrl: string | undefined;
  models: { fast: string | undefined; standard: string | undefined; advanced: string | undefined };
  /** Variables still needed before the AI can reply; empty when ready. */
  missing: string[];
}

/**
 * The AI provider as configured. Anthropic is the default and ships with model defaults;
 * any OpenAI-compatible provider needs a key and at least `AI_MODEL`. Unset tiers fall
 * back to the next cheaper one.
 */
export function aiProviderSettings(): AiProviderSettings {
  const current = env();
  const provider = current.AI_PROVIDER;
  const isAnthropic = provider === "anthropic";
  const apiKey = current.AI_API_KEY ?? (isAnthropic ? current.ANTHROPIC_API_KEY : undefined);
  const defaults = isAnthropic
    ? {
        fast: current.ANTHROPIC_MODEL_FAST ?? DEFAULT_ANTHROPIC_MODELS.fast,
        standard: current.ANTHROPIC_MODEL_STANDARD ?? DEFAULT_ANTHROPIC_MODELS.standard,
        advanced: current.ANTHROPIC_MODEL_ADVANCED ?? DEFAULT_ANTHROPIC_MODELS.advanced,
      }
    : undefined;
  const fast = current.AI_MODEL_FAST ?? current.AI_MODEL ?? defaults?.fast;
  const standard = current.AI_MODEL_STANDARD ?? current.AI_MODEL ?? defaults?.standard ?? fast;
  const advanced = current.AI_MODEL_ADVANCED ?? current.AI_MODEL ?? defaults?.advanced ?? standard;
  return {
    provider,
    apiKey,
    baseUrl: current.AI_BASE_URL?.replace(/\/+$/, "") ?? (isAnthropic ? undefined : DEFAULT_OPENAI_COMPATIBLE_BASE_URL),
    models: { fast, standard, advanced },
    missing: [...(apiKey ? [] : ["AI_API_KEY"]), ...(fast ? [] : ["AI_MODEL"])],
  };
}

/** Which optional providers have credentials. Used for honest status displays. */
export function providerStatus() {
  const current = env();
  return {
    ai: aiProviderSettings().missing.length === 0,
    voyage: Boolean(current.VOYAGE_API_KEY),
    meta: Boolean(current.META_APP_ID && current.META_APP_SECRET && current.META_WEBHOOK_VERIFY_TOKEN),
    whatsappEmbeddedSignup: Boolean(current.META_APP_ID && current.META_WHATSAPP_CONFIG_ID),
    instagram: Boolean(current.INSTAGRAM_APP_ID && current.INSTAGRAM_APP_SECRET),
    // Checkout is server-initialised, so only the secret key is needed.
    paystack: Boolean(current.PAYSTACK_SECRET_KEY),
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
