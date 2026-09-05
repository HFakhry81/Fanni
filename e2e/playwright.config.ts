import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import { getLambdaTestWsEndpoint } from "./lambdatest.config";
import {
  applyLocalE2eOverrides,
  isProductionTarget,
  prodWritesAllowed,
  resolveApiBaseUrl,
  resolveAppBaseUrl,
  writesAllowed,
} from "./tests/helpers/prodSafety";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });
applyLocalE2eOverrides();

const hasLambdaTestCreds = Boolean(process.env.LT_USERNAME && process.env.LT_ACCESS_KEY);
const baseURL = resolveAppBaseUrl();
const apiBaseURL = resolveApiBaseUrl();
const recordAll = process.env.E2E_RECORD === "1" || process.env.E2E_RECORD === "true";

if (isProductionTarget(apiBaseURL) && !prodWritesAllowed()) {
  console.warn(
    `[e2e] Production API (${apiBaseURL}) — mutating tests are SKIPPED/BLOCKED. ` +
      `Set E2E_USE_LOCAL=1 for local data, or E2E_ALLOW_PROD_WRITES=1 only if intentional.`,
  );
} else if (!isProductionTarget(apiBaseURL)) {
  console.info(`[e2e] Non-production API — writes allowed: ${apiBaseURL}`);
}

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI && !recordAll ? 2 : 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ...(process.env.E2E_QUALITY_LOOP === "1"
      ? ([["json", { outputFile: "quality-loop-out/results.json" }]] as const)
      : []),
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: recordAll ? "on" : "on-first-retry",
    screenshot: recordAll ? "on" : "only-on-failure",
    video: recordAll ? "on" : "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "local-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "full-recorded",
      testMatch: /full-app\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        screenshot: "on",
        video: "on",
        trace: "on",
      },
    },
    {
      name: "logic-suite",
      testMatch: /logic\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        screenshot: "on",
        video: "on",
        trace: "on",
      },
    },
    ...(hasLambdaTestCreds
      ? [
          {
            name: "lambdatest-chrome",
            use: {
              ...devices["Desktop Chrome"],
              video: "on" as const,
              connectOptions: {
                wsEndpoint: getLambdaTestWsEndpoint("Fanni E2E Full Recorded"),
              },
            },
          },
        ]
      : []),
  ],
  metadata: {
    apiBaseURL,
    recordAll,
    productionTarget: isProductionTarget(apiBaseURL),
    writesAllowed: writesAllowed(apiBaseURL),
  },
});
