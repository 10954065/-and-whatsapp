import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/env.ts"],
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts", "tests/security/**/*.test.ts"],
          globalSetup: ["tests/setup/global-db.ts"],
          // Integration tests share one PostgreSQL database.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/modules/**", "src/config/**"],
      exclude: ["src/**/*.actions.ts", "src/generated/**"],
      reporter: ["text-summary", "html"],
    },
  },
});
