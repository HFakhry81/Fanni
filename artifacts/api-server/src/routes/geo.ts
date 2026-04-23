import { Router, type IRouter } from "express";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, nominatimCacheTable } from "@workspace/db";

const router: IRouter = Router();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const CACHE_DAYS = 30;
const USER_AGENT = "Fanni-HomeApp/1.0 (contact@fanni-eg.com)";

// ─── Simple 1-request-per-second queue ────────────────────────────────────────

let lastRequestAt = 0;

async function nominatimFetch(url: string): Promise<unknown> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  const MIN_INTERVAL_MS = 1100;

  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise<void>((res) =>
      setTimeout(res, MIN_INTERVAL_MS - elapsed),
    );
  }

  lastRequestAt = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ar,en",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim ${response.status}: ${await response.text()}`);
  }

  return response.json();
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
  await db
    .insert(nominatimCacheTable)
    .values({
      cacheKey,
      lang,
      responseJson: data as never,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: nominatimCacheTable.cacheKey,
      set: {
        responseJson: data as never,
        cachedAt: sql`now()`,
        expiresAt,
      },
    });
}

// ─── GET /geo/search?q=...&lang=ar ────────────────────────────────────────────

router.get("/geo/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const lang = ((req.query.lang as string | undefined) ?? "ar").trim();
  const limit = Math.min(parseInt((req.query.limit as string) ?? "5", 10), 10);

  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query too short (min 2 chars)" });
    return;
  }

  const cacheKey = `search:${lang}:${q.toLowerCase()}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json({ results: cached, cached: true });
      return;
    }

    const url =
      `${NOMINATIM_BASE}/search` +
      `?q=${encodeURIComponent(q)}` +
      `&countrycodes=eg` +
      `&format=json` +
      `&addressdetails=1` +
      `&accept-language=${lang}` +
      `&limit=${limit}`;

    const data = await nominatimFetch(url);
    await setCache(cacheKey, lang, data);
    res.json({ results: data, cached: false });
  } catch (err) {
    console.error("[geo/search] error:", err);
    res.status(502).json({ error: "Geocoding service unavailable" });
  }
});

// ─── GET /geo/reverse?lat=...&lon=...&lang=ar ─────────────────────────────────

router.get("/geo/reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const lang = ((req.query.lang as string | undefined) ?? "ar").trim();

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
  const cacheKey = `reverse:${lang}:${latR}:${lonR}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json({ result: cached, cached: true });
      return;
    }

    const url =
      `${NOMINATIM_BASE}/reverse` +
      `?lat=${latR}` +
      `&lon=${lonR}` +
      `&format=json` +
      `&addressdetails=1` +
      `&accept-language=${lang}`;

    const data = await nominatimFetch(url);
    await setCache(cacheKey, lang, data);
    res.json({ result: data, cached: false });
  } catch (err) {
    console.error("[geo/reverse] error:", err);
    res.status(502).json({ error: "Geocoding service unavailable" });
  }
});

export default router;
