import { Router, type IRouter } from "express";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, nominatimCacheTable, locationsTable } from "@workspace/db";

const router: IRouter = Router();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const CACHE_DAYS = 30;
const MIN_INTERVAL_MS = 1100;
const USER_AGENT = "Fanni-HomeApp/1.0 (contact@fanni-eg.com)";

// ─── True serialized 1-req/sec queue ──────────────────────────────────────────
// All Nominatim requests go through this promise chain — concurrent callers
// queue up and are served sequentially with at least MIN_INTERVAL_MS between
// actual HTTP requests.

let nominatimQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

async function nominatimFetch(url: string): Promise<unknown> {
  // Attach to the end of the current chain; the next caller will wait for us.
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

  // Advance the queue regardless of success/failure so subsequent callers
  // are not blocked forever on a rejected promise.
  nominatimQueue = ticket.then(
    () => {},
    () => {},
  ) as Promise<void>;

  return ticket;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

async function getCached(cacheKey: string): Promise<unknown | null> {
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

async function setCache(cacheKey: string, lang: string, data: unknown) {
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

// ─── Cached Nominatim call (check cache → queue → store) ──────────────────────

async function cachedNominatim(
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

// ─── GET /geo/search?q=...&lang=ar ────────────────────────────────────────────

router.get("/geo/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const rawLang = (req.query.lang as string | undefined)?.trim() ?? "ar";
  const lang = rawLang === "en" ? "en" : "ar";
  const limitRaw = parseInt((req.query.limit as string) ?? "5", 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 5 : limitRaw), 10);

  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query too short (min 2 chars)" });
    return;
  }

  const cacheKey = `search:${lang}:${limit}:${q.toLowerCase()}`;

  try {
    const url =
      `${NOMINATIM_BASE}/search` +
      `?q=${encodeURIComponent(q)}` +
      `&countrycodes=eg` +
      `&format=json` +
      `&addressdetails=1` +
      `&accept-language=${lang}` +
      `&limit=${limit}`;

    const { data, fromCache } = await cachedNominatim(url, cacheKey, lang);
    res.json({ results: data, cached: fromCache });
  } catch (err) {
    console.error("[geo/search] error:", err);
    res.status(502).json({ error: "Geocoding service unavailable" });
  }
});

// ─── GET /geo/streets?q=...&city_id=...&lang=ar ───────────────────────────────
// Looks up the city by ID, calls Nominatim /search scoped to that city,
// caches results 7 days, returns up to 8 { label, lat, lon } results.

router.get("/geo/streets", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const cityId = (req.query.city_id as string | undefined)?.trim();
  const rawLang = (req.query.lang as string | undefined)?.trim() ?? "ar";
  const lang = rawLang === "en" ? "en" : "ar";

  if (!q || q.length < 3) {
    res.status(400).json({ error: "Query too short (min 3 chars)" });
    return;
  }

  try {
    let cityName = cityId ?? "";

    if (cityId) {
      const [loc] = await db
        .select({ nameEn: locationsTable.nameEn, nameAr: locationsTable.nameAr })
        .from(locationsTable)
        .where(eq(locationsTable.id, cityId))
        .limit(1);

      if (loc) {
        cityName = lang === "ar" ? loc.nameAr : loc.nameEn;
      }
    }

    const searchQ = cityName ? `${q}, ${cityName}, Egypt` : `${q}, Egypt`;
    const cacheKey = `streets:${lang}:${cityId ?? "all"}:${q.toLowerCase()}`;

    const url =
      `${NOMINATIM_BASE}/search` +
      `?q=${encodeURIComponent(searchQ)}` +
      `&countrycodes=eg` +
      `&format=json` +
      `&addressdetails=1` +
      `&accept-language=${lang}` +
      `&limit=8`;

    const STREETS_CACHE_DAYS = 7;
    const cached = await getCached(cacheKey);
    if (cached) {
      const arr = Array.isArray(cached) ? cached : [];
      const results = arr.slice(0, 8).map((r: Record<string, unknown>) => ({
        label: r.display_name,
        lat: parseFloat(r.lat as string),
        lon: parseFloat(r.lon as string),
      }));
      res.json({ results, cached: true });
      return;
    }

    const data = await nominatimFetch(url) as Array<Record<string, unknown>>;
    const expiresAt = new Date(Date.now() + STREETS_CACHE_DAYS * 24 * 60 * 60 * 1000);
    await db
      .insert(nominatimCacheTable)
      .values({ cacheKey, lang, responseJson: data as Record<string, unknown>[], expiresAt })
      .onConflictDoUpdate({
        target: nominatimCacheTable.cacheKey,
        set: { responseJson: data as Record<string, unknown>[], cachedAt: sql`now()`, expiresAt },
      });

    const results = (Array.isArray(data) ? data : []).slice(0, 8).map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat as string),
      lon: parseFloat(r.lon as string),
    }));
    res.json({ results, cached: false });
  } catch (err) {
    console.error("[geo/streets] error:", err);
    res.status(502).json({ error: "Geocoding service unavailable" });
  }
});

// ─── GET /geo/reverse?lat=...&lon=... ─────────────────────────────────────────
// Always returns BOTH Arabic and English results in a single response.
// The optional `lang` param is still accepted for backward compat but ignored —
// the response always contains `resultAr` and `resultEn`.

router.get("/geo/reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: "lat and lon are required numbers" });
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ error: "Coordinates out of range" });
    return;
  }

  const latR = lat.toFixed(5);
  const lonR = lon.toFixed(5);

  const cacheKeyAr = `reverse:ar:${latR}:${lonR}`;
  const cacheKeyEn = `reverse:en:${latR}:${lonR}`;

  try {
    const buildUrl = (l: string) =>
      `${NOMINATIM_BASE}/reverse` +
      `?lat=${latR}&lon=${lonR}&format=json&addressdetails=1&accept-language=${l}`;

    const [ar, en] = await Promise.all([
      cachedNominatim(buildUrl("ar"), cacheKeyAr, "ar"),
      cachedNominatim(buildUrl("en"), cacheKeyEn, "en"),
    ]);

    res.json({ resultAr: ar.data, resultEn: en.data, cached: ar.fromCache && en.fromCache });
  } catch (err) {
    console.error("[geo/reverse] error:", err);
    res.status(502).json({ error: "Geocoding service unavailable" });
  }
});

export default router;
