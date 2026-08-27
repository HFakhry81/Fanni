# نشر واجهة الويب — https://app.upnexa-eg.com/

## التشخيص (27 أغسطس 2026)

الصفحة تفتح لكنها تظهر **No routes found** لأن نسخة `/var/www/fanni-web` قديمة/ناقصة:

| | على السيرفر (قديم) | بناء محلي جديد |
|---|---|---|
| JS entry | ~1.0 MB (`entry-ba9274…`) | **~3.8 MB** (`entry-d1e629…`) |
| السبب | export بلا مسارات Expo Router كاملة | `EXPO_ROUTER_APP_ROOT=./app` + export سليم |

الروابط التسويقية صحيحة؛ المطلوب **استبدال محتوى `/var/www/fanni-web`** + **Nginx SPA fallback**.

---

## 1) البناء المحلي (تم في المستودع)

```powershell
cd C:\Fanni\artifacts\mobile
$env:NODE_OPTIONS="--use-system-ca"
$env:EXPO_PUBLIC_API_URL="https://api.upnexa-eg.com"
$env:EXPO_ROUTER_APP_ROOT="./app"
pnpm exec expo export --platform web --output-dir dist-web
```

المخرجات:
- مجلد: `artifacts/mobile/dist-web/`
- أرشيف للرفع: `artifacts/mobile/dist-web.zip`

---

## 2) رفع WinSCP → السيرفر

1. ارفع `artifacts/mobile/dist-web.zip` إلى `/root/fanni-dist-web.zip`
2. من Terminal على السيرفر:

```bash
mkdir -p /var/www/fanni-web
rm -rf /tmp/fanni-web-unpack
mkdir -p /tmp/fanni-web-unpack
unzip -o /root/fanni-dist-web.zip -d /tmp/fanni-web-unpack
# احتفظ بـ APK إن وُجد
if [ -f /var/www/fanni-web/fanni.apk ]; then cp /var/www/fanni-web/fanni.apk /root/fanni.apk.bak; fi
rsync -a --delete /tmp/fanni-web-unpack/ /var/www/fanni-web/
if [ -f /root/fanni.apk.bak ]; then cp /root/fanni.apk.bak /var/www/fanni-web/fanni.apk; chmod 644 /var/www/fanni-web/fanni.apk; fi
chown -R www-data:www-data /var/www/fanni-web
```

تحقق:

```bash
ls -la /var/www/fanni-web/index.html
ls -la /var/www/fanni-web/_expo/static/js/web/
# يجب أن ترى entry-d1e629… بحجم ~3.8MB وليس ba9274…
```

---

## 3) Nginx (بدل Apache أو معه)

ملف جاهز في المستودع: [`deploy/nginx-app.upnexa-eg.com.conf`](nginx-app.upnexa-eg.com.conf)

```bash
sudo cp /var/www/fanni/deploy/nginx-app.upnexa-eg.com.conf /etc/nginx/sites-available/app.upnexa-eg.com
# عدّل مسارات SSL إن لزم، ثم:
sudo ln -sf /etc/nginx/sites-available/app.upnexa-eg.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

الأهم في `location /`:

```nginx
try_files $uri $uri/ /index.html;
```

بدونها أي مسار عميق يفشل، ومع export ناقص تظهر **No routes found**.

API يبقى منفصلًا:

```nginx
# api.upnexa-eg.com → proxy_pass http://127.0.0.1:5000;
```

---

## 4) تحقق بعد الرفع

1. افتح https://app.upnexa-eg.com/ — يجب شاشة الترحيب/الدخول وليس «No routes found»
2. https://app.upnexa-eg.com/welcome
3. https://app.upnexa-eg.com/fanni.apk (إن رُفع APK)
4. DevTools → Network: ملف `entry-d1e629…js` بحجم ~3.8MB

---

## ملاحظة عن موقع UpNexa التسويقي

صفحة التسويق (upnexa-eg.com) منفصلة عن تطبيق الويب. طالما الروابط تشير إلى:

- التطبيق: `https://app.upnexa-eg.com/`
- APK: `https://app.upnexa-eg.com/fanni.apk`
- API: `https://api.upnexa-eg.com`

فلا حاجة لتعديل التسويق بعد استبدال `/var/www/fanni-web`.
