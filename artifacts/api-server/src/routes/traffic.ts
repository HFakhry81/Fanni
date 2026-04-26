import { Router, type IRouter } from "express";

const router: IRouter = Router();

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 60 * 60 * 1000;
const OVERPASS_TIMEOUT_MS = 12000;
const MAX_BBOX_DEGREES = 1.0;

interface OverpassElement {
  type: string;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: { maxspeed?: string };
}

export interface SpeedWay {
  nodes: Array<{ lat: number; lng: number }>;
  maxspeedKmh: number;
}

const speedCache = new Map<string, { data: SpeedWay[]; at: number }>();

function parseMaxspeedKmh(raw: string | undefined): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "walk" || lower === "foot") return 7;
  if (lower === "living_street") return 10;
  if (lower === "none" || lower === "unlimited") return null;
  const match = lower.match(/^(\d+)\s*(mph)?/);
  if (!match) return null;
  const val = parseInt(match[1]);
  if (match[2] === "mph") return Math.round(val * 1.60934);
  return val;
}

router.get("/traffic/maxspeeds", async (req, res) => {
  const boundsRaw = req.query.bounds as string | undefined;
  if (!boundsRaw) {
    res.status(400).json({ error: "bounds required (lat_min,lng_min,lat_max,lng_max)" });
    return;
  }
  const parts = boundsRaw.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    res.status(400).json({ error: "Invalid bounds format" });
    return;
  }
  const [latMin, lngMin, latMax, lngMax] = parts;
  if (latMax - latMin > MAX_BBOX_DEGREES || lngMax - lngMin > MAX_BBOX_DEGREES) {
    res.status(400).json({ error: "Bounding box too large (max 1 degree per side)" });
    return;
  }

  const cacheKey = parts.map((n) => n.toFixed(3)).join(",");
  const cached = speedCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.json({ ways: cached.data, cached: true });
    return;
  }

  const query = `[out:json][timeout:10];way["maxspeed"](${latMin},${lngMin},${latMax},${lngMax});out geom;`;
  const overpassUrlWithQuery = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    const overpassRes = await fetch(overpassUrlWithQuery, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "FanniApp/1.0 (home-maintenance)",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!overpassRes.ok) {
      res.status(502).json({ error: "Overpass API error" });
      return;
    }

    const data = await overpassRes.json() as { elements: OverpassElement[] };

    const ways: SpeedWay[] = data.elements
      .filter((el) => el.type === "way" && el.geometry && el.geometry.length >= 2)
      .map((el) => ({
        nodes: el.geometry!.map((g) => ({ lat: g.lat, lng: g.lon })),
        maxspeedKmh: parseMaxspeedKmh(el.tags?.maxspeed) ?? 0,
      }))
      .filter((w) => w.maxspeedKmh > 0);

    speedCache.set(cacheKey, { data: ways, at: Date.now() });
    res.json({ ways });
  } catch {
    res.status(504).json({ error: "Overpass API timeout or unreachable" });
  }
});

export default router;
