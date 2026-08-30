/** Sentry org/project for dashboards, EAS, and Cursor MCP (not secrets). */
export const SENTRY_ORG = "upnexa-yb";
export const SENTRY_PROJECT_API = "fanni-api";
export const SENTRY_PROJECT_MOBILE = "fanni-app";

const DEFAULT_API_DSN =
  "https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360";

export function getApiSentryDsn(): string | undefined {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (dsn) return dsn;
  if (process.env.NODE_ENV === "production") return DEFAULT_API_DSN;
  return DEFAULT_API_DSN;
}

export function getApiSentryRelease(): string {
  return process.env.SENTRY_RELEASE?.trim() || "fanni-api@unknown";
}

export function getApiSentryEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
}
