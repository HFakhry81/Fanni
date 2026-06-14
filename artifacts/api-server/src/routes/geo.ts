import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { eq } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import { NOMINATIM_BASE, nominatimFetch, getCached, setCache, cachedNominatim } from "../lib/nominatim";
import { queryString, queryInt, queryFloat } from "../lib/queryParams";

const router: IRouter = Router();

// ─── True serialized 1-req/sec queue ──────────────────────────────────────────
// All Nominatim requests go through the shared nominatim.ts module's queue so
// all callers in this process respect the 1 req/sec policy collectively.

// ─── GET /geo/search?q=...&lang=ar ────────────────────────────────────────────

router.get("/geo/search", async (req, res) => {
  const q = queryString(req.query.q)?.trim();
  const rawLang = queryString(req.query.lang)?.trim() ?? "ar";
  const lang = rawLang === "en" ? "en" : "ar";
  const limitRaw = queryInt(req.query.limit, 5);
  const limit = Math.min(Math.max(1, limitRaw), 10);

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
// caches results via the shared setCache helper, returns up to 8 { label, lat, lon } results.

router.get("/geo/streets", async (req, res) => {
  const q = queryString(req.query.q)?.trim();
  const cityId = queryString(req.query.city_id)?.trim();
  const rawLang = queryString(req.query.lang)?.trim() ?? "ar";
  const lang = rawLang === "en" ? "en" : "ar";

  if (!q || q.length < 3) {
    res.status(400).json({ error: "Query too short (min 3 chars)" });
    return;
  }
  if (!cityId) {
    res.status(400).json({ error: "city_id is required" });
    return;
  }

  try {
    let cityName = "";

    const [loc] = await db
      .select({ nameEn: locationsTable.nameEn, nameAr: locationsTable.nameAr })
      .from(locationsTable)
      .where(eq(locationsTable.id, cityId))
      .limit(1);

    if (!loc) {
      res.status(404).json({ error: "city_id not found" });
      return;
    }
    cityName = lang === "ar" ? loc.nameAr : loc.nameEn;

    const searchQ = `${q}, ${cityName}, Egypt`;
    const cacheKey = `streets:${lang}:${cityId}:${q.toLowerCase()}`;

    const url =
      `${NOMINATIM_BASE}/search` +
      `?q=${encodeURIComponent(searchQ)}` +
      `&countrycodes=eg` +
      `&format=json` +
      `&addressdetails=1` +
      `&featuretype=street` +
      `&accept-language=${lang}` +
      `&limit=8`;

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
    await setCache(cacheKey, lang, data);

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
  const lat = queryFloat(req.query.lat);
  const lon = queryFloat(req.query.lon);

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
