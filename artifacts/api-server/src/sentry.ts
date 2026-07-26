import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360",
  tracesSampleRate: 1.0,
  enableLogs: true,
  integrations: [
    Sentry.consoleIntegration({ levels: ["log", "info", "warn", "error"] }),
  ],
});