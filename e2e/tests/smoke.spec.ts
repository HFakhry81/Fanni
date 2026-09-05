import { test, expect } from "@playwright/test";
import { setLambdaTestStatus } from "./helpers/lambdatest";

const apiBase = process.env.E2E_API_URL ?? "https://api.upnexa-eg.com";

test.describe("Fanni smoke (production)", () => {
  test.afterEach(async ({ page }, testInfo) => {
    const status = testInfo.status === "passed" ? "passed" : "failed";
    const remark = testInfo.error?.message ?? testInfo.title;
    await setLambdaTestStatus(page, status, remark);
  });

  test("web app loads (welcome or login)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/welcome|login|select-role/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    const byTestId = page.getByTestId("login-identifier");
    const byPlaceholder = page.getByPlaceholder(/email|mobile|بريد|جوال|هاتف/i).first();
    await expect(byTestId.or(byPlaceholder)).toBeVisible({ timeout: 20_000 });
  });
  test("API healthz", async ({ request }) => {
    const res = await request.get(`${apiBase}/api/healthz`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });
});
