import * as Sentry from "@sentry/node";
import {
  getApiSentryDsn,
  getApiSentryEnvironment,
  getApiSentryRelease,
  SENTRY_ORG,
  SENTRY_PROJECT_API,
} from "./lib/sentryConfig";

const isProduction = process.env.NODE_ENV === "production";
const dsn = getApiSentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: getApiSentryEnvironment(),
  release: getApiSentryRelease(),
  tracesSampleRate: isProduction ? 0.2 : 1.0,
  enableLogs: true,
  integrations: [
    // In production rely on Pino; only forward console warn/error (not log/info noise).
    Sentry.consoleIntegration({
      levels: isProduction ? ["warn", "error"] : ["log", "info", "warn", "error"],
    }),
  ],
  initialScope: {
    tags: {
      "sentry.org": SENTRY_ORG,
      "sentry.project": SENTRY_PROJECT_API,
      service: "fanni-api",
    },
  },
});