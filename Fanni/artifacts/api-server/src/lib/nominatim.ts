/**
 * Shared Nominatim client — single rate-limited queue for all callers.
 *
 * Nominatim's usage policy allows at most 1 request/second. Every request
 * in this process goes through this module's serialised queue so concurrent
 * callers (geo routes, profile-update geocoding, etc.) never exceed that limit.
 * Results are stored in the `nominatim_cache` table for up to 30 days.
 */

import { and, eq, gt, sql } from "drizzle-orm";
import { db, nominatimCacheTable } from "@workspace/db";

export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
export const CACHE_DAYS = 30;
const MIN_INTERVAL_MS = 1100;
const USER_AGENT = "Fanni-HomeApp/1.0 (contact@fanni-eg.com)";

// ─── Single process-wide serialized queue ─────────────────────────────────────

let nominatimQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

export async function nominatimFetch(url: string): Promise<unknown> {
  const ticket = nominatimQueue.then(async () => {
    const now = Date.now();
    const delay = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
    if (delay > 0) {
      await new Promise<void>((r) => setTimeout(r, delay));
    }
    lastRequestAt = Date.now();

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Nominatim ${response.status}: ${await response.text()}`);
    }

    return response.json() as unknown;
  });

  nominatimQueue = ticket.then(
    () => {},
    () => {},
  ) as Promise<void>;

  return ticket;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

export async function getCached(cacheKey: string): Promise<unknown | null> {
  const [row] = await db
    .select({ responseJson: nominatimCacheTable.responseJson })
    .from(nominatimCacheTable)
    .where(
      and(
        eq(nominatimCacheTable.cacheKey, cacheKey),
        gt(nominatimCacheTable.expiresAt, sql`now()`),
      ),
    )
    .limit(1);

  return row?.responseJson ?? null;
}

export async function setCache(cacheKey: string, lang: string, data: unknown) {
  const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000);
  const responseJson = data as Record<string, unknown>;
  await db
    .insert(nominatimCacheTable)
    .values({ cacheKey, lang, responseJson, expiresAt })
    .onConflictDoUpdate({
      target: nominatimCacheTable.cacheKey,
      set: { responseJson, cachedAt: sql`now()`, expiresAt },
    });
}

export async function cachedNominatim(
  url: string,
  cacheKey: string,
  lang: string,
): Promise<{ data: unknown; fromCache: boolean }> {
  const cached = await getCached(cacheKey);
  if (cached) return { data: cached, fromCache: true };

  const data = await nominatimFetch(url);
  await setCache(cacheKey, lang, data);
  return { data, fromCache: false };
}
