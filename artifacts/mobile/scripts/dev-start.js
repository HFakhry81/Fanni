/**
 * Smart Expo dev launcher.
 *
 * Replit:  REPLIT_DEV_DOMAIN is set → uses EXPO_PACKAGER_PROXY_URL so that
 *          the QR code points to the public Replit domain (accessible from any
 *          phone) and binds Metro to localhost only (--localhost).
 *
 * Local:   REPLIT_DEV_DOMAIN is NOT set → lets Metro auto-detect the local
 *          network IP so the QR code works on phones on the same Wi-Fi.
 */

const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const isReplit = !!process.env.REPLIT_DEV_DOMAIN;
const port = process.env.PORT || "5000";

const env = { ...process.env };

if (isReplit) {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const expoDomain = process.env.REPLIT_EXPO_DEV_DOMAIN || devDomain;

  env.EXPO_PACKAGER_PROXY_URL = `https://${expoDomain}`;
  env.REACT_NATIVE_PACKAGER_HOSTNAME = devDomain;
  env.EXPO_PUBLIC_DOMAIN = devDomain;
  env.EXPO_PUBLIC_REPL_ID = process.env.REPL_ID || "";
  env.EXPO_PUBLIC_API_URL =
    env.EXPO_PUBLIC_API_URL || `https://${devDomain}:8080`;

  console.log(`[Replit] Expo proxy → https://${expoDomain}`);
  console.log(`[Replit] API base   → ${env.EXPO_PUBLIC_API_URL}`);
} else {
  console.log("[Local] Using local network IP for QR code");
  if (!env.EXPO_PUBLIC_API_URL && !env.EXPO_PUBLIC_DOMAIN) {
    console.log("[Local] Set EXPO_PUBLIC_API_URL to point at your local API server");
  }
}

const args = [
  "exec", "expo", "start",
  "--web",
  "--port", port,
];

if (isReplit) {
  args.push("--localhost");
}

console.log(`[start] pnpm ${args.join(" ")}\n`);

const child = spawn("pnpm", args, {
  env,
  stdio: "inherit",
  cwd: projectRoot,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
