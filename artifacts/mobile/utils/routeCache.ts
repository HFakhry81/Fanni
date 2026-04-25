import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RouteData {
  coords: Array<{ lat: number; lng: number }>;
  durationSec: number;
  distanceM: number;
}

export const ROUTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ROUTE_CACHE_KEY_PREFIX = "route_cache:";

export async function readPersistedRoute(key: string): Promise<RouteData | null> {
  try {
    const raw = await AsyncStorage.getItem(ROUTE_CACHE_KEY_PREFIX + key);
    if (!raw) return null;
    const parsed: { data: RouteData; cachedAt: number } = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > ROUTE_CACHE_TTL_MS) {
      await AsyncStorage.removeItem(ROUTE_CACHE_KEY_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export async function writePersistedRoute(key: string, data: RouteData): Promise<void> {
  try {
    await AsyncStorage.setItem(
      ROUTE_CACHE_KEY_PREFIX + key,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
  }
}

let _routeCacheSweptThisSession = false;

export async function sweepExpiredRouteCache(): Promise<void> {
  if (_routeCacheSweptThisSession) return;
  _routeCacheSweptThisSession = true;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(ROUTE_CACHE_KEY_PREFIX));
    if (cacheKeys.length === 0) return;
    const pairs = await AsyncStorage.multiGet(cacheKeys);
    const now = Date.now();
    const expiredKeys: string[] = [];
    for (const [fullKey, raw] of pairs) {
      if (!raw) {
        expiredKeys.push(fullKey);
        continue;
      }
      try {
        const parsed: { cachedAt: number } = JSON.parse(raw);
        if (now - parsed.cachedAt > ROUTE_CACHE_TTL_MS) {
          expiredKeys.push(fullKey);
        }
      } catch {
        expiredKeys.push(fullKey);
      }
    }
    if (expiredKeys.length > 0) {
      await AsyncStorage.multiRemove(expiredKeys);
    }
  } catch {
    _routeCacheSweptThisSession = false;
  }
}
