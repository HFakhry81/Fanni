export const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

export function normalizeEmailForStorage(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Same format as registration: 0 + 10 digits (e.g. 01012345678). */
export function normalizeEgyptMobileForStorage(raw: string): string {
  const mobileDigits = raw.trim().replace(/\s|-/g, "");
  const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
  return mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;
}

export function isValidEgyptMobile(raw: string): boolean {
  return EGYPT_MOBILE_RE.test(raw.trim().replace(/\s|-/g, ""));
}

export function normalizeLoginIdentifier(
  raw: string,
): { kind: "email"; value: string } | { kind: "mobile"; value: string } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return { kind: "email", value: normalizeEmailForStorage(trimmed) };
  }
  return { kind: "mobile", value: normalizeEgyptMobileForStorage(trimmed) };
}

export function normalizeLoginIdentifierValue(raw: string): string {
  return normalizeLoginIdentifier(raw).value;
}

export function toE164Egypt(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("20") && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+2${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) return `+20${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function maskPhoneDisplay(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 6) return "••••";
  return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
}
