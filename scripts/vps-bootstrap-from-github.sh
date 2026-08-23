#!/usr/bin/env bash
# One-time: turn /var/www/fanni into a git checkout of GitHub (run on the Ubuntu origin).
# Does not overwrite an existing .env. Does not print secrets.
#
#   sudo bash scripts/vps-bootstrap-from-github.sh
#
set -euo pipefail

APP_DIR="${FANNI_APP_DIR:-/var/www/fanni}"
REPO_URL="${FANNI_GIT_URL:-https://github.com/HFakhry81/Fanni.git}"
WEB_DIR="${FANNI_WEB_DIR:-/var/www/fanni-web}"
STORAGE_ROOT="${PRIVATE_OBJECT_DIR:-/var/www/storage/fanni}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo)."
  exit 1
fi

mkdir -p "$APP_DIR" "$WEB_DIR" "$STORAGE_ROOT"/{id,carnehat,avatars,documents,uploads}

if [ -d "$APP_DIR/.git" ]; then
  echo "[bootstrap] git already present in $APP_DIR"
  cd "$APP_DIR"
  git remote -v
  git fetch origin
  git checkout main
  git pull --ff-only origin main
else
  if [ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
    BACKUP="/root/fanni-pre-git-$(date +%Y%m%d%H%M%S)"
    echo "[bootstrap] moving existing files to $BACKUP"
    mkdir -p "$BACKUP"
    if [ -f "$APP_DIR/.env" ]; then
      cp "$APP_DIR/.env" /root/fanni.env.bak
    fi
    rsync -a "$APP_DIR"/ "$BACKUP"/
    find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
  fi
  git clone --branch main "$REPO_URL" "$APP_DIR"
  if [ -f /root/fanni.env.bak ] && [ ! -f "$APP_DIR/.env" ]; then
    cp /root/fanni.env.bak "$APP_DIR/.env"
  fi
fi

chown -R www-data:www-data "$STORAGE_ROOT" || true
chmod 750 "$STORAGE_ROOT" "$STORAGE_ROOT"/id "$STORAGE_ROOT"/carnehat || true

echo "[bootstrap] next: edit $APP_DIR/.env then: cd $APP_DIR && bash scripts/deploy-vps.sh"
echo "[bootstrap] GitHub Actions needs secrets FANNI_VPS_HOST (origin IP), FANNI_VPS_USER, FANNI_VPS_SSH_KEY"
