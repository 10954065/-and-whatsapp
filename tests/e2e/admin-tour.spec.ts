import "dotenv/config";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";
import { Client } from "pg";

/** Set SCREENSHOT_DIR to keep a screenshot of every admin page (e.g. for a headed walkthrough). */
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR;
let shot = 0;

async function capture(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  shot += 1;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${String(shot).padStart(2, "0")}-${name}.png`), fullPage: true });
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

test("a super-admin with two-factor authentication uses every admin page", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `admin-tour-${Date.now()}@example.test`;
  const businessName = `Kofi's Electronics ${Date.now().toString().slice(-5)}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Kofi Mensah");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("kente-market-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Business name").fill(businessName);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/app\/setup$/);
  await promoteToSuperAdmin(email);

  // Two-factor authentication with a real TOTP code from the displayed key.
  await page.goto("/app/account");
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const secret = (await page.locator("code").first().innerText()).trim();
  const code = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("Save your recovery codes")).toBeVisible();
  await capture(page, "account-2fa-on");

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Admin console" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Admin console" }).click();

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Active businesses")).toBeVisible();
  await capture(page, "admin-overview");

  const nav = page.getByRole("navigation", { name: "Admin" });
  await nav.getByRole("link", { name: "Businesses" }).click();
  await page.getByLabel("Search businesses").fill(businessName);
  await page.getByRole("button", { name: "Search" }).click();
  await capture(page, "admin-businesses");
  await page.getByRole("link", { name: businessName }).click();
  await expect(page.getByRole("heading", { name: businessName })).toBeVisible();
  await page.getByLabel("Note (internal, never shown to the business)").fill("Walkthrough: onboarding call booked for Monday.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Walkthrough: onboarding call booked for Monday.")).toBeVisible();
  await capture(page, "admin-business-detail");

  await nav.getByRole("link", { name: "Plans" }).click();
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
  await capture(page, "admin-plans");

  await nav.getByRole("link", { name: "Monitoring" }).click();
  await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible();
  await capture(page, "admin-monitoring");

  await nav.getByRole("link", { name: "Inquiries" }).click();
  await expect(page.getByRole("heading", { name: "Contact inquiries" })).toBeVisible();
  await capture(page, "admin-inquiries");

  await nav.getByRole("link", { name: "Announcements" }).click();
  const title = `Admin walkthrough ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message").fill("Scheduled maintenance on Sunday at 02:00 GMT.");
  await page.getByLabel("Level").selectOption("WARNING");
  await page.getByRole("button", { name: "Publish" }).click();
  const announcement = page.getByRole("listitem").filter({ hasText: title });
  await expect(announcement).toBeVisible();
  await capture(page, "admin-announcements");

  // Workspaces see the banner while it is active.
  await page.goto("/app/dashboard");
  await expect(page.getByRole("alert").filter({ hasText: title })).toBeVisible();
  await capture(page, "workspace-announcement-banner");
  await page.goto("/admin/announcements");
  await announcement.getByRole("button", { name: "Hide" }).click();
  await expect(announcement.getByRole("button", { name: "Show" })).toBeVisible();

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("AI kill switch")).toBeVisible();
  await capture(page, "admin-settings");

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Audit log" }).click();
  await page.getByLabel("Action prefix").fill("admin.");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("admin.announcement_created").first()).toBeVisible();
  await capture(page, "admin-audit-log");
});
