import type { Page } from "@playwright/test";

/** Report pass/fail to LambdaTest dashboard (no-op when not on LT). */
export async function setLambdaTestStatus(
  page: Page,
  status: "passed" | "failed",
  remark: string,
): Promise<void> {
  if (!process.env.LT_USERNAME || !process.env.LT_ACCESS_KEY) return;
  await page.evaluate(
    () => {},
    `lambdatest_action: ${JSON.stringify({
      action: "setTestStatus",
      arguments: { status, remark },
    })}`,
  );
}
