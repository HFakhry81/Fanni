#!/usr/bin/env bash
# Copy fanni.apk into an Expo web export dir so publish rsync keeps the download link.
# Usage: bash scripts/stage-apk-for-web.sh /path/to/dist-web
set -euo pipefail

OUT_DIR="${1:-}"
if [ -z "$OUT_DIR" ]; then
  echo "Usage: $0 <dist-web-directory>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$OUT_DIR"

# First existing source wins (newest build preferred).
CANDIDATES=(
  "$ROOT/artifacts/mobile/dist/fanni.apk"
  "/root/fanni.apk"
  "$ROOT/fanni.apk"
  "/var/www/fanni-web/fanni.apk"
  "/var/www/upnexa-eg.com/fanni.apk"
)

for src in "${CANDIDATES[@]}"; do
  if [ -f "$src" ]; then
    cp "$src" "$OUT_DIR/fanni.apk"
    size="$(du -h "$OUT_DIR/fanni.apk" | awk '{print $1}')"
    echo "[stage-apk] staged fanni.apk ($size) from $src → $OUT_DIR/fanni.apk"
    exit 0
  fi
done

echo "[stage-apk] WARN: no fanni.apk found — https://app.upnexa-eg.com/fanni.apk will fail until you upload an EAS build" >&2
exit 0
