#!/usr/bin/env bash
# Run on VPS after uploading fanni-vps-upload.zip (and optionally fanni.apk) to /root/
set -euo pipefail

# تصحيح وتأكيد مسارات النظام لضمان العثور على node و pnpm و pm2
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/share/pnpm"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
fi

echo "[remote-install] Preparing directories..."
mkdir -p /var/www/fanni /var/www/fanni-web /var/www/storage/fanni/{id,carnehat,avatars,documents,uploads}

KEEP_ENV=""
if [ -f /var/www/fanni/.env ]; then
  echo "[remote-install] Backing up existing .env file..."
  cp /var/www/fanni/.env /root/fanni.env.bak
  KEEP_ENV=1
fi

echo "[remote-install] Unpacking source code..."
rm -rf /tmp/fanni-unpack
mkdir -p /tmp/fanni-unpack
unzip -o /root/fanni-vps-upload.zip -d /tmp/fanni-unpack

rsync -a --delete --exclude '.env' /tmp/fanni-unpack/ /var/www/fanni/

if [ -n "$KEEP_ENV" ]; then
  echo "[remote-install] Restoring .env file..."
  cp /root/fanni.env.bak /var/www/fanni/.env
fi

if [ -d /var/www/fanni/artifacts/mobile/dist-web ]; then
  echo "[remote-install] Publishing web artifacts..."
  bash /var/www/fanni/scripts/stage-apk-for-web.sh /var/www/fanni/artifacts/mobile/dist-web || true
  bash /var/www/fanni/scripts/publish-fanni-web.sh /var/www/fanni/artifacts/mobile/dist-web || true
fi

if [ -f /root/fanni.apk ]; then
  echo "[remote-install] Deploying APK file..."
  install -d /var/www/upnexa-eg.com /var/www/fanni-web
  cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
  cp /root/fanni.apk /var/www/fanni-web/fanni.apk
  chmod 644 /var/www/upnexa-eg.com/fanni.apk /var/www/fanni-web/fanni.apk
  echo "[remote-install] APK → /var/www/fanni-web/fanni.apk (app.upnexa-eg.com/fanni.apk)"
fi

echo "[remote-install] Cleaning old PM2 instances..."
pm2 delete fanni-backend 2>/dev/null || true
pm2 delete fanni-api 2>/dev/null || true

cd /var/www/fanni
sed -i 's/\r$//' scripts/deploy-vps.sh scripts/remote-install-from-zip.sh 2>/dev/null || true

export FANNI_APP_DIR=/var/www/fanni
export FANNI_SKIP_WEB=1

echo "[remote-install] Running main deployment script (deploy-vps.sh)..."
bash scripts/deploy-vps.sh

echo "--- health local ---"
curl -sS http://127.0.0.1:5000/api/healthz || curl -sS http://127.0.0.1:5000/healthz || echo "[remote-install] Health check pending or custom port used."
echo ""
pm2 ls
echo "[remote-install] Deployment finished successfully!"