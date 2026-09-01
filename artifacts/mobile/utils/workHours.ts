export const TIME_HH_MM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function clampTime(hhmm: string): string {
  const [hRaw, mRaw] = (hhmm || "08:00").split(":");
  const h = Math.min(23, Math.max(0, Number(hRaw) || 0));
  const m = Math.min(59, Math.max(0, Number(mRaw) || 0));
  return `${pad2(h)}:${pad2(m)}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = clampTime(hhmm).split(":").map(Number);
  return h * 60 + m;
}

export function isValidHhMm(hhmm: string): boolean {
  return TIME_HH_MM_RE.test(hhmm.trim());
}

export function isEndAfterStart(start: string, end: string): boolean {
  return timeToMinutes(end) > timeToMinutes(start);
}

export function addMinutes(hhmm: string, delta: number): string {
  const [h, m] = clampTime(hhmm).split(":").map(Number);
  let total = h * 60 + m + delta;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function setHour(hhmm: string, hour: number): string {
  const [, m] = clampTime(hhmm).split(":").map(Number);
  return `${pad2(Math.min(23, Math.max(0, hour)))}:${pad2(m)}`;
}

export function setMinute(hhmm: string, minute: number): string {
  const [h] = clampTime(hhmm).split(":").map(Number);
  return `${pad2(h)}:${pad2(Math.min(59, Math.max(0, minute)))}`;
}

export function timeStringToDate(hhmm: string): Date {
  const [h, m] = clampTime(hhmm).split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function dateToTimeString(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
