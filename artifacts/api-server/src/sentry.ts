import * as Sentry from "@sentry/node";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: "https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360",
  tracesSampleRate: isProduction ? 0.2 : 1.0,
  enableLogs: true,
  integrations: [
    // In production rely on Pino; only forward console warn/error (not log/info noise).
    Sentry.consoleIntegration({
      levels: isProduction ? ["warn", "error"] : ["log", "info", "warn", "error"],
    }),
  ],
});