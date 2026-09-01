/**
 * Local Expo dev launcher.
 * Uses LAN host so the QR code works on phones on the same Wi-Fi.
 * Set EXPO_PUBLIC_API_URL in .env (e.g. http://localhost:8080 or https://api.upnexa-eg.com).
 */

const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const port = process.env.EXPO_PORT || process.env.METRO_PORT || "8081";

const env = {
  ...process.env,
  EXPO_OFFLINE: "1",
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--use-system-ca",
};

console.log("[Local] Using local network IP for QR code");
if (!env.EXPO_PUBLIC_API_URL && !env.EXPO_PUBLIC_DOMAIN) {
  console.log("[Local] Set EXPO_PUBLIC_API_URL to point at your API server");
} else if (env.EXPO_PUBLIC_API_URL) {
  console.log(`[Local] API base → ${env.EXPO_PUBLIC_API_URL}`);
}

const args = [
  "exec",
  "expo",
  "start",
  "--port",
  port,
  "--host",
  "lan",
  "--offline",
];

console.log(`[start] pnpm ${args.join(" ")}\n`);

const child = spawn("pnpm", args, {
  env,
  stdio: "inherit",
  cwd: projectRoot,
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
