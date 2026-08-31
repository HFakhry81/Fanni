# طھظ‚ط±ظٹط± طھط­ط¯ظٹط« Fanni â€” ظ…ط­ظ„ظٹ (`E:\UpNexa.com\Fanni`) ظˆط¥ظ†طھط§ط¬ (VPS)

**ط§ظ„ط¥طµط¯ط§ط±:** 1.0.10 / `versionCode` 10  
**ط§ظ„طھط§ط±ظٹط®:** 30 ط£ط؛ط³ط·ط³ 2026  
**ط¨ط¹ط¯ ط¥طµظ„ط§ط­ط§طھ:** ط³ظƒط±ط¨طھ `local-update.ps1`طŒ طھط´ط؛ظٹظ„ API ط¹ط¨ط± `scripts/dev.mjs` (ط¨ط¯ظˆظ† `cross-env`)طŒ ظˆط¥ط¹ط§ط¯ط© طھط«ط¨ظٹطھ `node_modules`

---

## ط®ط±ظٹط·ط© ط§ظ„ظ…ط³ط§ط±ط§طھ

| ط§ظ„ظ…ظƒظˆظ‘ظ† | ظ…ط­ظ„ظٹ (ظˆظٹظ†ط¯ظˆط²) | ط¥ظ†طھط§ط¬ (VPS) | ط±ط§ط¨ط· ط¹ط§ظ… |
|---------|---------------|-------------|----------|
| ظƒظˆط¯ ط§ظ„ظ…ط´ط±ظˆط¹ | `E:\UpNexa.com\Fanni` | `/var/www/fanni` | â€” |
| ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ | PostgreSQL ظ…ط­ظ„ظٹ (`DATABASE_URL` ظپظٹ `.env`) | PostgreSQL ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط± (`DATABASE_URL` ظپظٹ `/var/www/fanni/.env`) | â€” |
| ط§ظ„ط¨ط§ظƒ ط§ظ†ط¯ (API) | `http://localhost:3000` | PM2 `fanni-api` ط¹ظ„ظ‰ `:5000` | https://api.upnexa-eg.com |
| ط§ظ„ظپط±ظˆظ†طھ â€” Web App | `E:\UpNexa.com\Fanni\artifacts\mobile\dist-web` | `/var/www/fanni-web` | https://app.upnexa-eg.com |
| ط§ظ„ظپط±ظˆظ†طھ â€” ظ…ظˆط¨ط§ظٹظ„ | Expo dev / APK | APK ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط± | طھط«ط¨ظٹطھ ظ…ظ† ط§ظ„ط±ط§ط¨ط· ط£ط¯ظ†ط§ظ‡ |
| ظ…ظ„ظپ APK | ظ†ط²ظ‘ظ„ ظ…ظ† EAS â†’ ط§ط­ظپط¸ `fanni.apk` | **`/var/www/upnexa-eg.com/fanni.apk`** | https://upnexa-eg.com/fanni.apk |
| طµظˆط±/ظ…ظ„ظپط§طھ | ظ…ط­ظ„ظٹ ط­ط³ط¨ `.env` | `/var/www/storage/fanni` | â€” |

> **ظ…ظ‡ظ…:** ظ…ط³ط§ط± ط§ظ„ظ€ APK ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط± ظ‡ظˆ ظ…ظˆظ‚ط¹ ط§ظ„ظ…ظˆظ‚ط¹ ط§ظ„طھط³ظˆظٹظ‚ظٹ:  
> `/var/www/upnexa-eg.com/fanni.apk`  
> ظˆظ„ظٹط³ `/var/www/fanni-web/`.

> **migrate ط§ظ„ط­ط§ظ„ظٹ:** ط­طھظ‰ ط§ظ„ظ…ظ„ظپ **024**. ظ„ط§ migrate ط¬ط¯ظٹط¯ ط¨ط¹ط¯ظ‡ط§ ظپظٹ ظ‡ط°ط§ ط§ظ„ط¥طµط¯ط§ط±.

---

## 1. طھط­ط¯ظٹط« ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ

Migrations ظ…ظˆط¬ظˆط¯ط© ظپظٹ `lib/db/migrations/` ظˆطھظڈط·ط¨ظ‘ظژظ‚ ط¹ط¨ط±:

```text
pnpm --filter @workspace/db run migrate
```

### 1.1 طھط­ط¯ظٹط« ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ ظ…ط­ظ„ظٹط§ظ‹

**ط§ظ„ظ…طھط·ظ„ط¨ط§طھ**

1. PostgreSQL ظٹط¹ظ…ظ„ ظ…ط­ظ„ظٹط§ظ‹.
2. ظ‚ط§ط¹ط¯ط© ظ…ط«ظ„ `fanni_db` ظ…ظˆط¬ظˆط¯ط©.
3. ظ…ظ„ظپ `E:\UpNexa.com\Fanni\.env` ظپظٹظ‡ `DATABASE_URL` طµط­ظٹط­.

**ط§ظ„ط£ظˆط§ظ…ط± (cmd â€” ط£ظ…ط± ظˆط§ط­ط¯ ط«ظ… Enter)**

```cmd
cd /d E:\UpNexa.com\Fanni
git pull origin main
pnpm install
pnpm --filter @workspace/db run migrate
```

**ط£ظˆ ط³ظƒط±ط¨طھ ط§ظ„طھط­ط¯ظٹط« ط§ظ„ظ…ط­ظ„ظٹ ط§ظ„ظƒط§ظ…ظ„** (install + migrate + typecheck + build API):

```cmd
cd /d E:\UpNexa.com\Fanni
pnpm run local:update
```

**ط¨ط°ظˆط± ط¨ظٹط§ظ†ط§طھ طھط·ظˆظٹط± (ط§ط®طھظٹط§ط±ظٹ ظپظ‚ط· â€” ظ„ط§ طھط³طھط®ط¯ظ…ظ‡ ط¹ظ„ظ‰ ط§ظ„ط¥ظ†طھط§ط¬ ط¥ظ„ط§ ط¨ظˆط¹ظٹ)**

```cmd
pnpm --filter @workspace/db run seed
```

**طھط­ظ‚ظ‚**

- ط§ظ„ط£ظ…ط± ظٹظ†طھظ‡ظٹ ط¨ط¯ظˆظ† ط®ط·ط£.
- ط¥ظ† ظپط´ظ„ ط§ظ„ط§طھطµط§ظ„: ط±ط§ط¬ط¹ `DATABASE_URL` ظپظٹ `.env`.

---

### 1.2 طھط­ط¯ظٹط« ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ ظپظٹ ط¨ظٹط¦ط© ط§ظ„ط¥ظ†طھط§ط¬

ط¹ظ„ظ‰ VPSطŒ ط§ظ„ظ€ migrate ط¬ط²ط، ظ…ظ† `deploy-vps.sh`. ظٹظڈظپط¶ظ‘ظژظ„ ط§ظ„ظ…ط³ط§ط± ط§ظ„ظƒط§ظ…ظ„ (ظ‚ط³ظ… 2.2).

**ظ…ط³ط§ط± Git ظپظ‚ط· ظ„ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ**

```bash
cd /var/www/fanni
git pull --ff-only origin main
set -a && . ./.env && set +a
pnpm --filter @workspace/db run migrate
```

**ط£ظˆ ط¶ظ…ظ† ط§ظ„ظ†ط´ط± ط§ظ„ظƒط§ظ…ظ„**

```bash
cd /var/www/fanni
git pull --ff-only origin main
sed -i 's/\r$//' scripts/deploy-vps.sh
export FANNI_APP_DIR=/var/www/fanni
bash scripts/deploy-vps.sh
```

ط§ظ„ط³ظƒط±ط¨طھ ظٹط´ط؛ظ‘ظ„ طھظ„ظ‚ط§ط¦ظٹط§ظ‹: `pnpm install` â†’ **migrate** â†’ seed â†’ build API â†’ PM2 â†’ طھطµط¯ظٹط± ط§ظ„ظˆظٹط¨.

**طھط­ط°ظٹط±**

- ظ„ط§ طھط³طھط¨ط¯ظ„ `DATABASE_URL` ط¹ظ„ظ‰ ط§ظ„ط¥ظ†طھط§ط¬ ط¨ظ‚ظٹظ…ط© ظ…ط­ظ„ظٹط©.
- ظ„ط§ طھط´ط؛ظ‘ظ„ `seed` ط¹ظ„ظ‰ ط¨ظٹط§ظ†ط§طھ ط­ظٹط© ط¥ظ„ط§ ط¥ط°ط§ ظƒظ†طھ طھط¹ط±ظپ ط£ظ†ظ‡ ط¢ظ…ظ†.

---

## 2. طھط­ط¯ظٹط« ط§ظ„ط¨ط§ظƒ ط§ظ†ط¯

ط§ظ„ظƒظˆط¯: `artifacts/api-server`  
ط¹ظ…ظ„ظٹط© ط§ظ„ط¥ظ†طھط§ط¬: PM2 ط§ط³ظ…ظ‡ط§ ط¹ط§ط¯ط© `fanni-api`.

### 2.1 طھط­ط¯ظٹط« ط§ظ„ط¨ط§ظƒ ط§ظ†ط¯ ظ…ط­ظ„ظٹط§ظ‹

```cmd
cd /d E:\UpNexa.com\Fanni
git pull origin main
pnpm install
pnpm run local:update
```

**طھط´ط؛ظٹظ„ API ظ„ظ„طھط·ظˆظٹط±**

```cmd
cd /d E:\UpNexa.com\Fanni
pnpm run dev:api
```

ط§طھط±ظƒ ط§ظ„ظ†ط§ظپط°ط© ظ…ظپطھظˆط­ط©. ظ…ظ† ظ†ط§ظپط°ط© ط«ط§ظ†ظٹط©:

```cmd
curl http://localhost:3000/api/healthz
```

ط§ظ„ظ…طھظˆظ‚ط¹: JSON ظپظٹظ‡ `"status":"ok"` ط£ظˆ ظ…ط§ ظٹط¹ط§ط¯ظ„ظ‡.

> ط§ظ„ظ…ظ†ظپط° ط§ظ„ظ…ط­ظ„ظٹ **3000**. ظ…ظ†ظپط° ط§ظ„ط¥ظ†طھط§ط¬ **5000**.

**ط¥ظ† ط¸ظ‡ط± ط®ط·ط£ ط­ط²ظ… (ظ…ط«ظ„ `cross-env` ظ†ط§ظ‚طµ)**

```cmd
cd /d E:\UpNexa.com\Fanni
pnpm install --force
pnpm run dev:api
```

ط³ظƒط±ط¨طھ ط§ظ„طھط´ط؛ظٹظ„ ط§ظ„ظ…ط­ظ„ظٹ: `artifacts/api-server/scripts/dev.mjs` (ظٹط¶ط¨ط· `NODE_ENV=development` ط«ظ… build + start).

---

### 2.2 طھط­ط¯ظٹط« ط§ظ„ط¨ط§ظƒ ط§ظ†ط¯ ظپظٹ ط¨ظٹط¦ط© ط§ظ„ط¥ظ†طھط§ط¬

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

**Sentry (ظ…ظڈظˆطµظ‰ ط¨ظ‡ ظپظٹ `.env`)**

```bash
nano /var/www/fanni/.env
```

```env
SENTRY_DSN=https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=fanni-api@1.0.10
```

```bash
pm2 reload fanni-api --update-env
pm2 save
```

**طھط­ظ‚ظ‚**

```bash
curl -sS http://127.0.0.1:5000/api/healthz
curl -sS https://api.upnexa-eg.com/api/healthz
pm2 logs fanni-api --lines 30
```

**ط§ط®طھط¨ط§ط± Sentry ظ„ظ„ط¨ط§ظƒ**

```bash
cd /var/www/fanni
pnpm --filter @workspace/api-server run sentry:test
```

ط£ظˆ ظ…ظ† ظ„ظˆط­ط© ط§ظ„ط£ط¯ظ…ظ† ط¨ط¹ط¯ طھط­ط¯ظٹط« ط§ظ„طھط·ط¨ظٹظ‚: **ظ…ط±ط§ظ‚ط¨ط© Sentry â†’ ط§ط®طھط¨ط§ط± ط®ط·ط£ ط§ظ„ط®ط§ط¯ظ… (Back)**.

---

## 3. طھط­ط¯ظٹط« ط§ظ„ظپط±ظˆظ†طھ ط§ظ†ط¯

ظٹط´ظ…ظ„:

1. **Web App** â€” `app.upnexa-eg.com`
2. **طھط·ط¨ظٹظ‚ ط§ظ„ظ…ظˆط¨ط§ظٹظ„** â€” طھط·ظˆظٹط± ط¹ط¨ط± ExpoطŒ ظˆط¥ظ†طھط§ط¬ ط¹ط¨ط± APK (ط§ظ„ظ‚ط³ظ… 4)

### 3.1 طھط­ط¯ظٹط« ط§ظ„ظپط±ظˆظ†طھ ط§ظ†ط¯ ظ…ط­ظ„ظٹط§ظ‹

#### ط£) Web App â€” طھطµط¯ظٹط±

```cmd
cd /d E:\UpNexa.com\Fanni
git pull origin main
pnpm install
pnpm run export:web
```

ط§ظ„ظ…ط®ط±ط¬ط§طھ: `E:\UpNexa.com\Fanni\artifacts\mobile\dist-web\`

ظ…ط¹ ط£ط±ط´ظٹظپ ظ„ظ„ط±ظپط¹:

```powershell
cd E:\UpNexa.com\Fanni
powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
```

ظٹظ†طھط¬ ط£ظٹط¶ط§ظ‹: `artifacts\mobile\dist-web.zip`

#### ط¨) ظ…ظˆط¨ط§ظٹظ„ â€” ظˆط¶ط¹ ط§ظ„طھط·ظˆظٹط±

```cmd
cd /d E:\UpNexa.com\Fanni
set NODE_OPTIONS=--use-system-ca
pnpm run dev:mobile
```

ظ„ظ„ط§ط®طھط¨ط§ط± ط¶ط¯ API ط§ظ„ط¥ظ†طھط§ط¬:

```cmd
set EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com
pnpm run dev:mobile
```

---

### 3.2 طھط­ط¯ظٹط« ط§ظ„ظپط±ظˆظ†طھ ط§ظ†ط¯ ظپظٹ ط¨ظٹط¦ط© ط§ظ„ط¥ظ†طھط§ط¬

#### ط£) Web App ط¹ط¨ط± `deploy-vps.sh` (ظ…ط¹ ط§ظ„ط¨ط§ظƒ)

ط¹ظ†ط¯ طھط´ط؛ظٹظ„ `bash scripts/deploy-vps.sh` ظٹظڈطµط¯ظ‘ظژط± ط§ظ„ظˆظٹط¨ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¥ظ„ظ‰ `/var/www/fanni-web`.

طھط®ط·ظٹ طھطµط¯ظٹط± ط§ظ„ظˆظٹط¨ ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط± (ط¥ظ† ط±ظپط¹طھ `dist-web` ظ…ظ† ظˆظٹظ†ط¯ظˆط²):

```bash
FANNI_SKIP_WEB=1 bash scripts/deploy-vps.sh
```

#### ط¨) Web App ظپظ‚ط· ظ…ظ† ظˆظٹظ†ط¯ظˆط²

1. ط¹ظ„ظ‰ ظˆظٹظ†ط¯ظˆط²: `pnpm run export:web` ط£ظˆ `export-web.ps1 -Zip`
2. WinSCP: ط§ط±ظپط¹ `dist-web.zip` â†’ `/root/fanni-dist-web.zip`
3. ط¹ظ„ظ‰ VPS:

```bash
mkdir -p /var/www/fanni-web
rm -rf /tmp/fanni-web-unpack && mkdir /tmp/fanni-web-unpack
unzip -o /root/fanni-dist-web.zip -d /tmp/fanni-web-unpack
rsync -a --delete /tmp/fanni-web-unpack/ /var/www/fanni-web/
ls -la /var/www/fanni-web/index.html
```

**طھط­ظ‚ظ‚**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://app.upnexa-eg.com/
```

ط§ظپطھط­ ط§ظ„ظ…طھطµظپط­: https://app.upnexa-eg.com/ â€” ظٹط¬ط¨ ط´ط§ط´ط© ط§ظ„ط¯ط®ظˆظ„ ظˆظ„ظٹط³ آ«No routes foundآ».

#### ط¬) ظ…ظˆط¨ط§ظٹظ„ ط¥ظ†طھط§ط¬

ط§ظ„ظپط±ظˆظ†طھ ط§ظ„ط£طµظ„ظٹ ظ„ظ„ظ…ظˆط¨ط§ظٹظ„ = **APK** (ط§ظ„ظ‚ط³ظ… 4). ط¨ط¹ط¯ ط§ظ„ط±ظپط¹ ط«ط¨ظ‘طھ ظ…ظ† ط§ظ„ط±ط§ط¨ط· ظˆطھط­ظ‚ظ‚ ظ…ظ† ط§ظ„ط¥طµط¯ط§ط± **1.0.10**.

---

## 4. ط¥ظ†طھط§ط¬ ظ†ط³ط®ط© APK

ط§ظ„ظ€ VPS **ظ„ط§ ظٹط¨ظ†ظٹ** Android. ط§ظ„ط¨ظ†ط§ط، ط¯ط§ط¦ظ…ط§ظ‹ ظ…ظ† ظˆظٹظ†ط¯ظˆط² ط¹ط¨ط± EAS.

### 4.1 ط§ظ„ط¨ظ†ط§ط، ط¹ظ„ظ‰ ظˆظٹظ†ط¯ظˆط²

```powershell
cd E:\UpNexa.com\Fanni
git pull origin main
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

ط§ظ„ط³ظƒط±ط¨طھ ظٹط¯ط®ظ„ `artifacts\mobile` ظˆظٹط¨ظ†ظٹ ط¨ط±ظˆظپط§ظٹظ„ `preview` ظ…ط¹:

- `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com`
- Sentry ظ…ط´ط±ظˆط¹ `fanni` (org `upnexa-hb`)

ط¨ط¹ط¯ ط§ظ†طھظ‡ط§ط، ط§ظ„ط¨ظ†ط§ط، ط¹ظ„ظ‰ [expo.dev](https://expo.dev):

1. ظ†ط²ظ‘ظ„ ظ…ظ„ظپ ط§ظ„ظ€ APK
2. ط§ط­ظپط¸ظ‡ ظ…ط­ظ„ظٹط§ظ‹ ط¨ط§ط³ظ… **`fanni.apk`**

### 4.2 ط±ظپط¹ APK ط¥ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط±

**ط§ظ„ظ…ط³ط§ط± ط§ظ„ط±ط³ظ…ظٹ ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط±:**

```text
/var/www/upnexa-eg.com/fanni.apk
```

**ط§ظ„ط®ط·ظˆط§طھ**

1. WinSCP: ط§ط±ظپط¹ `fanni.apk` ط¥ظ„ظ‰ `/root/fanni.apk`
2. ط¹ظ„ظ‰ VPS:

```bash
install -d /var/www/upnexa-eg.com
cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
chmod 644 /var/www/upnexa-eg.com/fanni.apk
ls -lh /var/www/upnexa-eg.com/fanni.apk
```

**ط±ط§ط¨ط· ط§ظ„طھط­ظ…ظٹظ„ ط§ظ„ظ…طھظˆظ‚ط¹:** https://upnexa-eg.com/fanni.apk

ط¹ظ„ظ‰ ط§ظ„ظ‡ط§طھظپ: ط£ط²ظ„ ط§ظ„ظ†ط³ط®ط© ط§ظ„ظ‚ط¯ظٹظ…ط© ط¥ظ† ظ„ط²ظ… â†’ ط«ط¨ظ‘طھ ظ…ظ† ط§ظ„ط±ط§ط¨ط· â†’ طھط£ظƒط¯ ط£ظ† ط§ظ„ط¥طµط¯ط§ط± **1.0.10**.

### 4.3 ط§ط®طھط¨ط§ط± Sentry ظ…ظ† ط§ظ„طھط·ط¨ظٹظ‚

ظ„ظˆط­ط© ط§ظ„ط£ط¯ظ…ظ† â†’ **ظ…ط±ط§ظ‚ط¨ط© Sentry**:

| ط§ظ„ط²ط± | ط§ظ„ظ…ط´ط±ظˆط¹ ظپظٹ Sentry |
|------|-------------------|
| ط§ط®طھط¨ط§ط± ط®ط·ط£ ط§ظ„طھط·ط¨ظٹظ‚ (Front) | `fanni` |
| ط§ط®طھط¨ط§ط± ط®ط·ط£ ط§ظ„ط®ط§ط¯ظ… (Back) | `node` (ظٹط­طھط§ط¬ API ظ…ط­ط¯ظ‘ط«) |

ظ„ظˆط­ط©: https://upnexa-hb.sentry.io

---

## طھط±طھظٹط¨ ظ…ظ‚طھط±ط­ ظ„ط¬ظ„ط³ط© ظ†ط´ط± ظƒط§ظ…ظ„ط©

| ط§ظ„طھط±طھظٹط¨ | ط£ظٹظ† | ظ…ط§ط°ط§ |
|---------|-----|------|
| 1 | ظˆظٹظ†ط¯ظˆط² | `git pull` + `pnpm run local:update` |
| 2 | ظˆظٹظ†ط¯ظˆط² | `pnpm run export:web` (ط§ط®طھظٹط§ط±ظٹ ط¥ظ† ط¨ظڈظ†ظٹ ط§ظ„ظˆظٹط¨ ط¹ظ„ظ‰ VPS) |
| 3 | ظˆظٹظ†ط¯ظˆط² | `scripts\eas-apk.ps1` â†’ ظ†ط²ظ‘ظ„ `fanni.apk` |
| 4 | VPS | `git pull` + `bash scripts/deploy-vps.sh` (DB + API + Web) |
| 5 | VPS | `cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk` |
| 6 | طھط­ظ‚ظ‚ | healthz + app.upnexa-eg.com + طھط«ط¨ظٹطھ APK |

---

## ط£ظˆط§ظ…ط± ط³ط±ظٹط¹ط© â€” ظ†ط³ط® ظˆظ„طµظ‚

### ظ…ط­ظ„ظٹ (`E:\UpNexa.com\Fanni`)

```cmd
cd /d E:\UpNexa.com\Fanni
git pull origin main
pnpm run local:update
pnpm run export:web
```

```powershell
cd E:\UpNexa.com\Fanni
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

### ط¥ظ†طھط§ط¬ (VPS)

```bash
cd /var/www/fanni
git pull --ff-only origin main
sed -i 's/\r$//' scripts/deploy-vps.sh
export FANNI_APP_DIR=/var/www/fanni
bash scripts/deploy-vps.sh

install -d /var/www/upnexa-eg.com
cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
chmod 644 /var/www/upnexa-eg.com/fanni.apk

curl -sS https://api.upnexa-eg.com/api/healthz
curl -sS -o /dev/null -w "%{http_code}\n" https://app.upnexa-eg.com/
ls -lh /var/www/upnexa-eg.com/fanni.apk
```

---

## ط³ظƒط±ط¨طھط§طھ ظ…ط³ط§ط¹ط¯ط©

| ط§ظ„ط³ظƒط±ط¨طھ | ط§ظ„ط؛ط±ط¶ |
|---------|--------|
| `scripts\local-update.ps1` | migrate + typecheck + build API ظ…ط­ظ„ظٹط§ظ‹ |
| `scripts\export-web.ps1` | طھطµط¯ظٹط± Web App (+ `-Zip`) |
| `scripts\eas-apk.ps1` | ط¨ظ†ط§ط، APK ط¹ط¨ط± EAS |
| `scripts\deploy-vps.sh` | ظ†ط´ط± ظƒط§ظ…ظ„ ط¹ظ„ظ‰ Ubuntu |
| `artifacts\api-server\scripts\dev.mjs` | طھط´ط؛ظٹظ„ API ظ…ط­ظ„ظٹط§ظ‹ ط¨ط¯ظˆظ† `cross-env` |

ط£ظˆط§ظ…ط± pnpm ظ…ظ† ط§ظ„ط¬ط°ط±:

```text
pnpm run local:update
pnpm run export:web
pnpm run dev:api
pnpm run dev:mobile
pnpm run migrate
```

---

## ظ…ظ„ط§ط­ط¸ط§طھ ط¨ط¹ط¯ ط¥طµظ„ط§ط­ط§طھ 30 ط£ط؛ط³ط·ط³

1. ظ„ط§ طھظ„طµظ‚ ط¹ط¯ط© ط£ظˆط§ظ…ط± ظ…ط¹ طھط¹ظ„ظٹظ‚ط§طھ `#` ظپظٹ ط³ط·ط± ظˆط§ط­ط¯ ط¯ط§ط®ظ„ **cmd**.
2. ط¥ظ† ظپط´ظ„ `local:update.ps1`: طھط£ظƒط¯ ط£ظ† ط§ظ„ظ…ظ„ظپ ظ…ط­ط¯ظ‘ط« (`git pull`) â€” ط£ظڈط²ظٹظ„ ط­ط±ظپ `â€”` ط§ظ„ط°ظٹ ظƒط§ظ† ظٹظƒط³ط± PowerShell.
3. ط¥ظ† ظپط´ظ„ `dev:api` ط¨ط®ط·ط£ `cross-env`: ط´ط؛ظ‘ظ„ `pnpm install --force` ط«ظ… ط£ط¹ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط© (ط§ظ„ط³ظƒط±ط¨طھ ظ„ظ… ظٹط¹ط¯ ظٹط¹طھظ…ط¯ ط¹ظ„ظ‰ `cross-env`).
4. ظ…ط³ط§ط± APK ط§ظ„ط¥ظ†طھط§ط¬ظٹ ط§ظ„طµط­ظٹط­: **`/var/www/upnexa-eg.com/fanni.apk`**.

