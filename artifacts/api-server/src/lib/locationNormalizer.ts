import { db, locationsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Legacy slug alias map — maps old single-word area/gov slugs (pre-v2 format)
 * to new canonical `{gov}__{city}` slugs. Used before fuzzy matching so old stored
 * values in user profiles or orders resolve deterministically to the current dataset.
 *
 * Old format: plain name or single-word slug (e.g. "smouha", "nasr_city")
 * New format: "gov__city" double-underscore slug (e.g. "alexandria__smouha")
 *
 * The fuzzy matcher already handles most old names via nameEn/nameAr matching at
 * score ≥ 95. This map covers edge cases where old slugs differ from current nameEn
 * or contain abbreviations not caught by stripNoise.
 */
const LEGACY_SLUG_ALIASES: Record<string, string> = {
  smouha: "alexandria__smouha",
  ibrahimia: "alexandria__al_ibrahimeyah",
  ibrahimeya: "alexandria__al_ibrahimeyah",
  montaza: "alexandria__el_montaza",
  mandara: "alexandria__al_mandara",
  mamurah: "alexandria__al_mamurah",
  agamy: "alexandria__agamy",
  flemming: "alexandria__fleming",
  "nasr city": "cairo__nasr_city",
  nasr: "cairo__nasr_city",
  maadi: "cairo__maadi",
  zamalek: "cairo__zamalek",
  heliopolis: "cairo__new_heliopolis",
  mohandeseen: "giza__mohandessin",
  mohandesen: "giza__mohandessin",
  "october city": "giza__sixth_of_october",
  "6 october": "giza__sixth_of_october",
  "6th october": "giza__sixth_of_october",
};

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

export async function warmLocationCache(): Promise<void> {
  try {
    const rows = await db.select().from(locationsTable);
    locationCache = rows as LocationRow[];
    cacheLoadedAt = Date.now();
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

function resolveSync(raw: string, cache: LocationRow[], type?: LocationType): string {
  if (!cache.length) return raw.toLowerCase();

  const rawKey = raw.toLowerCase().trim().replace(/[_]/g, " ");
  if (LEGACY_SLUG_ALIASES[rawKey]) {
    const alias = LEGACY_SLUG_ALIASES[rawKey];
    const found = cache.find((l) => l.slug === alias);
    if (found) return found.slug;
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
  return best && bestScore >= 55 ? best.slug : raw.toLowerCase().replace(/[_\-]/g, " ").trim();
}

export async function normalizeToSlug(raw: string | null | undefined, type?: LocationType): Promise<string | null> {
  if (!raw?.trim()) return null;
  const cache = await ensureFresh();
  const resolved = resolveSync(raw.trim(), cache, type);
  if (resolved !== raw.trim().toLowerCase()) {
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
  const matched = sa === sb;
  if (!matched) {
    logger.debug({ a, b, sa, sb, type }, "Location mismatch after resolution");
  }
  return matched;
}

export function invalidateLocationCache(): void {
  locationCache = [];
  cacheLoadedAt = 0;
}
