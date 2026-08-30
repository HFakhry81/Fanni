const DEFAULT_MOBILE_DSN =
  "https://f65a29e74485fd160dc1d53e3b2a3a73@o4511786733207552.ingest.de.sentry.io/4511786758045776";

/** Public DSN — safe in client bundles; override via EAS env for other environments. */
export function getMobileSentryDsn(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  return fromEnv || DEFAULT_MOBILE_DSN;
}

export const SENTRY_ORG = "upnexa-hb";
export const SENTRY_PROJECT = "fanni";
