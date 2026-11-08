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

  await page.getByRole("link", { name: "Notifications, 1 unread" }).click();
  await expect(page.getByRole("link", { name: "New order #1" })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
});

test("owner applies the industry template and gets starter workflows as drafts", async ({ page }) => {
  await registerWithWorkspace(page);

  await page.goto("/app/settings#template");
  await page.getByLabel("What you offer").fill("Phone repairs and accessories");
  await page.getByRole("button", { name: "Apply template" }).click();
  await expect(page.getByText("Template applied.")).toBeVisible();

  await page.goto("/app/automation");
  await expect(page.getByText("Tell the team about new leads")).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  await page.goto("/app/settings#template");
  await expect(page.getByLabel("What you offer")).toHaveValue("Phone repairs and accessories");
  await expect(page.getByRole("button", { name: "Save template" })).toBeVisible();
});

test("owner builds, activates and pauses an automation workflow", async ({ page }) => {
  await registerWithWorkspace(page);

  await page.goto("/app/automation");
  await expect(page.getByText("No workflows yet")).toBeVisible();
  await page.getByLabel("Workflow name").fill("Big order alert");
  await page.getByLabel("When").selectOption("NEW_ORDER");
  await page.getByLabel("Condition 1", { exact: true }).selectOption("order_total_gte");
  await page.getByLabel("Condition 1 value").fill("500");
  await page.getByLabel("Then 1", { exact: true }).selectOption("notify_team");
  await page.getByLabel("Then 1 value").fill("Big order received");
  await page.getByRole("button", { name: "Save workflow" }).click();

  await expect(page.getByText("Big order alert")).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("active", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("paused", { exact: true })).toBeVisible();
});
