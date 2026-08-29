import Constants from "expo-constants";

export function getApiBase(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;

  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";

  if (domain) {
    const isLocal =
      domain.startsWith("192.168.") ||
      domain.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(domain) ||
      domain === "localhost" ||
      domain.startsWith("127.");
    return isLocal ? `http://${domain}` : `https://${domain}`;
  }

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri ?? "";
    if (hostUri) {
      const host = hostUri.split(":")[0];
      return `http://${host}:8080`;
    }
  }

  return "https://api.upnexa-eg.com";
}

/** Pure helper — maps REST API base URL to WebSocket URL (testable without env). */
export function apiBaseToWsUrl(apiBase: string, path = "/api/ws"): string {
  if (!apiBase) return "";
  const wsBase = apiBase.startsWith("https://")
    ? `wss://${apiBase.slice("https://".length)}`
    : apiBase.startsWith("http://")
      ? `ws://${apiBase.slice("http://".length)}`
      : "";
  if (!wsBase) return "";
  return `${wsBase}${path.startsWith("/") ? path : `/${path}`}`;
}

/** WebSocket base derived from the same API host (https→wss, http→ws). */
export function getWsUrl(path = "/api/ws"): string {
  return apiBaseToWsUrl(getApiBase(), path);
}
