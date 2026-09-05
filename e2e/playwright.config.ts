import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import { getLambdaTestWsEndpoint } from "./lambdatest.config";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const hasLambdaTestCreds = Boolean(process.env.LT_USERNAME && process.env.LT_ACCESS_KEY);
const baseURL = process.env.E2E_BASE_URL ?? "https://app.upnexa-eg.com";
const apiBaseURL = process.env.E2E_API_URL ?? "https://api.upnexa-eg.com";
const recordAll = process.env.E2E_RECORD === "1" || process.env.E2E_RECORD === "true";

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI && !recordAll ? 2 : 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
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
  metadata: { apiBaseURL, recordAll },
});
