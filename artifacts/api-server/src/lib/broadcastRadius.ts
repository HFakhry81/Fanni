/** Default expanding search radii (km). Hard-capped for production safety. */
export const DEFAULT_BROADCAST_RADIUS_TIERS_KM = [15, 50, 100] as const;

export const DEFAULT_BROADCAST_MAX_RADIUS_KM = 100;

/**
 * Parse BROADCAST_RADIUS_TIERS_KM (comma-separated) with a hard max radius cap.
 * Empty / invalid input → defaults. Tiers above max are dropped; if all drop, use [max].
 */
export function parseBroadcastRadiusTiersKm(
  raw: string | undefined | null,
  maxKm: number = DEFAULT_BROADCAST_MAX_RADIUS_KM,
): number[] {
  const safeMax = Number.isFinite(maxKm) && maxKm > 0 ? maxKm : DEFAULT_BROADCAST_MAX_RADIUS_KM;
  const defaults = DEFAULT_BROADCAST_RADIUS_TIERS_KM.filter((n) => n <= safeMax);
  const fallback = defaults.length > 0 ? [...defaults] : [safeMax];

  if (!raw?.trim()) return fallback;

  const parsed = raw
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0 && n <= safeMax);

  if (parsed.length === 0) return fallback;

  return [...new Set(parsed)].sort((a, b) => a - b);
}

export function resolveBroadcastMaxRadiusKm(
  envValue: string | undefined | null = process.env.BROADCAST_MAX_RADIUS_KM,
): number {
  const n = envValue != null && envValue.trim() !== "" ? Number(envValue) : DEFAULT_BROADCAST_MAX_RADIUS_KM;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BROADCAST_MAX_RADIUS_KM;
  // Absolute ceiling — never allow unbounded broadcast via env typo
  return Math.min(n, 250);
}
