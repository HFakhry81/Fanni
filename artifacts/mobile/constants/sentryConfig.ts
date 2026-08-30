const DEFAULT_MOBILE_DSN =
  "https://ceed89f638fa2993b74cc4ebdfb3bf52@o4511974134382592.ingest.de.sentry.io/4511974147096656";

/** Public DSN — safe in client bundles; override via EAS env for other environments. */
export function getMobileSentryDsn(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  return fromEnv || DEFAULT_MOBILE_DSN;
}

export const SENTRY_ORG = "upnexa-yb";
export const SENTRY_PROJECT = "fanni-app";
