import { execSync } from "node:child_process";

/** Applies all migrations to the test database once before the integration suite. */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://sunleon:sunleon_dev_pw@localhost:5440/sunleon_test";
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
