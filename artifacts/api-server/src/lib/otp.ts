import crypto from "node:crypto";

export const OTP_ENABLED = process.env.ENABLE_OTP === "true";

const JWT_HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export function signOtpToken(mobile: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  const payload = Buffer.from(
    JSON.stringify({ mobile, exp: Math.floor(Date.now() / 1000) + 30 * 60 }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${JWT_HEADER}.${payload}`)
    .digest("base64url");
  return `${JWT_HEADER}.${payload}.${sig}`;
}

export function verifyOtpToken(token: string): string | null {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts as [string, string, string];
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      mobile: string;
      exp: number;
    };
    if (Math.floor(Date.now() / 1000) > data.exp) return null;
    return data.mobile;
  } catch {
    return null;
  }
}
