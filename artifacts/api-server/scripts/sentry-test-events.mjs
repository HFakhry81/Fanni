/**
 * Fire manual Sentry test errors for API (node) and mobile (fanni) projects.
 * Does NOT run against production noise by default.
 *
 * Usage:
 *   SENTRY_ALLOW_TEST_EVENTS=1 pnpm --filter @workspace/api-server run sentry:test
 */
import * as Sentry from "@sentry/node";

const allowed =
  process.env.SENTRY_ALLOW_TEST_EVENTS === "1" ||
  process.env.SENTRY_ALLOW_TEST_EVENTS === "true";

if (!allowed) {
  console.error(
    "[sentry:test] Refusing to send test events.\n" +
      "Set SENTRY_ALLOW_TEST_EVENTS=1 to opt in (prefer a non-production DSN / environment).",
  );
  process.exit(1);
}

const API_DSN =
  process.env.SENTRY_DSN?.trim() ||
  "https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360";

const MOBILE_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ||
  "https://f65a29e74485fd160dc1d53e3b2a3a73@o4511786733207552.ingest.de.sentry.io/4511786758045776";

async function sendTest(dsn, label, channel) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || "script-test",
    tracesSampleRate: 0,
  });
  const stamp = new Date().toISOString();
  const message = `[Fanni ${label} script-test] Sentry monitoring check — ${stamp}`;
  const eventId = Sentry.captureException(new Error(message), {
    tags: { source: "sentry-test-script", channel },
  });
  await Sentry.flush(3000);
  await Sentry.close(1000);
  console.log(`${label}: event ${eventId ?? "(no id)"} — ${message}`);
  return eventId;
}

const apiId = await sendTest(API_DSN, "API", "api-node");
const mobileId = await sendTest(MOBILE_DSN, "mobile", "mobile-js");
console.log("\nDone. Check Sentry projects: node (API), fanni (mobile).");
console.log({ apiEventId: apiId, mobileEventId: mobileId });
