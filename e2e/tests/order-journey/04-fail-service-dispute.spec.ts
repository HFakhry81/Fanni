import { test, expect } from "@playwright/test";
import { hasAdminCreds } from "../helpers/auth";

test.describe("Order journey — disputes & wallet (admin access)", () => {
  test.skip(!hasAdminCreds(), "Set E2E_ADMIN_IDENTIFIER and E2E_ADMIN_PASSWORD");

  test("admin can open disputes tab", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-identifier").fill(process.env.E2E_ADMIN_IDENTIFIER!);
    await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/admin/, { timeout: 30_000 });
    await page.goto("/disputes");
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/journey-04-admin-disputes.png" });
  });
});
