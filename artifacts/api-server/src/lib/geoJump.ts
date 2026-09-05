/** Earth radius (km) for Haversine. */
const EARTH_KM = 6371;

/** Max plausible ground speed for a technician (km/h), with buffer for GPS noise. */
export const MAX_TECH_SPEED_KMH = 180;

/** Ignore jump checks when previous fix is older than this (ms). */
export const GEO_JUMP_MAX_AGE_MS = 30 * 60 * 1000;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Returns true when the move is physically implausible given elapsed time.
 * Soft buffer of 2 km absorbs GPS jitter.
 */
export function isImplausibleGeoJump(opts: {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  elapsedMs: number;
  maxSpeedKmh?: number;
}): boolean {
  if (!Number.isFinite(opts.elapsedMs) || opts.elapsedMs < 0) return false;
  if (opts.elapsedMs > GEO_JUMP_MAX_AGE_MS) return false;
  if (opts.elapsedMs < 1000) {
    // Sub-second updates: only reject extreme teleport (> 5 km)
    return haversineKm(opts.fromLat, opts.fromLon, opts.toLat, opts.toLon) > 5;
  }
  const distKm = haversineKm(opts.fromLat, opts.fromLon, opts.toLat, opts.toLon);
  const hours = opts.elapsedMs / 3_600_000;
  const maxSpeed = opts.maxSpeedKmh ?? MAX_TECH_SPEED_KMH;
  const allowedKm = maxSpeed * hours + 2;
  return distKm > allowedKm;
}
