import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Kojo Admin");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("kente-market-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("Business name")).toBeVisible();
}

async function promoteToSuperAdmin(email: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`UPDATE "User" SET "platformRole" = 'SUPER_ADMIN' WHERE "email" = $1`, [email]);
  } finally {
    await client.end();
  }
}

test("the admin console is invisible to ordinary users", async ({ page }) => {
  await register(page, `user-${Date.now()}@example.test`);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Businesses" })).toHaveCount(0);
});

test("a super-admin must turn on two-factor authentication before using the console", async ({ page }) => {
  const email = `admin-${Date.now()}@example.test`;
  await register(page, email);
  await promoteToSuperAdmin(email);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Two-factor authentication required" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  await page.goto("/admin/businesses");
  await expect(page.getByRole("heading", { name: "Businesses" })).toHaveCount(0);
});
