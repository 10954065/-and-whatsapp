import { expect, test, type Page } from "@playwright/test";

async function registerWithWorkspace(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Yaw Boateng");
  await page.getByLabel("Work email").fill(`ops-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("kente-market-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Business name").fill("Yaw's Gadgets");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/app\/setup$/);
}

test("owner adds a product and customer, creates an order and sees stock drop", async ({ page }) => {
  await registerWithWorkspace(page);

  await page.goto("/app/products");
  await page.getByLabel("Name", { exact: true }).fill("Power bank 20000mAh");
  await page.getByLabel(/Price \(GHS\)/).fill("250");
  await page.getByLabel("Opening stock").fill("5");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("cell", { name: /Power bank 20000mAh/ })).toBeVisible();
  await expect(page.getByText("5 in stock")).toBeVisible();

  await page.goto("/app/customers");
  await page.getByLabel("Name", { exact: true }).fill("Abena Mensah");
  await page.getByLabel("Phone").fill("+233244000111");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByRole("cell", { name: /Abena Mensah/ })).toBeVisible();

  await page.goto("/app/orders");
  await page.getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText(/#1 · Abena Mensah/)).toBeVisible();
  await expect(page.getByText(/GH₵\s?500|GHS\s?500/).first()).toBeVisible();

  await page.goto("/app/inventory");
  await expect(page.getByRole("cell", { name: "-2" })).toBeVisible();
});
