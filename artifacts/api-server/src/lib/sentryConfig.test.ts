import { describe, it, expect } from "vitest";
import {
  getApiSentryDsn,
  getApiSentryEnvironment,
  getApiSentryRelease,
  SENTRY_ORG,
  SENTRY_PROJECT_API,
} from "./sentryConfig";

describe("sentryConfig", () => {
  it("exposes org and project slugs", () => {
    expect(SENTRY_ORG).toBe("upnexa-hb");
    expect(SENTRY_PROJECT_API).toBe("node");
  });

  it("returns DSN by default", () => {
    expect(getApiSentryDsn()).toMatch(/^https:\/\//);
  });

  it("reads release and environment from env when set", () => {
    const prevRelease = process.env.SENTRY_RELEASE;
    const prevEnv = process.env.SENTRY_ENVIRONMENT;
    process.env.SENTRY_RELEASE = "fanni-api@test";
    process.env.SENTRY_ENVIRONMENT = "staging";
    expect(getApiSentryRelease()).toBe("fanni-api@test");
    expect(getApiSentryEnvironment()).toBe("staging");
    if (prevRelease === undefined) delete process.env.SENTRY_RELEASE;
    else process.env.SENTRY_RELEASE = prevRelease;
    if (prevEnv === undefined) delete process.env.SENTRY_ENVIRONMENT;
    else process.env.SENTRY_ENVIRONMENT = prevEnv;
  });
});
