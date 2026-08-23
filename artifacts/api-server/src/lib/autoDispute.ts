const AUTO_CODES = new Set([
  "wrong_number",
  "no_response",
  "no_answer",
  "client_not_present",
]);

export function normalizeDisputeReason(reason: string): string {
  return reason.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isAutoEligibleReason(reason: string): boolean {
  const code = normalizeDisputeReason(reason);
  if (AUTO_CODES.has(code)) return true;
  const raw = reason.trim();
  return /خاطئ|مردش|لا يرد|مش بيرد|رقم غلط/.test(raw);
}

export function autoDisputeDailyCap(): number {
  const n = Number(process.env["DISPUTE_AUTO_DAILY_CAP"] ?? "2");
  return Number.isFinite(n) && n > 0 ? n : 2;
}
