/**
 * Safe Gregorian visit-date helpers — never rely on locale calendars (ar-EG can
 * surface Hijri / odd day numbers like "95-10-2026" when mis-parsed).
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateYmd(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as local noon; returns null if invalid calendar day. */
export function parseVisitDateYmd(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const m = YMD_RE.exec(trimmed);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  const nowY = new Date().getFullYear();
  if (y < nowY - 1 || y > nowY + 2) return null;
  return dt;
}

export function isValidVisitDateYmd(raw: unknown): boolean {
  return parseVisitDateYmd(raw) != null;
}

/** Display as DD/MM/YYYY (Gregorian) for lists — never raw ambiguous strings. */
export function formatVisitDateDisplay(raw: unknown, isRTL = false): string {
  const dt = parseVisitDateYmd(raw);
  if (!dt) {
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    return "";
  }
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  // Prefer numeric Gregorian to avoid Hijri from ar-EG locale engines
  return isRTL ? `${dd}/${mm}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
}

export function formatCreatedAtDisplay(raw: unknown, isRTL = false): string {
  if (raw == null || raw === "") return "";
  const dt = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(isRTL ? "ar-EG" : "en-GB", {
    calendar: "gregory",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function currentTimeHhMm(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function timePeriodLabel(hhmm: string, isRTL: boolean): string {
  const hour = Number(hhmm.split(":")[0] || 0);
  const isDay = hour >= 6 && hour < 18;
  return isRTL ? (isDay ? "نهاراً" : "ليلاً") : isDay ? "Day" : "Night";
}
