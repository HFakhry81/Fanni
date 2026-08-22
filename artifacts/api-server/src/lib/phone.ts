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
