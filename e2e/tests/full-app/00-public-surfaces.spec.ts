import { test, expect } from "@playwright/test";
import { healthz } from "../helpers/apiClient";
import { film, markLt, softGoto } from "../helpers/ui";

/**
 * Public / unauthenticated surfaces — always run (no secrets).
 * Captures video of welcome, login, register, role select.
 */
test.describe("Full-app · public surfaces (video)", () => {
  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("API healthz", async () => {
    const h = await healthz();
    expect(h.status).toBe("ok");
  });

  test("welcome / login / register / role screens", async ({ page }, info) => {
    await page.goto("/");
    await film(page, info, "00-root");
    await softGoto(page, "/welcome");
    await film(page, info, "00-welcome");
    await softGoto(page, "/login");
    await expect(page.getByTestId("login-identifier")).toBeVisible({ timeout: 20_000 });
    await film(page, info, "00-login");
    await softGoto(page, "/register");
    await film(page, info, "00-register");
    await softGoto(page, "/select-role");
    await film(page, info, "00-select-role");
    await softGoto(page, "/forgot-password");
    await film(page, info, "00-forgot-password");
  });
});
