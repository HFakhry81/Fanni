/**
 * Prevent accidental writes / junk data against live production.
 *
 * Writes are allowed when:
 *   - API host is local / private LAN, OR
 *   - E2E_ALLOW_PROD_WRITES=1 (explicit opt-in)
 */

const PROD_HOST_MARKERS = [
  "upnexa-eg.com",
  "api.upnexa-eg.com",
  "app.upnexa-eg.com",
];

export function resolveApiBaseUrl(): string {
  return (
    process.env.E2E_API_URL?.trim() ||
    process.env.E2E_LOCAL_API_URL?.trim() ||
    "https://api.upnexa-eg.com"
  );
}

export function resolveAppBaseUrl(): string {
  return (
    process.env.E2E_BASE_URL?.trim() ||
    process.env.E2E_LOCAL_BASE_URL?.trim() ||
    "https://app.upnexa-eg.com"
  );
}

/** Apply E2E_USE_LOCAL=1 → swap in E2E_LOCAL_* URLs and credentials. */
export function applyLocalE2eOverrides(): void {
  const useLocal =
    process.env.E2E_USE_LOCAL === "1" || process.env.E2E_USE_LOCAL === "true";
  if (!useLocal) return;

  if (process.env.E2E_LOCAL_BASE_URL?.trim()) {
    process.env.E2E_BASE_URL = process.env.E2E_LOCAL_BASE_URL.trim();
  }
  if (process.env.E2E_LOCAL_API_URL?.trim()) {
    process.env.E2E_API_URL = process.env.E2E_LOCAL_API_URL.trim();
  }
  const map: Array<[string, string]> = [
    ["E2E_LOCAL_CLIENT_IDENTIFIER", "E2E_CLIENT_IDENTIFIER"],
    ["E2E_LOCAL_CLIENT_PASSWORD", "E2E_CLIENT_PASSWORD"],
    ["E2E_LOCAL_TECH_IDENTIFIER", "E2E_TECH_IDENTIFIER"],
    ["E2E_LOCAL_TECH_PASSWORD", "E2E_TECH_PASSWORD"],
    ["E2E_LOCAL_ADMIN_IDENTIFIER", "E2E_ADMIN_IDENTIFIER"],
    ["E2E_LOCAL_ADMIN_PASSWORD", "E2E_ADMIN_PASSWORD"],
  ];
  for (const [from, to] of map) {
    const v = process.env[from]?.trim();
    if (v) process.env[to] = v;
  }
}

export function isLocalOrPrivateHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const h = hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isProductionTarget(url = resolveApiBaseUrl()): boolean {
  if (isLocalOrPrivateHost(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROD_HOST_MARKERS.some((m) => host === m || host.endsWith(`.${m}`));
  } catch {
    return true;
  }
}

export function prodWritesAllowed(): boolean {
  return (
    process.env.E2E_ALLOW_PROD_WRITES === "1" ||
    process.env.E2E_ALLOW_PROD_WRITES === "true"
  );
}

/** True when mutating API helpers / write specs may run. */
export function writesAllowed(url = resolveApiBaseUrl()): boolean {
  if (!isProductionTarget(url)) return true;
  return prodWritesAllowed();
}

export function writesBlockedReason(url = resolveApiBaseUrl()): string | null {
  if (writesAllowed(url)) return null;
  return (
    `Blocked write against production API (${url}). ` +
    `Use local API (E2E_USE_LOCAL=1 + E2E_LOCAL_*) or set E2E_ALLOW_PROD_WRITES=1 deliberately.`
  );
}

/** Throw before any mutating E2E API call on production without opt-in. */
export function assertWritesAllowed(action: string): void {
  const reason = writesBlockedReason();
  if (reason) {
    throw new Error(`[prod-safety] Refusing ${action}. ${reason}`);
  }
}

/** For Playwright test.skip(!…) */
export function requireWritableTarget(): boolean {
  return writesAllowed();
}
