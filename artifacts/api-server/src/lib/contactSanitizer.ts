const PHONE_LIKE = /(?:\+?20[\s-]?)?01[0125][\s-]?\d{3,4}[\s-]?\d{4}/g;
const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CONTACT_LINK = /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|t\.me)\/[^\s]+/gi;
/** Loose digit runs that look like Egyptian mobiles without separators (01012345678). */
const COMPACT_MOBILE = /(?<!\d)01[0125]\d{8}(?!\d)/g;

export function sanitizeFreeText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(PHONE_LIKE, "[بيانات اتصال محجوبة]")
    .replace(COMPACT_MOBILE, "[بيانات اتصال محجوبة]")
    .replace(EMAIL_LIKE, "[بريد إلكتروني محجوب]")
    .replace(CONTACT_LINK, "[رابط تواصل محجوب]");
}

/** True when free text appears to contain phone / email / chat links (lead leakage). */
export function containsContactPii(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  PHONE_LIKE.lastIndex = 0;
  EMAIL_LIKE.lastIndex = 0;
  CONTACT_LINK.lastIndex = 0;
  COMPACT_MOBILE.lastIndex = 0;
  return (
    PHONE_LIKE.test(value) ||
    COMPACT_MOBILE.test(value) ||
    EMAIL_LIKE.test(value) ||
    CONTACT_LINK.test(value)
  );
}

const ORDER_TEXT_KEYS = ["problemDescription", "description", "additionalDetails", "deviceType"] as const;

export function orderTextContainsContactPii(order: Record<string, unknown>): boolean {
  for (const key of ORDER_TEXT_KEYS) {
    if (containsContactPii(order[key])) return true;
  }
  if (order.data && typeof order.data === "object" && !Array.isArray(order.data)) {
    return orderTextContainsContactPii(order.data as Record<string, unknown>);
  }
  return false;
}

export function sanitizeOrderForBroadcast<T extends Record<string, unknown>>(order: T): T {
  const sanitized: Record<string, unknown> = { ...order };
  for (const key of ORDER_TEXT_KEYS) {
    if (key in sanitized) sanitized[key] = sanitizeFreeText(sanitized[key]);
  }
  if (sanitized.data && typeof sanitized.data === "object" && !Array.isArray(sanitized.data)) {
    sanitized.data = sanitizeOrderForBroadcast(sanitized.data as Record<string, unknown>);
  }
  return sanitized as T;
}
