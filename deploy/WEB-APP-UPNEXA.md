# ظ†ط´ط± ظˆط§ط¬ظ‡ط© ط§ظ„ظˆظٹط¨ â€” https://app.upnexa-eg.com/

> **ط§ظ„ط¯ظ„ظٹظ„ ط§ظ„ظƒط§ظ…ظ„:** [`deploy/VPS-STEPS.md`](VPS-STEPS.md) â€” ظٹط´ظ…ظ„ ط§ظ„طھط­ط¯ظٹط« ط§ظ„ظ…ط­ظ„ظٹ (`E:\UpNexa.com\Fanni`) ظˆط§ظ„ظ†ط´ط± ط¹ظ„ظ‰ VPS.

## ط§ظ„طھط´ط®ظٹطµ ط§ظ„ط´ط§ط¦ط¹

ط§ظ„طµظپط­ط© طھظپطھط­ ظ„ظƒظ†ظ‡ط§ طھط¸ظ‡ط± **No routes found** ظ„ط£ظ† ظ†ط³ط®ط© `/var/www/fanni-web` ظ‚ط¯ظٹظ…ط©/ظ†ط§ظ‚طµط©:

| | ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط± (ظ‚ط¯ظٹظ…) | ط¨ظ†ط§ط، ظ…ط­ظ„ظٹ ط¬ط¯ظٹط¯ |
|---|---|---|
| JS entry | ~1.0 MB (`entry-ba9274â€¦`) | **~3.8 MB** (`entry-d1e629â€¦`) |
| ط§ظ„ط³ط¨ط¨ | export ط¨ظ„ط§ ظ…ط³ط§ط±ط§طھ Expo Router ظƒط§ظ…ظ„ط© | `EXPO_ROUTER_APP_ROOT=./app` + export ط³ظ„ظٹظ… |

ط§ظ„ط±ظˆط§ط¨ط· ط§ظ„طھط³ظˆظٹظ‚ظٹط© طµط­ظٹط­ط©ط› ط§ظ„ظ…ط·ظ„ظˆط¨ **ط§ط³طھط¨ط¯ط§ظ„ ظ…ط­طھظˆظ‰ `/var/www/fanni-web`** + **Nginx SPA fallback**.

---

## 1) ط§ظ„ط¨ظ†ط§ط، ط§ظ„ظ…ط­ظ„ظٹ (`E:\UpNexa.com\Fanni`)

```powershell
cd E:\UpNexa.com\Fanni
pnpm run export:web
```

ط£ظˆ ظ…ط¹ zip ظ„ظ„ط±ظپط¹:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
```

ظٹط¯ظˆظٹط§ظ‹ (ظ†ظپط³ ظ…ط§ ظٹظپط¹ظ„ظ‡ ط§ظ„ط³ظƒط±ط¨طھ):

```powershell
cd E:\UpNexa.com\Fanni\artifacts\mobile
$env:NODE_OPTIONS = "--use-system-ca"
$env:EXPO_PUBLIC_API_URL = "https://api.upnexa-eg.com"
$env:EXPO_ROUTER_APP_ROOT = "./app"
pnpm exec expo export --platform web --output-dir dist-web
```

ط§ظ„ظ…ط®ط±ط¬ط§طھ:
- ظ…ط¬ظ„ط¯: `artifacts/mobile/dist-web/`
- ط£ط±ط´ظٹظپ ظ„ظ„ط±ظپط¹: `artifacts/mobile/dist-web.zip`

---

## 2) ط±ظپط¹ WinSCP â†’ ط§ظ„ط³ظٹط±ظپط±

1. ط§ط±ظپط¹ `artifacts/mobile/dist-web.zip` ط¥ظ„ظ‰ `/root/fanni-dist-web.zip`
2. ظ…ظ† Terminal ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط±:

```bash
mkdir -p /var/www/fanni-web
rm -rf /tmp/fanni-web-unpack
mkdir -p /tmp/fanni-web-unpack
unzip -o /root/fanni-dist-web.zip -d /tmp/fanni-web-unpack
# Zip may contain dist-web/ subfolder — publish script resolves it automatically:
bash /var/www/fanni/scripts/publish-fanni-web.sh /tmp/fanni-web-unpack
# APK ظ…ظ†ظپطµظ„ ط¹ظ„ظ‰ /var/www/upnexa-eg.com/fanni.apk â€” ظ„ط§ ظٹظڈظ…ط³ ظ‡ظ†ط§
```

طھط­ظ‚ظ‚:

```bash
ls -la /var/www/fanni-web/index.html
ls -la /var/www/fanni-web/_expo/static/js/web/
# ظٹط¬ط¨ ط£ظ† طھط±ظ‰ entry-d1e629â€¦ ط¨ط­ط¬ظ… ~3.8MB ظˆظ„ظٹط³ ba9274â€¦
```

---

## 3) Nginx (ط¨ط¯ظ„ Apache ط£ظˆ ظ…ط¹ظ‡)

ظ…ظ„ظپ ط¬ط§ظ‡ط² ظپظٹ ط§ظ„ظ…ط³طھظˆط¯ط¹: [`deploy/nginx-app.upnexa-eg.com.conf`](nginx-app.upnexa-eg.com.conf)

```bash
sudo cp /var/www/fanni/deploy/nginx-app.upnexa-eg.com.conf /etc/nginx/sites-available/app.upnexa-eg.com
# ط¹ط¯ظ‘ظ„ ظ…ط³ط§ط±ط§طھ SSL ط¥ظ† ظ„ط²ظ…طŒ ط«ظ…:
sudo ln -sf /etc/nginx/sites-available/app.upnexa-eg.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

ط§ظ„ط£ظ‡ظ… ظپظٹ `location /`:

```nginx
try_files $uri $uri/ /index.html;
```

ط¨ط¯ظˆظ†ظ‡ط§ ط£ظٹ ظ…ط³ط§ط± ط¹ظ…ظٹظ‚ ظٹظپط´ظ„طŒ ظˆظ…ط¹ export ظ†ط§ظ‚طµ طھط¸ظ‡ط± **No routes found**.

API ظٹط¨ظ‚ظ‰ ظ…ظ†ظپطµظ„ظ‹ط§:

```nginx
# api.upnexa-eg.com â†’ proxy_pass http://127.0.0.1:5000;
```

---

## 4) طھط­ظ‚ظ‚ ط¨ط¹ط¯ ط§ظ„ط±ظپط¹

1. ط§ظپطھط­ https://app.upnexa-eg.com/ â€” ظٹط¬ط¨ ط´ط§ط´ط© ط§ظ„طھط±ط­ظٹط¨/ط§ظ„ط¯ط®ظˆظ„ ظˆظ„ظٹط³ آ«No routes foundآ»
2. https://app.upnexa-eg.com/welcome
3. https://upnexa-eg.com/fanni.apk (APK ط¹ظ„ظ‰ `/var/www/upnexa-eg.com/fanni.apk`)
4. DevTools â†’ Network: ظ…ظ„ظپ `entry-d1e629â€¦js` ط¨ط­ط¬ظ… ~3.8MB

---

## ظ…ظ„ط§ط­ط¸ط© ط¹ظ† ظ…ظˆظ‚ط¹ UpNexa ط§ظ„طھط³ظˆظٹظ‚ظٹ

طµظپط­ط© ط§ظ„طھط³ظˆظٹظ‚ (upnexa-eg.com) ظ…ظ†ظپطµظ„ط© ط¹ظ† طھط·ط¨ظٹظ‚ ط§ظ„ظˆظٹط¨. ط·ط§ظ„ظ…ط§ ط§ظ„ط±ظˆط§ط¨ط· طھط´ظٹط± ط¥ظ„ظ‰:

- ط§ظ„طھط·ط¨ظٹظ‚: `https://app.upnexa-eg.com/`
- APK: `https://upnexa-eg.com/fanni.apk` (ظ…ظ„ظپ: `/var/www/upnexa-eg.com/fanni.apk`)
- API: `https://api.upnexa-eg.com`

ظپظ„ط§ ط­ط§ط¬ط© ظ„طھط¹ط¯ظٹظ„ ط§ظ„طھط³ظˆظٹظ‚ ط¨ط¹ط¯ ط§ط³طھط¨ط¯ط§ظ„ `/var/www/fanni-web`.

