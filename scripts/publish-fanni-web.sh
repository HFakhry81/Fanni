#!/usr/bin/env bash
# Sync Expo web export into /var/www/fanni-web (app.upnexa-eg.com).
# Usage on VPS:
#   bash scripts/publish-fanni-web.sh /var/www/fanni/artifacts/mobile/dist-web
#   bash scripts/publish-fanni-web.sh /tmp/fanni-web-unpack   # auto-detects dist-web/ or dist/
set -euo pipefail

WEB_DIR="${FANNI_WEB_DIR:-/var/www/fanni-web}"
SRC="${1:-}"

resolve_src() {
  local base="$1"
  if [ -z "$base" ]; then
    echo "Usage: $0 <path-to-export-or-unzip-dir>" >&2
    exit 1
  fi
  if [ -f "$base/index.html" ]; then
    echo "$base"
    return
  fi
  if [ -f "$base/dist-web/index.html" ]; then
    echo "$base/dist-web"
    return
  fi
  if [ -f "$base/dist/index.html" ]; then
    echo "$base/dist"
    return
  fi
  echo "ERROR: no index.html in $base (or dist-web/ or dist/ subfolder)" >&2
  exit 1
}

RESOLVED="$(resolve_src "$SRC")"
echo "[publish-fanni-web] source: $RESOLVED"
echo "[publish-fanni-web] target: $WEB_DIR"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/stage-apk-for-web.sh" "$RESOLVED"

ENTRY="$(grep -o 'entry-[^"]*\.js' "$RESOLVED/index.html" | head -1 || true)"
if [ -z "$ENTRY" ] || [ ! -f "$RESOLVED/_expo/static/js/web/$ENTRY" ]; then
  echo "ERROR: index.html references ${ENTRY:-?} but file is missing under $RESOLVED/_expo/static/js/web/" >&2
  exit 1
fi

mkdir -p "$WEB_DIR"
rsync -a --delete "$RESOLVED/" "$WEB_DIR/"
chown -R www-data:www-data "$WEB_DIR" 2>/dev/null || true
find "$WEB_DIR" -type d -exec chmod 755 {} \;
find "$WEB_DIR" -type f -exec chmod 644 {} \;

ENTRY="$(grep -o 'entry-[^"]*\.js' "$WEB_DIR/index.html" | head -1)"
echo "[publish-fanni-web] OK index.html + _expo/static/js/web/$ENTRY"
if [ -f "$WEB_DIR/fanni.apk" ]; then
  apk_size="$(du -h "$WEB_DIR/fanni.apk" | awk '{print $1}')"
  echo "[publish-fanni-web] OK fanni.apk ($apk_size) — https://app.upnexa-eg.com/fanni.apk"
else
  echo "[publish-fanni-web] WARN: fanni.apk missing — upload EAS build to /root/fanni.apk then re-run publish" >&2
fi
