/** Server-side visit date validation (YYYY-MM-DD Gregorian). */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidVisitDateYmd(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const m = YMD_RE.exec(raw.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return false;
  const nowY = new Date().getFullYear();
  return y >= nowY - 1 && y <= nowY + 2;
}
