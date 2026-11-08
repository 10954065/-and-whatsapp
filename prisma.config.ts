import "dotenv/config";
import { defineConfig } from "prisma/config";

// This file configures the Prisma CLI only (migrate, generate, seed). The CLI uses the
// DIRECT (non-pooled) connection because PgBouncer transaction pooling does not support
// the session-level features Prisma Migrate relies on. Runtime queries use the pooled
// DATABASE_URL through the driver adapter in src/lib/db/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
