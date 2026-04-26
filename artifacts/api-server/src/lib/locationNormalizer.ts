import { db, locationsTable } from "@workspace/db";
import { logger } from "./logger";

interface LocationRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  parentId: string | null;
  type: "governorate" | "area" | "neighborhood";
}

let locationCache: LocationRow[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Legacy slug alias map — built dynamically from the location cache on each warm.
 * Maps every pre-v2 slug format (plain city name, city-part slug, nameEn, nameAr)
 * to the canonical new `{gov}__{city}` slug. Ensures existing user/order records with
 * old single-word area slugs resolve correctly without manual enumeration.
 *
 * Priority lookup order in resolveSync:
 *   1. Exact alias map hit (deterministic, O(1))
 *   2. Fuzzy nameEn/nameAr/slug scoring (handles spacing / case variants)
 *   3. City-part slug fragment matching (score 70)
 */
let legacyAliasMap: Record<string, string> = {};

/**
 * Builds the alias map in two ordered passes so key precedence is deterministic:
 *
 * Pass 1 — areas: registers city-part slug, city-part-spaced, nameEn, nameAr, full slug
 *   for each area row. Areas can share a plain name (e.g. "6th of October" appears in
 *   multiple govs); last write wins within this pass, which is acceptable for area lookups.
 *
 * Pass 2 — governorates: registers the same keys for each gov row, OVERWRITING any
 *   area entries that share the same plain name (e.g. "giza"). This guarantees that a
 *   bare gov name always resolves to the governorate slug when no type filter is applied.
 *   When an area slug is needed, the caller passes type="area" and the type-filtered
 *   fuzzy path is used instead of the alias map.
 */
function buildLegacyAliasMap(cache: LocationRow[]): Record<string, string> {
  const map: Record<string, string> = {};

  const setKeys = (loc: LocationRow) => {
    const en = loc.nameEn.toLowerCase().trim();
    const ar = loc.nameAr.trim();
    const slug = loc.slug.toLowerCase();
    map[en] = loc.slug;
    map[ar] = loc.slug;
    map[slug] = loc.slug;
    map[slug.replace(/[_]/g, " ")] = loc.slug;
    map[stripNoise(en)] = loc.slug;
    if (loc.type === "area" && loc.slug.includes("__")) {
      const cityPart = loc.slug.split("__")[1];
      const cityPartSpaced = cityPart.replace(/_/g, " ");
      map[cityPart] = loc.slug;
      map[cityPartSpaced] = loc.slug;
      map[stripNoise(cityPartSpaced)] = loc.slug;
    }
  };

  for (const loc of cache) {
    if (loc.type === "area") setKeys(loc);
  }
  for (const loc of cache) {
    if (loc.type === "governorate") setKeys(loc);
  }

  return map;
}

export async function warmLocationCache(): Promise<void> {
  try {
    const rows = await db.select().from(locationsTable);
    locationCache = rows as LocationRow[];
    cacheLoadedAt = Date.now();
    legacyAliasMap = buildLegacyAliasMap(locationCache);
    logger.info({ count: locationCache.length }, "Location cache warmed");
  } catch (err) {
    logger.warn({ err }, "Failed to warm location cache — slug matching will use raw values");
  }
}

async function ensureFresh(): Promise<LocationRow[]> {
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await warmLocationCache();
  }
  return locationCache;
}

function stripNoise(s: string): string {
  return s
    .replace(/\s+(district|governorate|area|region|quarter|neighborhood|hay|حي|منطقة|محافظة|مدينة|مركز)\s*$/i, "")
    .replace(/^(مدينة|حي|مركز)\s+/u, "")
    .replace(/^(al-|el-|al |el )/i, "")
    .trim();
}

function scoreMatch(raw: string, loc: LocationRow): number {
  const rawLower = raw.toLowerCase().trim().replace(/[_\-]/g, " ");
  const slugLower = loc.slug.toLowerCase().replace(/[_\-]/g, " ");
  const nameEnLower = loc.nameEn.toLowerCase().trim();
  const nameArTrimmed = loc.nameAr.trim();

  if (rawLower === slugLower) return 100;
  if (rawLower === nameEnLower) return 95;
  if (rawLower === nameArTrimmed) return 95;

  const rawNorm = stripNoise(rawLower);
  const slugNorm = stripNoise(slugLower);
  const nameEnNorm = stripNoise(nameEnLower);

  if (rawNorm === slugNorm) return 85;
  if (rawNorm === nameEnNorm) return 80;
  if (rawNorm === stripNoise(nameArTrimmed.toLowerCase())) return 80;

  if (nameEnLower.includes(rawLower) || rawLower.includes(nameEnLower)) return 60;
  if (nameArTrimmed.includes(rawLower) || rawLower.includes(nameArTrimmed)) return 55;

  const slugCityPart = loc.slug.includes("__")
    ? loc.slug.split("__")[1].replace(/_/g, " ")
    : null;
  if (slugCityPart) {
    const rawNormNSep = rawLower.replace(/__/g, " ");
    if (rawNormNSep === slugCityPart) return 70;
    if (stripNoise(rawNormNSep) === stripNoise(slugCityPart)) return 65;
  }

  return 0;
}

type LocationType = "governorate" | "area" | "neighborhood";

/**
 * Resolves `raw` to a known slug from the cache.
 *
 * Returns `null` when the cache is populated but no entry reaches the minimum
 * confidence threshold (score ≥ 55), indicating that the value could not be
 * matched to any known location.
 *
 * Returns a lowercased raw fallback only when the cache is empty (not yet
 * warmed), so callers can still apply basic format checks in that edge case.
 */
function resolveSync(raw: string, cache: LocationRow[], type?: LocationType): string | null {
  if (!cache.length) return raw.toLowerCase();

  const rawKey = raw.toLowerCase().trim().replace(/[_]/g, " ");

  const aliasHit = legacyAliasMap[rawKey] ?? legacyAliasMap[stripNoise(rawKey)];
  if (aliasHit) {
    if (!type || cache.find((l) => l.slug === aliasHit && l.type === type)) {
      return aliasHit;
    }
  }

  const filtered = type ? cache.filter((l) => l.type === type) : cache;
  const pool = filtered.length > 0 ? filtered : cache;
  let best: LocationRow | null = null;
  let bestScore = 0;
  for (const loc of pool) {
    const score = scoreMatch(raw, loc);
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }
  return best && bestScore >= 55 ? best.slug : null;
}

/**
 * Returns true when the value is in canonical slug format:
 * lowercase alphanumeric characters and underscores only (no spaces, no uppercase).
 * Examples of valid slugs: "cairo", "giza__nasr_city", "6th_of_october__sheikh_zayed"
 */
export function isSlug(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value);
}

/**
 * Attempts to resolve `raw` to a known canonical location slug.
 *
 * Returns the matched slug when confidence is high enough (score ≥ 55 in the
 * populated cache), or the lowercased raw value when the cache is cold (so
 * existing callers can still apply basic format checks).
 *
 * Returns `null` when:
 * - `raw` is empty / null / undefined (no location provided), OR
 * - the cache is populated but no entry scores above the threshold (unmatched).
 *
 * Callers that must distinguish "not provided" from "unmatched" should compare
 * the result against the original raw input before calling this function.
 */
export async function normalizeToSlug(raw: string | null | undefined, type?: LocationType): Promise<string | null> {
  if (!raw?.trim()) return null;
  const cache = await ensureFresh();
  const resolved = resolveSync(raw.trim(), cache, type);
  if (resolved !== null && resolved !== raw.trim().toLowerCase()) {
    logger.info({ raw: raw.trim(), resolved, type }, "Normalized location to slug");
  }
  return resolved;
}

export function locationsMatchSync(a: string | null | undefined, b: string | null | undefined, type?: LocationType): boolean {
  if (!a || !b) return false;
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  if (la === lb) return true;
  if (!locationCache.length) return false;
  const sa = resolveSync(la, locationCache, type);
  const sb = resolveSync(lb, locationCache, type);
  if (sa === null || sb === null) return false;
  return sa === sb;
}

export async function locationsMatch(a: string | null | undefined, b: string | null | undefined, type?: LocationType): Promise<boolean> {
  if (!a || !b) return false;
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  if (la === lb) return true;
  const cache = await ensureFresh();
  const sa = resolveSync(la, cache, type);
  const sb = resolveSync(lb, cache, type);
  if (sa === null || sb === null) {
    logger.debug({ a, b, sa, sb, type }, "Location mismatch: one or both values could not be resolved");
    return false;
  }
  const matched = sa === sb;
  if (!matched) {
    logger.debug({ a, b, sa, sb, type }, "Location mismatch after resolution");
  }
  return matched;
}

export function invalidateLocationCache(): void {
  locationCache = [];
  cacheLoadedAt = 0;
  legacyAliasMap = {};
}

/**
 * Finds the best-matching location for one or more raw terms (e.g. suburb, city names
 * returned by Nominatim). Tries every term against the in-memory cache using the same
 * scored fuzzy strategy as resolveSync and returns the highest-confidence hit.
 *
 * @param terms   Array of raw strings to try (tried in order; highest score across all wins).
 * @param type    Restrict to "governorate", "area", or "neighborhood". Undefined = any.
 * @param parentId  When type="area", restrict candidates to this parent governorate ID.
 * @returns       The matching location row, or null if no term reaches the minimum score.
 */
export async function matchLocation(
  terms: string[],
  type?: LocationType,
  parentId?: string,
): Promise<{ id: string; slug: string; nameEn: string; nameAr: string } | null> {
  if (!terms.length) return null;
  const cache = await ensureFresh();
  if (!cache.length) return null;

  let pool = type ? cache.filter((l) => l.type === type) : cache;
  if (parentId) {
    pool = pool.filter((l) => l.parentId === parentId);
  }
  if (!pool.length) return null;

  let best: LocationRow | null = null;
  let bestScore = 0;

  for (const term of terms) {
    if (!term?.trim()) continue;
    const rawKey = term.trim().toLowerCase();
    const aliasHit = legacyAliasMap[rawKey] ?? legacyAliasMap[stripNoise(rawKey)];
    if (aliasHit) {
      const loc = pool.find((l) => l.slug === aliasHit);
      if (loc && 90 > bestScore) {
        bestScore = 90;
        best = loc;
        continue;
      }
    }
    for (const loc of pool) {
      const score = scoreMatch(term, loc);
      if (score > bestScore) {
        bestScore = score;
        best = loc;
      }
    }
  }

  if (!best || bestScore < 55) return null;
  return { id: best.id, slug: best.slug, nameEn: best.nameEn, nameAr: best.nameAr };
}
