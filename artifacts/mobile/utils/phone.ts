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

/** Normalize email/mobile before auth API calls (login, forgot password, etc.). */
export function normalizeLoginIdentifierValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) return normalizeEmailForStorage(trimmed);
  return normalizeEgyptMobileForStorage(trimmed);
}
