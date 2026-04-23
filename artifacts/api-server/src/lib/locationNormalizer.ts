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
    .replace(/\s+(district|governorate|area|region|quarter|neighborhood|hay|حي|منطقة|محافظة)\s*$/i, "")
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

  return 0;
}

type LocationType = "governorate" | "area" | "neighborhood";

function resolveSync(raw: string, cache: LocationRow[], type?: LocationType): string {
  if (!cache.length) return raw.toLowerCase();
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
