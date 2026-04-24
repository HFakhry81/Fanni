/**
 * Geocoding helper — converts a location slug (or human-readable name) to
 * a WGS-84 lat/lon via Nominatim, using the shared rate-limited queue from
 * nominatim.ts so all callers in this process share one 1-req/sec slot.
 *
 * Location IDs stored in the `users` table follow the pattern used by the
 * `locations` table (e.g. `cairo`, `cairo__maadi`). This module resolves
 * those slugs to the English display names before building the Nominatim
 * query, so search results are accurate.
 */

import { eq } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import { NOMINATIM_BASE, nominatimFetch, getCached, setCache } from "./nominatim";

const CACHE_DAYS = 30;

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Resolves a location ID/slug to its English display name.
 * Falls back to the raw value when no DB row is found (allows
 * callers who already hold a plain name to pass it through directly).
 */
async function resolveLocationName(slugOrName: string): Promise<string> {
  const [row] = await db
    .select({ nameEn: locationsTable.nameEn })
    .from(locationsTable)
    .where(eq(locationsTable.id, slugOrName))
    .limit(1);
  return row?.nameEn ?? slugOrName;
}

/**
 * Geocode an area (optionally scoped to a governorate) to a WGS-84 point.
 * Both parameters accept a location slug (from `locations.id`) or a
 * human-readable name — slugs are resolved automatically.
 * Returns null if Nominatim finds nothing or is unreachable.
 */
export async function geocodeArea(
  area: string | null | undefined,
  governorate?: string | null,
): Promise<GeoPoint | null> {
  if (!area?.trim() && !governorate?.trim()) return null;

  const parts: string[] = [];
  if (area?.trim()) {
    parts.push(await resolveLocationName(area.trim()));
  }
  if (governorate?.trim()) {
    parts.push(await resolveLocationName(governorate.trim()));
  }
  parts.push("Egypt");

  const q = parts.join(", ");
  const cacheKey = `geocode:en:${q.toLowerCase()}`;

  try {
    const cached = await getCached(cacheKey);
    let results: Array<{ lat: string; lon: string }>;

    if (cached) {
      results = cached as Array<{ lat: string; lon: string }>;
    } else {
      const url =
        `${NOMINATIM_BASE}/search` +
        `?q=${encodeURIComponent(q)}` +
        `&countrycodes=eg` +
        `&format=json` +
        `&limit=1`;
      results = (await nominatimFetch(url)) as Array<{ lat: string; lon: string }>;
      await setCache(cacheKey, "en", results);
    }

    if (!Array.isArray(results) || results.length === 0) return null;

    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    if (isNaN(lat) || isNaN(lon)) return null;

    return { lat, lon };
  } catch {
    return null;
  }
}
