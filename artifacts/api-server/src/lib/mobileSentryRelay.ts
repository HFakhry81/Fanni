import { randomBytes } from "node:crypto";

import {
  getApiSentryEnvironment,
  getMobileSentryDsn,
  SENTRY_ORG,
  SENTRY_PROJECT_MOBILE,
} from "./sentryConfig";

function parseSentryDsn(dsn: string): { publicKey: string; host: string; projectId: string } {
  const url = new URL(dsn);
  const publicKey = url.username;
  const host = url.host;
  const projectId = url.pathname.replace(/^\//, "");
  if (!publicKey || !host || !projectId) {
    throw new Error("Invalid Sentry DSN");
  }
  return { publicKey, host, projectId };
}

function createEventId(): string {
  return randomBytes(16).toString("hex");
}

export async function captureMobileSentryException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): Promise<string | undefined> {
  const dsn = getMobileSentryDsn();
  if (!dsn) return undefined;

  const { publicKey, host, projectId } = parseSentryDsn(dsn);
  const eventId = createEventId();
  const stamp = new Date().toISOString();

  const event = {
    event_id: eventId,
    timestamp: stamp,
    platform: "javascript",
    level: "error",
    environment: getApiSentryEnvironment(),
    exception: {
      values: [
        {
          type: error.name || "Error",
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: error.stack.split("\n").slice(1).map((line) => ({
                  filename: line.trim(),
                })),
              }
            : undefined,
        },
      ],
    },
    tags: {
      "sentry.org": SENTRY_ORG,
      "sentry.project": SENTRY_PROJECT_MOBILE,
      service: "fanni-mobile",
      ...context?.tags,
    },
    extra: context?.extra,
  };

  const envelope = [
    JSON.stringify({ event_id: eventId, dsn, sent_at: stamp }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  const response = await fetch(`https://${host}/api/${projectId}/envelope/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=fanni-admin-relay/1.0`,
    },
    body: envelope,
  });

  if (!response.ok) {
    throw new Error(`Sentry ingest failed with HTTP ${response.status}`);
  }

  return eventId;
}
