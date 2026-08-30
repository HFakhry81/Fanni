/** Sentry org/project for dashboards, EAS, and Cursor MCP (not secrets). */
export const SENTRY_ORG = "upnexa-hb";
export const SENTRY_PROJECT_API = "node";
export const SENTRY_PROJECT_MOBILE = "fanni";
export const SENTRY_REGION_URL = "https://de.sentry.io";

const DEFAULT_API_DSN =
  "https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360";

const DEFAULT_MOBILE_DSN =
  "https://f65a29e74485fd160dc1d53e3b2a3a73@o4511786733207552.ingest.de.sentry.io/4511786758045776";

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

/** Mobile/fanni DSN — used by admin relay when web client transport is unavailable. */
export function getMobileSentryDsn(): string | undefined {
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_MOBILE_DSN?.trim();
  if (dsn) return dsn;
  if (process.env.NODE_ENV === "production") return DEFAULT_MOBILE_DSN;
  return DEFAULT_MOBILE_DSN;
}
