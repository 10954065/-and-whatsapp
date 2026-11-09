import { expect, test } from "@playwright/test";

const password = "kente-market-2026";

test("visitor registers, creates a workspace, signs out and signs back in", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("never closes");
  await page.getByRole("link", { name: "Start your free trial" }).click();

  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Full name").fill("Esi Owusu");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Business name").fill("Esi's Beauty Bar");
  await page.getByLabel("City").fill("Kumasi");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page).toHaveURL(/\/app\/setup$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("get your assistant ready");
  await expect(page.getByText("Confirm your email address")).toBeVisible();

  // Complete the profile step from the setup guide and see progress update.
  await page.getByRole("link", { name: "Edit profile" }).click();
  await expect(page).toHaveURL(/\/app\/settings#profile$/);
  await page.getByLabel("Description").fill("Braids, nails and skincare in the heart of Kumasi, open six days a week.");
  await page.getByLabel("Phone").fill("+233241234567");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Business profile saved." })).toBeVisible();
  await page.getByRole("link", { name: "Setup guide" }).first().click();
  await expect(page.getByText("1 of 9 steps complete")).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("button", { name: /Esi's Beauty Bar/ })).toBeVisible();
});

test("protected pages redirect anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fdashboard/);
});

test("pricing shows database-managed plans in Ghana cedis", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
  await expect(page.getByText(/GH₵|GHS/).first()).toBeVisible();
});
