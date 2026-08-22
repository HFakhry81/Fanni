/** Parse CORS_ORIGINS (comma-separated). Empty Origin is allowed for native apps. */

const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

export function allowedCorsOrigins(): string[] {
  const raw = process.env["CORS_ORIGINS"]?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (process.env["NODE_ENV"] === "production") {
    return [];
  }
  return LOCAL_DEV_ORIGINS;
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedCorsOrigins().includes(origin);
}
