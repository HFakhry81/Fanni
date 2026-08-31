import { test, expect } from "@playwright/test";
import { hasTechCreds } from "../helpers/auth";

test.describe("Order journey — tech masked lead card", () => {
  test.skip(!hasTechCreds(), "Set E2E_TECH_IDENTIFIER and E2E_TECH_PASSWORD");

  test("technician login and open available orders", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-identifier").fill(process.env.E2E_TECH_IDENTIFIER!);
    await page.getByTestId("login-password").fill(process.env.E2E_TECH_PASSWORD!);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/tech/, { timeout: 30_000 });
    await page.goto("/available-orders");
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/journey-02-tech-available.png" });
  });
});
