#!/usr/bin/env bash
# Run on VPS after uploading fanni-vps-upload.zip (and optionally fanni.apk) to /root/
set -euo pipefail

mkdir -p /var/www/fanni /var/www/fanni-web /var/www/storage/fanni/{id,carnehat,avatars,documents,uploads}

KEEP_ENV=""
if [ -f /var/www/fanni/.env ]; then
  cp /var/www/fanni/.env /root/fanni.env.bak
  KEEP_ENV=1
fi

rm -rf /tmp/fanni-unpack
mkdir -p /tmp/fanni-unpack
unzip -o /root/fanni-vps-upload.zip -d /tmp/fanni-unpack
rsync -a --delete --exclude '.env' /tmp/fanni-unpack/ /var/www/fanni/

if [ -n "$KEEP_ENV" ]; then
  cp /root/fanni.env.bak /var/www/fanni/.env
fi

if [ -d /var/www/fanni/artifacts/mobile/dist-web ]; then
  bash /var/www/fanni/scripts/stage-apk-for-web.sh /var/www/fanni/artifacts/mobile/dist-web
  bash /var/www/fanni/scripts/publish-fanni-web.sh /var/www/fanni/artifacts/mobile/dist-web
fi

if [ -f /root/fanni.apk ]; then
  install -d /var/www/upnexa-eg.com /var/www/fanni-web
  cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
  cp /root/fanni.apk /var/www/fanni-web/fanni.apk
  chmod 644 /var/www/upnexa-eg.com/fanni.apk /var/www/fanni-web/fanni.apk
  echo "[remote-install] APK → /var/www/fanni-web/fanni.apk (app.upnexa-eg.com/fanni.apk)"
fi

pm2 delete fanni-backend 2>/dev/null || true
pm2 delete fanni-api 2>/dev/null || true

cd /var/www/fanni
sed -i 's/\r$//' scripts/deploy-vps.sh scripts/remote-install-from-zip.sh 2>/dev/null || true
export FANNI_APP_DIR=/var/www/fanni
export FANNI_SKIP_WEB=1
bash scripts/deploy-vps.sh

echo "--- health local ---"
curl -sS http://127.0.0.1:5000/api/healthz || curl -sS http://127.0.0.1:5000/healthz
echo ""
pm2 ls
