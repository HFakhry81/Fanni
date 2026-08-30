#!/usr/bin/env bash
# Run on the Ubuntu origin (not through Cloudflare DNS).
# Local dev (Windows): C:\Fanni — see deploy/VPS-STEPS.md
# Production app root (VPS): /var/www/fanni
# If this file has Windows CRLF: sed -i 's/\r$//' scripts/deploy-vps.sh
#
#   cd /path/to/Fanni
#   git pull
#   bash scripts/deploy-vps.sh
#
# Existing PM2 name, if not fanni-api:
#   FANNI_PM2_NAME=your-process bash scripts/deploy-vps.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STORAGE_ROOT="${PRIVATE_OBJECT_DIR:-/var/www/storage/fanni}"
STORAGE_ID="${PRIVATE_OBJECT_DIR_ID:-${STORAGE_ROOT}/id}"
STORAGE_CARNEHAT="${PRIVATE_OBJECT_DIR_CARNEHAT:-${STORAGE_ROOT}/carnehat}"
PM2_NAME="${FANNI_PM2_NAME:-fanni-api}"

echo "[deploy] app root: $ROOT"
echo "[deploy] ensuring private storage dirs (no public Alias)"
sudo mkdir -p "$STORAGE_ID" "$STORAGE_CARNEHAT" "$STORAGE_ROOT/uploads"
sudo chmod 750 "$STORAGE_ROOT" "$STORAGE_ID" "$STORAGE_CARNEHAT" "$STORAGE_ROOT/uploads" || true
RUN_USER="$(id -un)"
if command -v sudo >/dev/null 2>&1; then
  sudo chown -R "$RUN_USER:$RUN_USER" "$STORAGE_ROOT" || true
fi

ENV_FILE="$ROOT/.env"
EXAMPLE="$ROOT/deploy/env.production.example"
if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] no .env — copying keys from deploy/env.production.example (fill DATABASE_URL and SESSION_SECRET then re-run)"
  cp "$EXAMPLE" "$ENV_FILE"
  echo "[deploy] ERROR: edit $ENV_FILE then run this script again"
  exit 1
fi

echo "[deploy] .env exists — appending missing non-Twilio keys only"
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*) continue ;;
  esac
  key="${line%%=*}"
  case "$key" in
    TWILIO_*) continue ;;
  esac
  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    printf '%s\n' "$line" >> "$ENV_FILE"
    echo "[deploy] added missing key $key"
  fi
done < "$EXAMPLE"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ] || [ -z "${SESSION_SECRET:-}" ]; then
  echo "[deploy] ERROR: DATABASE_URL and SESSION_SECRET must be set in .env"
  exit 1
fi

export FANNI_APP_DIR="$ROOT"
export NODE_ENV=production
export PORT="${PORT:-5000}"

# Tie API errors to deploy version in Sentry (override in .env if needed)
if [ -z "${SENTRY_RELEASE:-}" ] && command -v node >/dev/null 2>&1; then
  APP_VER="$(node -e "const j=require('./artifacts/mobile/app.json'); process.stdout.write(j.expo.version||'unknown')")"
  export SENTRY_RELEASE="fanni-api@${APP_VER}"
  echo "[deploy] SENTRY_RELEASE=${SENTRY_RELEASE}"
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM=pnpm
elif [ -f "$HOME/.local/share/pnpm/pnpm" ]; then
  PNPM="$HOME/.local/share/pnpm/pnpm"
else
  echo "[deploy] installing pnpm"
  npm install -g pnpm
  PNPM=pnpm
fi

echo "[deploy] install + migrate + seed + build"
"$PNPM" install --frozen-lockfile
"$PNPM" --filter @workspace/db run migrate
"$PNPM" --filter @workspace/db run seed
"$PNPM" --filter @workspace/api-server run build

if command -v pm2 >/dev/null 2>&1; then
  echo "[deploy] PM2 process: $PM2_NAME"
  FANNI_APP_DIR="$ROOT" pm2 startOrReload "$ROOT/deploy/ecosystem.config.cjs" --update-env --only "$PM2_NAME"
  pm2 save || true
else
  echo "[deploy] PM2 not found — start with: PORT=5000 NODE_ENV=production $PNPM --filter @workspace/api-server run start"
fi

echo "[deploy] local health check"
sleep 2
if curl -sf "http://127.0.0.1:${PORT}/api/healthz" >/dev/null || curl -sf "http://127.0.0.1:${PORT}/healthz" >/dev/null; then
  echo "[deploy] local API healthy"
else
  echo "[deploy] WARN: local healthz failed — pm2 logs $PM2_NAME"
fi

WEB_DIR="${FANNI_WEB_DIR:-/var/www/fanni-web}"
if [ "${FANNI_SKIP_WEB:-}" != "1" ]; then
  echo "[deploy] Expo web export → $WEB_DIR"
  export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-${PUBLIC_API_URL:-https://api.upnexa-eg.com}}"
  export EXPO_ROUTER_APP_ROOT="${EXPO_ROUTER_APP_ROOT:-./app}"
  if "$PNPM" --filter @workspace/mobile exec expo export --platform web --output-dir dist-web; then
    mkdir -p "$WEB_DIR"
    rsync -a --delete "$ROOT/artifacts/mobile/dist-web/" "$WEB_DIR/"
    echo "[deploy] web synced"
  else
    echo "[deploy] WARN: web export failed — API still deployed. Set FANNI_SKIP_WEB=1 to skip."
  fi
fi
