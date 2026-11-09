// Test environment. Tests always use a dedicated database — never the development one.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://sunleon:sunleon_dev_pw@localhost:5440/sunleon_test";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DIRECT_URL = TEST_DATABASE_URL;
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789-abcdefghijklmnop";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.OUTBOUND_MESSAGING_MODE = "sandbox";
process.env.QUEUE_PROVIDER = "inline";
delete process.env.RESEND_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
for (const key of ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_MODEL_FAST", "AI_MODEL_STANDARD", "AI_MODEL_ADVANCED", "AI_MODEL_PRICES", "ANTHROPIC_MODEL_FAST", "ANTHROPIC_MODEL_STANDARD", "ANTHROPIC_MODEL_ADVANCED"]) {
  delete process.env[key];
}
delete process.env.VOYAGE_API_KEY;
