import { expect, test } from "@playwright/test";

test("owner downloads the workspace export and can schedule then cancel deletion", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Efua Owusu");
  await page.getByLabel("Work email").fill(`privacy-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("kente-market-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Business name").fill("Efua Fabrics");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/app\/setup$/);

  const download = await page.request.get("/api/export/business");
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  const data = await download.json();
  expect(data).toMatchObject({ format: "sunleon-ai-export/1", business: { name: "Efua Fabrics" } });

  await page.goto("/app/settings#data");
  await page.getByLabel(/Type “Efua Fabrics” to confirm/).fill("Efua Fabrics");
  await page.getByRole("button", { name: "Delete this workspace" }).click();
  await expect(page.getByText(/will be permanently deleted on/).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(page.getByRole("button", { name: "Delete this workspace" })).toBeVisible();
});
