import twilio from "twilio";
import { eq } from "drizzle-orm";
import { db, maskedCallSessionsTable } from "@workspace/db";
import { logger } from "./logger";

export function isMaskedCallingConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_VOICE_NUMBER
    && process.env.PUBLIC_API_URL,
  );
}

export function getPublicApiUrl(): string {
  return (process.env.PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function placeMaskedBridgeCall(opts: {
  sessionId: string;
  initiatorE164: string;
}): Promise<string> {
  const from = process.env.TWILIO_VOICE_NUMBER!;
  const base = getPublicApiUrl();
  const client = getTwilioClient();
  const call = await client.calls.create({
    from,
    to: opts.initiatorE164,
    url: `${base}/api/voice/bridge?sessionId=${encodeURIComponent(opts.sessionId)}`,
    statusCallback: `${base}/api/voice/status`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  });
  await db.update(maskedCallSessionsTable).set({
    providerCallSid: call.sid,
    status: call.status ?? "queued",
    updatedAt: new Date(),
  }).where(eq(maskedCallSessionsTable.id, opts.sessionId));
  logger.info({ sessionId: opts.sessionId, callSid: call.sid }, "Masked bridge call queued");
  return call.sid;
}
