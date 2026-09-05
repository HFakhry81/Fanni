import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { setLambdaTestStatus } from "./lambdatest";

/** Clear web session so role switches (admin→tech→client) can re-login. */
export async function clearWebSession(page: Page): Promise<void> {
  try {
    await page.context().clearCookies();
  } catch {
    /* ignore */
  }
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

export async function uiLogin(
  page: Page,
  identifier: string,
  password: string,
  expectUrl: RegExp,
): Promise<void> {
  await clearWebSession(page);
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const idField = page.getByTestId("login-identifier");
  // If still redirected away (cached auth), clear again and retry once
  if (!(await idField.isVisible({ timeout: 5_000 }).catch(() => false))) {
    await clearWebSession(page);
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
  }

  await expect(idField).toBeVisible({ timeout: 30_000 });
  await idField.fill(identifier);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(expectUrl, { timeout: 45_000 });
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45_000 }).catch(() => undefined);
}

/** Film evidence — never fail the API assertion path. */
export async function softUiLogin(
  page: Page,
  identifier: string,
  password: string,
  expectUrl: RegExp,
): Promise<boolean> {
  // Default ON when recording video; set E2E_LOGIC_UI_LOGIN=0 for API-only (blank videos).
  const uiOff =
    process.env.E2E_LOGIC_UI_LOGIN === "0" || process.env.E2E_LOGIC_UI_LOGIN === "false";
  if (uiOff) {
    try {
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15_000 });
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    await uiLogin(page, identifier, password, expectUrl);
    // Let Expo web paint before screenshot/video frame
    await page.waitForTimeout(1200);
    return true;
  } catch {
    return false;
  }
}

export async function film(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  await page.waitForTimeout(900);
  const shot = await page.screenshot({ fullPage: true });
  await testInfo.attach(label, { body: shot, contentType: "image/png" });
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
