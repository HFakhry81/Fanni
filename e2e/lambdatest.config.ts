/**
 * LambdaTest Playwright CDP endpoint.
 * @see https://www.lambdatest.com/support/docs/playwright-testing
 */
export function getLambdaTestWsEndpoint(testName: string): string {
  const user = process.env.LT_USERNAME;
  const accessKey = process.env.LT_ACCESS_KEY;
  if (!user || !accessKey) {
    throw new Error(
      "LambdaTest requires LT_USERNAME and LT_ACCESS_KEY (set in .env — see .env.example).",
    );
  }

  const capabilities = {
    browserName: "Chrome",
    browserVersion: "latest",
    "LT:Options": {
      platform: process.env.LT_PLATFORM ?? "Windows 11",
      build: process.env.LT_BUILD ?? `Fanni E2E ${new Date().toISOString().slice(0, 10)}`,
      name: testName,
      user,
      accessKey,
      network: true,
      video: true,
      console: true,
    },
  };

  return `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(JSON.stringify(capabilities))}`;
}
