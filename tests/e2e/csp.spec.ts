import { expect, test, type Page } from "@playwright/test";

/** Collects the browser's report-only CSP messages, which name what the policy would have blocked. */
function watchCsp(page: Page): string[] {
  const reports: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("Content Security Policy")) reports.push(`${new URL(page.url()).pathname}: ${text}`);
  });
  return reports;
}

test("public pages load nothing the Content-Security-Policy would block", async ({ page }) => {
  const reports = watchCsp(page);
  for (const path of ["/", "/industries", "/pricing", "/contact", "/login", "/register", "/forgot-password"]) {
    const response = await page.goto(path);
    expect(response?.headers()["content-security-policy-report-only"], path).toContain("report-uri /api/csp-report");
    await page.waitForLoadState("networkidle");
  }
  expect(reports).toEqual([]);
});

test("signed-in pages get a fresh nonce per visit and load nothing the policy would block", async ({ page }) => {
  const reports = watchCsp(page);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Kojo Asante");
  await page.getByLabel("Work email").fill(`csp-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("kente-market-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Business name").fill("Kojo Hardware");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/app\/setup$/);

  const nonces = new Set<string>();
  for (const path of ["/app/dashboard", "/app/inbox", "/app/settings"]) {
    const response = await page.goto(path);
    const policy = response?.headers()["content-security-policy-report-only"] ?? "";
    expect(policy, path).toContain("'strict-dynamic'");
    nonces.add(/'nonce-([^']+)'/.exec(policy)?.[1] ?? "");
    await page.waitForLoadState("networkidle");
  }
  expect(nonces.size).toBe(3);
  expect(reports).toEqual([]);
});
