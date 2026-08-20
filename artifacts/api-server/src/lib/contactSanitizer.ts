const PHONE_LIKE = /(?:\+?20[\s-]?)?01[0125][\s-]?\d{3,4}[\s-]?\d{4}/g;
const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CONTACT_LINK = /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|t\.me)\/[^\s]+/gi;

export function sanitizeFreeText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(PHONE_LIKE, "[بيانات اتصال محجوبة]")
    .replace(EMAIL_LIKE, "[بريد إلكتروني محجوب]")
    .replace(CONTACT_LINK, "[رابط تواصل محجوب]");
}

export function sanitizeOrderForBroadcast<T extends Record<string, unknown>>(order: T): T {
  const sanitized: Record<string, unknown> = { ...order };
  for (const key of ["problemDescription", "description", "additionalDetails", "deviceType"]) {
    if (key in sanitized) sanitized[key] = sanitizeFreeText(sanitized[key]);
  }
  if (sanitized.data && typeof sanitized.data === "object" && !Array.isArray(sanitized.data)) {
    sanitized.data = sanitizeOrderForBroadcast(sanitized.data as Record<string, unknown>);
  }
  return sanitized as T;
}