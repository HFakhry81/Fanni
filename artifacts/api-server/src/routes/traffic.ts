/**
 * GET /api/traffic/speeds?points=lat,lng,lat,lng,...
 *
 * Returns estimated current speed (km/h) for each requested route sample point.
 *
 * Data sources (tried in order):
 *  1. TomTom Traffic Flow Segment API — live congestion speeds (requires TOMTOM_API_KEY env var)
 *  2. OpenStreetMap maxspeed via Overpass + time-of-day congestion multiplier — estimated
 *
 * Caller is expected to sample the route (e.g. every ~500 m) and send the
 * sampled coordinates as pairs.  The mobile client then assigns each full
 * route coordinate the speed of its nearest returned sample point and maps
 * it to a colour with speedKmhToColor().
 */
import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TOMTOM_BASE = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";
const FETCH_TIMEOUT_MS = 12_000;
const TOMTOM_CACHE_TTL_MS = 5 * 60 * 1000;     // 5 min — near-live
const OVERPASS_CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hr  — semi-static

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; at: number; }
const tomtomCache = new Map<string, CacheEntry<SpeedPoint[]>>();
const overpassCache = new Map<string, CacheEntry<OverpassWay[]>>();

// ─── Types ───────────────────────────────────────────────────────────────────

interface LatLng { lat: number; lng: number; }

export interface SpeedPoint extends LatLng { speedKmh: number; }

interface OverpassWay {
  nodes: LatLng[];
  maxspeedKmh: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Egypt time-of-day congestion factor (0 – 1, lower = heavier traffic).
 * Modelled on Cairo/Alexandria patterns.
 */
function congestionFactor(now: Date): number {
  const h = now.getHours() + now.getMinutes() / 60;
  // Morning peak 8–10 am
  if (h >= 8 && h < 10) return 0.35;
  // Midday 1–3 pm
  if (h >= 13 && h < 15) return 0.55;
  // Evening peak 5–8 pm
  if (h >= 17 && h < 20) return 0.40;
  // Night light traffic
  if (h < 6 || h >= 22) return 0.95;
  return 0.75;
}

function parseMaxspeedKmh(raw: string | undefined): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "walk" || lower === "foot") return 7;
  if (lower === "living_street") return 10;
  if (lower === "none" || lower === "unlimited") return null;
  const m = lower.match(/^(\d+)\s*(mph)?/);
  if (!m) return null;
  const val = parseInt(m[1]);
  return m[2] === "mph" ? Math.round(val * 1.60934) : val;
}

function dist2(a: LatLng, b: LatLng): number {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
}

// ─── TomTom source ───────────────────────────────────────────────────────────

async function fetchTomTomSpeeds(
  points: LatLng[],
  apiKey: string
): Promise<SpeedPoint[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const results = await Promise.all(
      points.map(async (pt): Promise<SpeedPoint | null> => {
        const url =
          `${TOMTOM_BASE}?point=${pt.lat},${pt.lng}&unit=KMPH&key=${apiKey}`;
        const r = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        });
        if (!r.ok) return null;
        const json = await r.json() as { flowSegmentData?: { currentSpeed?: number } };
        const s = json.flowSegmentData?.currentSpeed;
        if (s == null || s <= 0) return null;
        return { lat: pt.lat, lng: pt.lng, speedKmh: s };
      })
    );
    return results.filter((p): p is SpeedPoint => p !== null);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Overpass source ─────────────────────────────────────────────────────────

async function fetchOverpassWays(
  lats: number[],
  lngs: number[]
): Promise<OverpassWay[]> {
  const latMin = Math.min(...lats) - 0.01;
  const lngMin = Math.min(...lngs) - 0.01;
  const latMax = Math.max(...lats) + 0.01;
  const lngMax = Math.max(...lngs) + 0.01;
  const bboxKey = [latMin, lngMin, latMax, lngMax].map((n) => n.toFixed(3)).join(",");

  const cached = overpassCache.get(bboxKey);
  if (cached && Date.now() - cached.at < OVERPASS_CACHE_TTL_MS) {
    return cached.data;
  }

  const query = `[out:json][timeout:10];way["maxspeed"](${latMin},${lngMin},${latMax},${lngMax});out geom;`;
  const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "FanniApp/1.0" },
    });
    if (!r.ok) throw new Error(`Overpass ${r.status}`);
    const data = await r.json() as {
      elements: Array<{
        type: string;
        geometry?: Array<{ lat: number; lon: number }>;
        tags?: { maxspeed?: string };
      }>;
    };
    const ways: OverpassWay[] = data.elements
      .filter((el) => el.type === "way" && el.geometry && el.geometry.length >= 2)
      .map((el) => ({
        nodes: el.geometry!.map((g) => ({ lat: g.lat, lng: g.lon })),
        maxspeedKmh: parseMaxspeedKmh(el.tags?.maxspeed) ?? 0,
      }))
      .filter((w) => w.maxspeedKmh > 0);
    overpassCache.set(bboxKey, { data: ways, at: Date.now() });
    return ways;
  } finally {
    clearTimeout(timer);
  }
}

function overpassSpeedsWithCongestion(points: LatLng[], ways: OverpassWay[]): SpeedPoint[] {
  const factor = congestionFactor(new Date());
  return points.map((pt) => {
    let minD = Infinity;
    let limitKmh = 0;
    for (const way of ways) {
      for (const node of way.nodes) {
        const d = dist2(pt, node);
        if (d < minD) { minD = d; limitKmh = way.maxspeedKmh; }
      }
    }
    const speedKmh = limitKmh > 0
      ? Math.max(5, Math.round(limitKmh * factor))
      : Math.max(5, Math.round(30 * factor));  // default urban 30 km/h
    return { lat: pt.lat, lng: pt.lng, speedKmh };
  });
}

// ─── Route handler ───────────────────────────────────────────────────────────

router.get("/traffic/speeds", async (req, res) => {
  const pointsRaw = req.query.points as string | undefined;
  if (!pointsRaw) {
    res.status(400).json({ error: "points required (lat,lng,lat,lng,...)" });
    return;
  }
  const nums = pointsRaw.split(",").map(Number);
  if (nums.length < 2 || nums.length % 2 !== 0 || nums.some(isNaN)) {
    res.status(400).json({ error: "points must be comma-separated lat,lng pairs" });
    return;
  }
  const points: LatLng[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    points.push({ lat: nums[i], lng: nums[i + 1] });
  }
  if (points.length > 30) {
    res.status(400).json({ error: "Maximum 30 sample points per request" });
    return;
  }

  const tomtomKey = process.env["TOMTOM_API_KEY"];

  // ── TomTom path ───────────────────────────────────────────────────────────
  if (tomtomKey) {
    const cacheKey = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
    const cached = tomtomCache.get(cacheKey);
    if (cached && Date.now() - cached.at < TOMTOM_CACHE_TTL_MS) {
      res.json({ points: cached.data, source: "tomtom", cached: true });
      return;
    }
    try {
      const speeds = await fetchTomTomSpeeds(points, tomtomKey);
      if (speeds.length >= Math.ceil(points.length * 0.5)) {
        tomtomCache.set(cacheKey, { data: speeds, at: Date.now() });
        res.json({ points: speeds, source: "tomtom" });
        return;
      }
    } catch {
      // fall through to Overpass
    }
  }

  // ── Overpass + time-of-day path ───────────────────────────────────────────
  try {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const ways = await fetchOverpassWays(lats, lngs);
    const speeds = overpassSpeedsWithCongestion(points, ways);
    res.json({ points: speeds, source: "overpass" });
  } catch {
    res.status(504).json({ error: "Traffic data unavailable" });
  }
});

export default router;
