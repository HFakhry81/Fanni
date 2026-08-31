# ط¯ظ„ظٹظ„ ط§ظ„ظ†ط´ط± ط§ظ„ظƒط§ظ…ظ„ â€” Fanni v1.0.10

طھط­ط¯ظٹط« **ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ + ط§ظ„ط¨ط§ظƒ ط§ظ†ط¯ + ط§ظ„ظپط±ظˆظ†طھ (ظ…ظˆط¨ط§ظٹظ„) + Web App** â€” ظ…ط­ظ„ظٹط§ظ‹ ط¹ظ„ظ‰ ظˆظٹظ†ط¯ظˆط² ظˆط¹ظ„ظ‰ ط³ظٹط±ظپط± ط§ظ„ط¥ظ†طھط§ط¬.

| ط§ظ„ط¨ظٹط¦ط© | ظ…ط³ط§ط± ط§ظ„ظƒظˆط¯ | Web App | APK |
|--------|------------|---------|-----|
| **ظ…ط­ظ„ظٹ (ظˆظٹظ†ط¯ظˆط²)** | `E:\UpNexa.com\Fanni` | `E:\UpNexa.com\Fanni\artifacts\mobile\dist-web` | EAS ظ…ظ† ظˆظٹظ†ط¯ظˆط² ظپظ‚ط· |
| **ط¥ظ†طھط§ط¬ (VPS)** | `/var/www/fanni` | `/var/www/fanni-web` | **`/var/www/upnexa-eg.com/fanni.apk`** |

| URL | ط§ظ„ط®ط¯ظ…ط© |
|-----|--------|
| https://api.upnexa-eg.com | API (PM2 `fanni-api` :5000) |
| https://app.upnexa-eg.com | Web App (Expo export) |
| https://upnexa-eg.com/fanni.apk | طھط­ظ…ظٹظ„ APK |

> ط¯ظ„ظٹظ„ ظ…ظپطµظ‘ظ„ ط¨ظ†ظپط³ ط§ظ„طھط±ظ‚ظٹظ… (DB / API / Front / APK): [`deploy/UPDATE-REPORT.md`](UPDATE-REPORT.md).

ط§ظ„ط¥طµط¯ط§ط± ط§ظ„ط­ط§ظ„ظٹ: **`1.0.10`** / `versionCode` **10**. ط¢ط®ط± commit ظ…طھظˆظ‚ظ‘ط¹: `2247438` ط£ظˆ ط£ط­ط¯ط«.

> **migrate:** ط­طھظ‰ **024** (`icon` ظ„ظ„ظ…ط¬ط§ظ„ط§طھ/ط§ظ„طھط®طµطµط§طھ). ظ„ط§ ظ…ظ„ظپ migrate ط¬ط¯ظٹط¯ ط¨ط¹ط¯ظ‡ط§ ظپظٹ ظ‡ط°ط§ ط§ظ„ط¥طµط¯ط§ط±.

---

## ظ…ظ„ط®طµ ط³ط±ظٹط¹

| ط§ظ„ط®ط·ظˆط© | ط£ظٹظ† | ط§ظ„ط£ظ…ط± |
|--------|-----|-------|
| طھط­ط¯ظٹط« ظ…ط­ظ„ظٹ ظƒط§ظ…ظ„ | ظˆظٹظ†ط¯ظˆط² `E:\UpNexa.com\Fanni` | `pnpm run local:update` |
| طھطµط¯ظٹط± Web App ظ…ط­ظ„ظٹط§ظ‹ | ظˆظٹظ†ط¯ظˆط² | `pnpm run export:web` |
| ط¨ظ†ط§ط، APK | ظˆظٹظ†ط¯ظˆط² | `powershell -File scripts\eas-apk.ps1` |
| ظ†ط´ط± API + DB + Web | VPS | `git pull` + `bash scripts/deploy-vps.sh` |
| ط±ظپط¹ APK | WinSCP â†’ VPS | `cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk` |
| Web ظپظ‚ط· (ط¨ط¯ظˆظ† deploy ظƒط§ظ…ظ„) | ظˆظٹظ†ط¯ظˆط² â†’ VPS | `export-web.ps1 -Zip` ط«ظ… ط±ظپط¹ `dist-web.zip` |

---

# ط§ظ„ط¬ط²ط، 1 â€” طھط­ط¯ظٹط« ظ…ط­ظ„ظٹ (ظˆظٹظ†ط¯ظˆط² `E:\UpNexa.com\Fanni`)

## 1.1 ط§ظ„ظ…طھط·ظ„ط¨ط§طھ

- Node.js 20+طŒ pnpm 10 (`packageManager` ظپظٹ `package.json`)
- PostgreSQL ظ…ط­ظ„ظٹ + ظ‚ط§ط¹ط¯ط© `fanni_db`
- ظ…ظ„ظپ `.env` ظپظٹ ط¬ط°ط± ط§ظ„ظ…ط´ط±ظˆط¹ (ط§ظ†ط³ط® ظ…ظ† `.env.example`)

```powershell
cd E:\UpNexa.com\Fanni
copy .env.example .env
# ط¹ط¯ظ‘ظ„ DATABASE_URL ظˆ SESSION_SECRET ظپظٹ .env
```

## 1.2 ط³ط­ط¨ ط§ظ„ظƒظˆط¯

```powershell
cd E:\UpNexa.com\Fanni
git pull origin main
git log -1 --oneline
```

## 1.3 ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ (migrate)

```powershell
cd E:\UpNexa.com\Fanni
pnpm install
pnpm --filter @workspace/db run migrate
```

ط¨ط°ظˆط± ط§ظ„ط¨ظٹط§ظ†ط§طھ (ط§ط®طھظٹط§ط±ظٹ â€” ط¨ظٹط¦ط© طھط·ظˆظٹط± ظپظ‚ط·):

```powershell
pnpm --filter @workspace/db run seed
```

## 1.4 ط§ظ„ط¨ط§ظƒ ط§ظ†ط¯ (API)

**ط³ظƒط±ط¨طھ ظˆط§ط­ط¯ (migrate + typecheck + build):**

```powershell
cd E:\UpNexa.com\Fanni
pnpm run local:update
# ظ…ط¹ seed:
powershell -ExecutionPolicy Bypass -File scripts\local-update.ps1 -Seed
```

**طھط´ط؛ظٹظ„ API ظ„ظ„طھط·ظˆظٹط±:**

```powershell
cd E:\UpNexa.com\Fanni
pnpm run dev:api
```

طھط­ظ‚ظ‚:

```powershell
curl http://localhost:3000/api/healthz
```

> ظ…ط­ظ„ظٹط§ظ‹ ط§ظ„ظ…ظ†ظپط° **3000** (`PORT` ظپظٹ `.env`). ط¹ظ„ظ‰ VPS ط§ظ„ط¥ظ†طھط§ط¬ ط§ظ„ظ…ظ†ظپط° **5000**.

## 1.5 ط§ظ„ظپط±ظˆظ†طھ â€” طھط·ط¨ظٹظ‚ ظ…ظˆط¨ط§ظٹظ„ (طھط·ظˆظٹط±)

```powershell
cd E:\UpNexa.com\Fanni
$env:NODE_OPTIONS = "--use-system-ca"
pnpm run dev:mobile
```

- ظٹطھطµظ„ ط§ظپطھط±ط§ط¶ظٹط§ظ‹ ط¨ظ€ API ط­ط³ط¨ `EXPO_PUBLIC_API_URL` ظپظٹ `artifacts/mobile/.env` ط£ظˆ ط§ظ„ظ…طھط؛ظٹط±ط§طھ.
- ظ„ظ„ط§ط®طھط¨ط§ط± ط¶ط¯ ط¥ظ†طھط§ط¬: `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com`

## 1.6 Web App â€” طھطµط¯ظٹط± ظ…ط­ظ„ظٹ

```powershell
cd E:\UpNexa.com\Fanni
pnpm run export:web
```

ط£ظˆ ظ…ط¹ ط£ط±ط´ظٹظپ ظ„ظ„ط±ظپط¹:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
```

ط§ظ„ظ…ط®ط±ط¬ط§طھ:

- ظ…ط¬ظ„ط¯: `E:\UpNexa.com\Fanni\artifacts\mobile\dist-web\`
- zip (ط§ط®طھظٹط§ط±ظٹ): `E:\UpNexa.com\Fanni\artifacts\mobile\dist-web.zip`

ظ…ط¹ط§ظٹظ†ط© ظ…ط­ظ„ظٹط© (ط§ط®طھظٹط§ط±ظٹ):

```powershell
cd E:\UpNexa.com\Fanni\artifacts\mobile
pnpm run serve
```

## 1.7 ظپط­طµ ط§ظ„ط¬ظˆط¯ط© ظ‚ط¨ظ„ ط§ظ„ظ†ط´ط±

```powershell
cd E:\UpNexa.com\Fanni
pnpm run typecheck
pnpm run lint
pnpm run test
```

---

# ط§ظ„ط¬ط²ط، 2 â€” ط¨ظ†ط§ط، APK ظ„ظ„ط¥ظ†طھط§ط¬ (ظˆظٹظ†ط¯ظˆط²)

ط§ظ„ظ€ VPS **ظ„ط§ ظٹط¨ظ†ظٹ** Android. ط¯ط§ط¦ظ…ط§ظ‹ ط§ط¨ط¯ط£ ظ…ظ† `E:\UpNexa.com\Fanni`:

```powershell
cd E:\UpNexa.com\Fanni
git pull origin main
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

ط§ظ„ط³ظƒط±ط¨طھ ظٹظ†طھظ‚ظ„ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¥ظ„ظ‰ `artifacts\mobile` ظˆظٹط¨ظ†ظٹ ط¨ط±ظˆظپط§ظٹظ„ EAS `preview` (APK + `EXPO_PUBLIC_API_URL` ط¥ظ†طھط§ط¬ + Sentry DSN ظ…ط´ط±ظˆط¹ `fanni`).

ط¨ط¹ط¯ ط§ظ†طھظ‡ط§ط، EAS:

1. ظ†ط²ظ‘ظ„ ط§ظ„ظ€ APK ظ…ظ† [expo.dev](https://expo.dev)
2. ط§ط­ظپط¸ظ‡ ظ…ط­ظ„ظٹط§ظ‹ ظƒظ€ `fanni.apk`
3. ط§ط±ظپط¹ظ‡ ظ„ط§ط­ظ‚ط§ظ‹ ط¥ظ„ظ‰ VPS (ط§ظ„ط¬ط²ط، 3.4)

**ط¨ط¯ظٹظ„ ظٹط¯ظˆظٹ:**

```powershell
cd E:\UpNexa.com\Fanni\artifacts\mobile
$env:NODE_OPTIONS = "--use-system-ca"
pnpm run eas:apk
```

> ط®ط·ط£ `Run this command inside a project directory` = ط§ظ„ط£ظ…ط± ط´ظڈط؛ظ‘ظ„ ظ…ظ† `C:\Windows\system32` ط¨ط¯ظˆظ† `cd E:\UpNexa.com\Fanni` ط£ظˆظ„ط§ظ‹.

---

# ط§ظ„ط¬ط²ط، 3 â€” ظ†ط´ط± ط§ظ„ط¥ظ†طھط§ط¬ ط¹ظ„ظ‰ VPS

## 3.1 ظ…ط³ط§ط± Git (ط§ظ„ظ…ظپط¶ظ‘ظ„) â€” DB + API + Web

```bash
cd /var/www/fanni
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline

sed -i 's/\r$//' scripts/deploy-vps.sh
export FANNI_APP_DIR=/var/www/fanni
bash scripts/deploy-vps.sh
```

ظ…ط§ ظٹظپط¹ظ„ظ‡ `deploy-vps.sh` طھظ„ظ‚ط§ط¦ظٹط§ظ‹:

1. `pnpm install --frozen-lockfile`
2. **`pnpm --filter @workspace/db run migrate`** â†گ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ
3. `seed`
4. **ط¨ظ†ط§ط، API** + ط¥ط¹ط§ط¯ط© طھط­ظ…ظٹظ„ PM2 (`SENTRY_RELEASE=fanni-api@1.0.10`)
5. **`expo export --platform web`** â†’ ظ…ط²ط§ظ…ظ†ط© ط¥ظ„ظ‰ `/var/www/fanni-web`

طھط®ط·ظٹ طھطµط¯ظٹط± ط§ظ„ظˆظٹط¨ ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط± (ط¥ظ† ط±ظپط¹طھ `dist-web` ظ…ظ† ظˆظٹظ†ط¯ظˆط²):

```bash
FANNI_SKIP_WEB=1 bash scripts/deploy-vps.sh
```

### migrate ظٹط¯ظˆظٹ ظپظ‚ط·

```bash
cd /var/www/fanni
set -a && . ./.env && set +a
pnpm --filter @workspace/db run migrate
```

## 3.2 ط¶ط¨ط· Sentry ظپظٹ `.env` (ظ…ظڈظˆطµظ‰ ط¨ظ‡)

```bash
nano /var/www/fanni/.env
```

```env
SENTRY_DSN=https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=fanni-api@1.0.10
```

```bash
cd /var/www/fanni
export FANNI_APP_DIR=/var/www/fanni
pm2 reload fanni-api --update-env
pm2 save
```

## 3.3 ط±ظپط¹ Web App ظ…ظ† ظˆظٹظ†ط¯ظˆط² (ط¨ط¯ظٹظ„ / ط£ط³ط±ط¹)

ط¨ط¹ط¯ `pnpm run export:web` ط£ظˆ `export-web.ps1 -Zip` ط¹ظ„ظ‰ `E:\UpNexa.com\Fanni`:

1. WinSCP: ط§ط±ظپط¹ `artifacts\mobile\dist-web.zip` â†’ `/root/fanni-dist-web.zip`
2. ط¹ظ„ظ‰ VPS:

```bash
mkdir -p /var/www/fanni-web
rm -rf /tmp/fanni-web-unpack && mkdir /tmp/fanni-web-unpack
unzip -o /root/fanni-dist-web.zip -d /tmp/fanni-web-unpack
rsync -a --delete /tmp/fanni-web-unpack/ /var/www/fanni-web/
ls -la /var/www/fanni-web/index.html
# APK ظ…ظ†ظپطµظ„: /var/www/upnexa-eg.com/fanni.apk (ط§ظ†ط¸ط± 3.4)
```

طھظپط§طµظٹظ„ Nginx/SPA: [`deploy/WEB-APP-UPNEXA.md`](WEB-APP-UPNEXA.md).

## 3.4 ط±ظپط¹ APK 1.0.10

WinSCP: `fanni.apk` â†’ `/root/fanni.apk`

**ط§ظ„ظ…ط³ط§ط± ط§ظ„ط±ط³ظ…ظٹ ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط±:** `/var/www/upnexa-eg.com/fanni.apk`

```bash
install -d /var/www/upnexa-eg.com
cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
chmod 644 /var/www/upnexa-eg.com/fanni.apk
ls -lh /var/www/upnexa-eg.com/fanni.apk
```

ط±ط§ط¨ط· ط§ظ„طھط­ظ…ظٹظ„: https://upnexa-eg.com/fanni.apk

ط¹ظ„ظ‰ ط§ظ„ظ‡ط§طھظپ: ط£ط²ظ„ ط§ظ„ظ†ط³ط®ط© ط§ظ„ظ‚ط¯ظٹظ…ط© ط¥ظ† ظ„ط²ظ…طŒ ط«ط¨ظ‘طھطŒ ظˆطھط­ظ‚ظ‚ ظ…ظ† ط§ظ„ط¥طµط¯ط§ط± **1.0.10**.

## 3.5 طھط­ظ‚ظ‚ ط¨ط¹ط¯ ط§ظ„ظ†ط´ط±

```bash
curl -sS https://api.upnexa-eg.com/api/healthz
curl -sS https://api.upnexa-eg.com/ | head -5
curl -sS -o /dev/null -w "%{http_code}\n" https://app.upnexa-eg.com/
pm2 logs fanni-api --lines 30
```

### ط§ط®طھط¨ط§ط± Sentry

| ط§ظ„ظ‚ظ†ط§ط© | ط§ظ„ط·ط±ظٹظ‚ط© |
|--------|---------|
| ط³ظƒط±ط¨طھ VPS | `cd /var/www/fanni && pnpm --filter @workspace/api-server run sentry:test` |
| API (ظ…ط³ط¦ظˆظ„) | `curl -X POST https://api.upnexa-eg.com/api/admin/sentry-test -H "Authorization: Bearer TOKEN"` |
| ط§ظ„طھط·ط¨ظٹظ‚ | ظ„ظˆط­ط© ط§ظ„ط£ط¯ظ…ظ† â†’ **ظ…ط±ط§ظ‚ط¨ط© Sentry** â†’ Front / Back |

ظ„ظˆط­ط©: https://upnexa-hb.sentry.io â€” ظ…ط´ط§ط±ظٹط¹ `node` ظˆ `fanni`. طھظپط§طµظٹظ„: [`deploy/SENTRY-MCP.md`](SENTRY-MCP.md).

### طھظ†ط¸ظٹظپ ط³ط¬ظ„ط§طھ PM2 (ط§ط®طھظٹط§ط±ظٹ)

```bash
pm2 flush fanni-api
pm2 reload fanni-api
```

---

# ط§ظ„ط¬ط²ط، 4 â€” ظ…ط³ط§ط± WinSCP (ط¨ط¯ظˆظ† git pull)

ط¹ظ„ظ‰ ظˆظٹظ†ط¯ظˆط²:

```powershell
cd E:\UpNexa.com\Fanni
powershell -ExecutionPolicy Bypass -File scripts\pack-vps-upload.ps1
```

ظٹظ†طھط¬: `%USERPROFILE%\Downloads\fanni-vps-upload.zip` (ظƒظˆط¯ + web export ظ…ط¯ظ…ط¬).

ط¹ظ„ظ‰ VPS:

```bash
mkdir -p /var/www/fanni /var/www/fanni-web /var/www/storage/fanni/{id,carnehat,avatars,documents,uploads}
KEEP_ENV=""
if [ -f /var/www/fanni/.env ]; then cp /var/www/fanni/.env /root/fanni.env.bak; KEEP_ENV=1; fi
rm -rf /tmp/fanni-unpack && mkdir /tmp/fanni-unpack
unzip -o /root/fanni-vps-upload.zip -d /tmp/fanni-unpack
rsync -a --delete --exclude '.env' /tmp/fanni-unpack/ /var/www/fanni/
if [ -n "$KEEP_ENV" ]; then cp /root/fanni.env.bak /var/www/fanni/.env; fi
if [ -d /var/www/fanni/artifacts/mobile/dist-web ]; then
  rsync -a --delete /var/www/fanni/artifacts/mobile/dist-web/ /var/www/fanni-web/
fi

cd /var/www/fanni
sed -i 's/\r$//' scripts/deploy-vps.sh
export FANNI_APP_DIR=/var/www/fanni
bash scripts/deploy-vps.sh
```

ط«ظ… ط§ط±ظپط¹ APK ظƒظ…ط§ ظپظٹ 3.4.

> `/var/www/storage/fanni` ظ„ظ„طµظˆط± ظپظ‚ط· â€” **ظ„ط§ طھط¶ط¹ ظپظٹظ‡ ط§ظ„ظƒظˆط¯**. ظ„ط§ طھط±ظپط¹ `.env` ط§ظ„ظ…ط­ظ„ظٹ ظˆظ„ط§ `node_modules`.

---

# ط§ظ„ط¬ط²ط، 5 â€” ظ†ط´ط± ط¹ط¨ط± GitHub Actions

ط§ظ„ظ…ط³طھظˆط¯ط¹: https://github.com/HFakhry81/Fanni

1. ظ…ط±ط© ظˆط§ط­ط¯ط© ط¹ظ„ظ‰ VPS: `sudo bash scripts/vps-bootstrap-from-github.sh` ط«ظ… ط£ظƒظ…ظ„ `.env`
2. Secrets: `FANNI_VPS_HOST`, `FANNI_VPS_USER`, `FANNI_VPS_SSH_KEY`
3. ط¯ظپط¹ ط¥ظ„ظ‰ `main` ط£ظˆ طھط´ط؛ظٹظ„ workflow **Deploy VPS**

---

# ظ‚ظٹظ… `.env` ط§ظ„ط¥ظ†طھط§ط¬ ط¹ظ„ظ‰ VPS

```
PORT=5000
NODE_ENV=production
PUBLIC_API_URL=https://api.upnexa-eg.com
CORS_ORIGINS=https://api.upnexa-eg.com,https://app.upnexa-eg.com
STORAGE_DRIVER=local
PRIVATE_OBJECT_DIR=/var/www/storage/fanni
PRIVATE_OBJECT_DIR_ID=/var/www/storage/fanni/id
PRIVATE_OBJECT_DIR_CARNEHAT=/var/www/storage/fanni/carnehat
DISPUTE_AUTO_DAILY_CAP=2
PAYMENT_PROVIDER=manual
SENTRY_DSN=https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=fanni-api@1.0.10
DATABASE_URL=...
SESSION_SECRET=...
```

ظ„ط§ طھط¶ظپ `TWILIO_*` ط­طھظ‰ طھطھظˆظپط± ط¨ظٹط§ظ†ط§طھ Console. ظ„ط§ طھط±ظپط¹ `.env` ط¥ظ„ظ‰ Git.

---

# طµظٹط§ظ†ط© ط³ط¬ظ„ط§طھ PM2

| ط§ظ„ظ…ظ„ط§ط­ط¸ط© | ط§ظ„ط¥ط¬ط±ط§ط، |
|----------|---------|
| `level:30` ظپظٹ out | ظ…ط¹ظ„ظˆظ…ط§طھ Pino ط¹ط§ط¯ظٹط© â€” ط·ط¨ظٹط¹ظٹ |
| `404` ظ„ظ€ `/robots.txt` | ظ…ط³ط­ ط¢ظ„ظٹ â€” ط·ط¨ظٹط¹ظٹ |
| طھظ†ط¸ظٹظپ | `pm2 flush fanni-api` ط«ظ… `pm2 reload fanni-api` |

---

# ط³ظƒط±ط¨طھط§طھ ظ…ط³ط§ط¹ط¯ط© (ظ…ظ† `E:\UpNexa.com\Fanni`)

| ط§ظ„ط³ظƒط±ط¨طھ | ط§ظ„ط؛ط±ط¶ |
|---------|--------|
| `scripts\local-update.ps1` | migrate + typecheck + build API |
| `scripts\export-web.ps1` | طھطµط¯ظٹط± `dist-web` (+ `-Zip`) |
| `scripts\eas-apk.ps1` | ط¨ظ†ط§ط، APK ط¹ط¨ط± EAS |
| `scripts\pack-vps-upload.ps1` | ط­ط²ظ…ط© WinSCP (ظƒظˆط¯ + web) |
| `scripts\deploy-vps.sh` | ظ†ط´ط± ظƒط§ظ…ظ„ ط¹ظ„ظ‰ Ubuntu VPS |

ط£ظˆط§ظ…ط± pnpm ظ…ظ† ط§ظ„ط¬ط°ط±:

```powershell
cd E:\UpNexa.com\Fanni
pnpm run local:update
pnpm run export:web
pnpm run dev:api
pnpm run dev:mobile
pnpm run migrate
```

