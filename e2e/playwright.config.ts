import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import { getLambdaTestWsEndpoint } from "./lambdatest.config";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const hasLambdaTestCreds = Boolean(process.env.LT_USERNAME && process.env.LT_ACCESS_KEY);
const baseURL = process.env.E2E_BASE_URL ?? "https://app.upnexa-eg.com";
const apiBaseURL = process.env.E2E_API_URL ?? "https://api.upnexa-eg.com";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "local-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(hasLambdaTestCreds
      ? [
          {
            name: "lambdatest-chrome",
            use: {
              ...devices["Desktop Chrome"],
              connectOptions: {
                wsEndpoint: getLambdaTestWsEndpoint("Fanni E2E Suite"),
              },
            },
          },
        ]
      : []),
  ],
  metadata: { apiBaseURL },
});
