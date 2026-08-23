#!/usr/bin/env bash
# Run THIS SCRIPT ON THE UBUNTU VPS (SSH/panel session you already have).
# This Windows/Cursor machine cannot SSH: api.upnexa-eg.com is Cloudflare-proxied
# (port 22 hits Cloudflare, not origin) and there is no local SSH key.
#
#   cd /var/www/fanni   # or your clone path
#   git pull
#   bash scripts/deploy-vps.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STORAGE_ROOT="${PRIVATE_OBJECT_DIR:-/var/www/storage/fanni}"
STORAGE_ID="${PRIVATE_OBJECT_DIR_ID:-${STORAGE_ROOT}/id}"
STORAGE_CARNEHAT="${PRIVATE_OBJECT_DIR_CARNEHAT:-${STORAGE_ROOT}/carnehat}"

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
  echo "[deploy] no .env — copying keys from deploy/env.production.example (fill DATABASE_URL and SESSION_SECRET)"
  cp "$EXAMPLE" "$ENV_FILE"
else
  echo "[deploy] .env exists — appending missing keys only"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ""|\#*) continue ;;
    esac
    key="${line%%=*}"
    if ! grep -qE "^${key}=" "$ENV_FILE"; then
      printf '%s\n' "$line" >> "$ENV_FILE"
      echo "[deploy] added missing key $key"
    fi
  done < "$EXAMPLE"
fi

if [ ! -f "$ROOT/.env" ]; then
  echo "[deploy] ERROR: .env missing"
  exit 1
fi

export FANNI_APP_DIR="$ROOT"

if command -v pnpm >/dev/null 2>&1; then
  PNPM=pnpm
elif [ -f "$HOME/.local/share/pnpm/pnpm" ]; then
  PNPM="$HOME/.local/share/pnpm/pnpm"
else
  echo "[deploy] installing pnpm"
  npm install -g pnpm
  PNPM=pnpm
fi

echo "[deploy] install + migrate + build"
"$PNPM" install --frozen-lockfile
"$PNPM" --filter @workspace/db run migrate
"$PNPM" --filter @workspace/api-server run build

if command -v pm2 >/dev/null 2>&1; then
  echo "[deploy] restart PM2 fanni-api"
  FANNI_APP_DIR="$ROOT" pm2 startOrReload "$ROOT/deploy/ecosystem.config.cjs" --update-env
  pm2 save || true
else
  echo "[deploy] PM2 not found — start with: PORT=5000 NODE_ENV=production $PNPM --filter @workspace/api-server run start"
fi

echo "[deploy] local health check"
if curl -sf "http://127.0.0.1:5000/api/healthz" >/dev/null || curl -sf "http://127.0.0.1:5000/healthz" >/dev/null; then
  echo "[deploy] local API healthy"
else
  echo "[deploy] WARN: local healthz failed — check pm2 logs"
fi
