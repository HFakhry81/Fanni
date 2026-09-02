#!/usr/bin/env bash
# VPS one-shot deploy: API + Expo web for app.upnexa-eg.com
# Run from /var/www/fanni:
#   bash scripts/update_server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=================================================="
echo " 🚀 Starting Fanni Server Update & Deployment..."
echo "=================================================="

echo "[1/7] 📥 Pulling latest code from GitHub..."
git pull origin main

echo "[2/7] 📦 Installing/Updating dependencies..."
pnpm install --frozen-lockfile

echo "[3/7] 🗄️ Running Database Migrations..."
pnpm --filter @workspace/db run migrate

echo "[4/7] 🌱 Running Database Seeding..."
pnpm --filter @workspace/db run seed

echo "[5/7] ⚙️ Building Backend..."
pnpm --filter @workspace/db --filter @workspace/api-zod --filter @workspace/api-server run build

echo "[6/7] 🌐 Exporting Web Frontend (dist-web)..."
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.upnexa-eg.com}"
export EXPO_ROUTER_APP_ROOT="${EXPO_ROUTER_APP_ROOT:-./app}"
pushd "$ROOT/artifacts/mobile" >/dev/null
pnpm exec expo export --platform web --output-dir dist-web
popd >/dev/null
bash "$ROOT/scripts/stage-apk-for-web.sh" "$ROOT/artifacts/mobile/dist-web"

echo "[7/7] 📂 Publishing web + restarting PM2..."
bash "$ROOT/scripts/publish-fanni-web.sh" "$ROOT/artifacts/mobile/dist-web"

if command -v pm2 >/dev/null 2>&1; then
  FANNI_APP_DIR="$ROOT" pm2 startOrReload "$ROOT/deploy/ecosystem.config.cjs" --update-env --only fanni-api || pm2 restart all
  pm2 save || true
fi

echo "=================================================="
echo " 🎉 Server Update Completed Successfully!"
echo "=================================================="
