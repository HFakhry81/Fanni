import { test, expect } from "@playwright/test";
import { hasClientCreds } from "../helpers/auth";

test.describe("Order journey — client create & cancel", () => {
  test.skip(!hasClientCreds(), "Set E2E_CLIENT_IDENTIFIER and E2E_CLIENT_PASSWORD");

  test("login and reach client home", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-identifier").fill(process.env.E2E_CLIENT_IDENTIFIER!);
    await page.getByTestId("login-password").fill(process.env.E2E_CLIENT_PASSWORD!);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/client\/home|home/, { timeout: 30_000 });
    await page.screenshot({ path: "test-results/journey-01-client-home.png" });
  });
});
