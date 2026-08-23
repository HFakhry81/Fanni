/**
 * PM2 process file for the Fanni API on Ubuntu (Apache reverse-proxies to :5000).
 * Usage on the VPS: FANNI_APP_DIR=/var/www/fanni pm2 start deploy/ecosystem.config.cjs --update-env
 */
const path = require("node:path");

const appDir = process.env.FANNI_APP_DIR || "/var/www/fanni";
const apiDir = path.join(appDir, "artifacts", "api-server");

module.exports = {
  apps: [
    {
      name: "fanni-api",
      cwd: apiDir,
      script: "dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps --import ./dist/sentry.mjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env_file: path.join(appDir, ".env"),
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
    },
  ],
};
