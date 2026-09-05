import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { setLambdaTestStatus } from "./lambdatest";

export async function uiLogin(
  page: Page,
  identifier: string,
  password: string,
  expectUrl: RegExp,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(identifier);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(expectUrl, { timeout: 45_000 });
}

export async function film(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  // Pause so video captures the screen meaningfully
  await page.waitForTimeout(900);
  const shot = await page.screenshot({ fullPage: true });
  await testInfo.attach(label, { body: shot, contentType: "image/png" });
  // Also write under test-results for easy folder browsing
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(testInfo.outputDir, "screenshots");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${label}.png`), shot);
}

export async function markLt(page: Page, testInfo: TestInfo): Promise<void> {
  const status = testInfo.status === "passed" || testInfo.status === "skipped" ? "passed" : "failed";
  await setLambdaTestStatus(page, status === "passed" ? "passed" : "failed", testInfo.title);
}

/** Soft navigate — never fail the whole suite if a tab route is missing. */
export async function softGoto(page: Page, path: string): Promise<boolean> {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}
