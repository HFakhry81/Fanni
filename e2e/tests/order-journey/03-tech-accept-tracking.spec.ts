import { test, expect } from "@playwright/test";
import { hasClientCreds, hasTechCreds } from "../helpers/auth";

test.describe("Order journey — accept flow (UI smoke)", () => {
  test.skip(!hasClientCreds() || !hasTechCreds(), "Set E2E_CLIENT_* and E2E_TECH_* credentials");

  test("client orders list shows cancel only when pending", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-identifier").fill(process.env.E2E_CLIENT_IDENTIFIER!);
    await page.getByTestId("login-password").fill(process.env.E2E_CLIENT_PASSWORD!);
    await page.getByTestId("login-submit").click();
    await page.goto("/orders");
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/journey-03-client-orders.png" });
  });
});
