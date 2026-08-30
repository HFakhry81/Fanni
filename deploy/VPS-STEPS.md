# تحديث كامل للـ VPS — v1.0.9 (29 أغسطس 2026)

يشمل: **كود API + migrate 024 + واجهة ويب + APK 1.0.9**.

| المكوّن | ماذا يتغيّر |
|--------|-------------|
| API / DB | `git pull` ثم `deploy-vps.sh` → install + **migrate (024)** + seed + PM2 reload + تصدير ويب على السيرفر |
| ويب | `https://app.upnexa-eg.com` من `/var/www/fanni-web` |
| APK | بناء EAS من ويندوز ثم رفع `fanni.apk` إلى `/var/www/fanni-web/fanni.apk` |

> الـ VPS **لا يبني** Android. الويب يمكن بناؤه على السيرفر داخل `deploy-vps.sh` أو رفعه جاهزًا من ويندوز.

---

## أ) على ويندوز — قبل/أثناء النشر

1. تأكد أن `main` محدّث (الإصدار `1.0.9` / `versionCode` 9).
2. بناء APK (إن لم يكن قيد التشغيل):

```powershell
cd C:\Fanni
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

3. بعد انتهاء EAS: نزّل الـ APK من صفحة البناء على expo.dev واحفظه كـ `fanni.apk`.
4. (اختياري) حزمة WinSCP تحتوي الكود + ويب جاهز:

```powershell
cd C:\Fanni
powershell -ExecutionPolicy Bypass -File scripts\pack-vps-upload.ps1
```

ينتج: `%USERPROFILE%\Downloads\fanni-vps-upload.zip`

---

## ب) على الـ VPS — مسار Git (المفضّل)

```bash
cd /var/www/fanni
git fetch origin
git checkout main
git pull --ff-only origin main

# مهم إن وُجدت نهايات سطر ويندوز:
sed -i 's/\r$//' scripts/deploy-vps.sh

export FANNI_APP_DIR=/var/www/fanni
# إن كان اسم PM2 مختلفًا: export FANNI_PM2_NAME=...
bash scripts/deploy-vps.sh
```

ما يفعله السكربت تلقائيًا:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @workspace/db run migrate` ← يطبّق **024** (`icon` للمجالات/التخصصات) إن لم تُطبَّق
3. `seed`
4. بناء API + إعادة تحميل PM2
5. `expo export --platform web` → مزامنة إلى `/var/www/fanni-web`

تحقق:

```bash
curl -sS http://127.0.0.1:5000/api/healthz
curl -sS https://api.upnexa-eg.com/api/healthz
# تأكد أن migrate وصلت (مثال):
# psql "$DATABASE_URL" -c "\d service_specializations" | grep icon
```

### migrate يدوي فقط (إن احتجت)

```bash
cd /var/www/fanni
set -a && . ./.env && set +a
pnpm --filter @workspace/db run migrate
```

محتوى **024**: توسيع `service_domains.icon` إلى `varchar(500)` وإضافة عمود `service_specializations.icon`.

---

## ج) رفع APK 1.0.9 على الـ VPS

بعد تنزيل APK من EAS (WinSCP → `/root/fanni.apk`):

```bash
install -d /var/www/fanni-web
cp /root/fanni.apk /var/www/fanni-web/fanni.apk
chmod 644 /var/www/fanni-web/fanni.apk
ls -la /var/www/fanni-web/fanni.apk
```

رابط التحميل: `https://app.upnexa-eg.com/fanni.apk`

على الهاتف: أزل النسخة القديمة إن لزم، ثبّت من الرابط، وتحقق أن الإصدار المعروض **1.0.9**.

---

## د) مسار WinSCP (احتياطي بدون git pull)

اتبع القسم «رفع الباك اند + الفرونت عبر WinSCP» أدناه بعد تشغيل `pack-vps-upload.ps1`، ثم نفّذ `deploy-vps.sh`، ثم ارفع الـ APK كما في (ج).

---

## صيانة سجلات PM2 (fanni-api)

| الملاحظة | التفسير | الإجراء |
|----------|---------|---------|
| `level:30` في `fanni-api-out.log` | معلومات عادية (Pino info) وليست خطأ 500 | طبيعي |
| طلبات `404` لـ `/`, `/robots.txt`, `/.env` | مسح آلي من الإنترنت أو متصفح | بعد التحديث: `/` يرد 200؛ المسارات الحساسة لا تُسجَّل في out |
| كائن PostgreSQL في `fanni-api-error.log` | غالباً `console.*` أو تسلسل `err` يتضمن `client` | أُزيل `console.log` من `/ping`؛ Sentry لا يلتقط `log/info` في الإنتاج؛ serializer آمن للأخطاء |
| تنظيف السجلات القديمة | `pm2 flush` يفرغ الملفات الحالية | `pm2 flush fanni-api` ثم `pm2 reload fanni-api` بعد نشر التحديث |

تحقق بعد النشر:

```bash
curl -sS https://api.upnexa-eg.com/ | head
curl -sS https://api.upnexa-eg.com/healthz
pm2 logs fanni-api --lines 30
```

---

# نشر الإنتاج عبر GitHub (المسار المعتمد)

المستودع: `https://github.com/HFakhry81/Fanni`.

1. على الـ VPS مرة واحدة: `sudo bash scripts/vps-bootstrap-from-github.sh` ثم أكمل `/var/www/fanni/.env` (انظر القيم أسفل) ثم `bash scripts/deploy-vps.sh`.
2. في GitHub → Settings → Secrets → Actions أضف:
   - `FANNI_VPS_HOST` = IP الأصل (ليس Cloudflare)
   - `FANNI_VPS_USER` = مستخدم SSH
   - `FANNI_VPS_SSH_KEY` = مفتاح خاص لمستخدم النشر (صلاحية محدودة)
   - اختياري: `FANNI_VPS_PORT`
3. الدفع إلى `main` أو Actions → **Deploy VPS** → Run workflow.
4. Nginx (أو Apache): `api.upnexa-eg.com` → `127.0.0.1:5000`، و`app.upnexa-eg.com` من `/var/www/fanni-web` مع SPA `try_files` — انظر [`deploy/nginx-app.upnexa-eg.com.conf`](nginx-app.upnexa-eg.com.conf) و[`deploy/WEB-APP-UPNEXA.md`](WEB-APP-UPNEXA.md).

لا تضع كلمات سر SSH أو `.env` في Git.

---

# رفع الباك اند + الفرونت عبر WinSCP (احتياطي)

المجلد `/var/www/storage/fanni` للصور فقط. **لا تضع فيه الكود.**
الكود: `/var/www/fanni`
الواجهة الويب: `/var/www/fanni-web`
Twilio وOPay ليسا جزءاً من هذا الرفع. لا ترفع `.env` المحلي ولا `backup.sql` ولا `node_modules`.

## أ) على ويندوز (مرة)

من مجلد المشروع:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\pack-vps-upload.ps1
```

ينتج: `C:\Users\Sam\Downloads\fanni-vps-upload.zip`

## ب) WinSCP

1. ارفع الزيب إلى `/root/fanni-vps-upload.zip` (ليس داخل `storage/fanni`).
2. Commands → Open Terminal:

```bash
mkdir -p /var/www/fanni /var/www/fanni-web /var/www/storage/fanni/{id,carnehat,avatars,documents,uploads}
KEEP_ENV=""
if [ -f /var/www/fanni/.env ]; then cp /var/www/fanni/.env /root/fanni.env.bak; KEEP_ENV=1; fi
rm -rf /tmp/fanni-unpack
mkdir /tmp/fanni-unpack
unzip -o /root/fanni-vps-upload.zip -d /tmp/fanni-unpack
rsync -a --delete --exclude '.env' /tmp/fanni-unpack/ /var/www/fanni/
if [ -n "$KEEP_ENV" ]; then cp /root/fanni.env.bak /var/www/fanni/.env; fi
if [ -d /var/www/fanni/artifacts/mobile/dist-web ]; then
  rsync -a --delete /var/www/fanni/artifacts/mobile/dist-web/ /var/www/fanni-web/
fi
```

3. أكمل `.env` على السيرفر إن كان جديداً (انظر القيم أسفل). لا تستبدل `DATABASE_URL` القديم.
4. إن وُجد باك اند قديم في مسار آخر: `pm2 ls` ثم أوقفه بعد نجاح المسار الجديد حتى لا يتعارض المنفذ 5000.

```bash
cd /var/www/fanni
sed -i 's/\r$//' scripts/deploy-vps.sh
export FANNI_APP_DIR=/var/www/fanni
# إن لزم: export FANNI_PM2_NAME=اسم_العملية_القديمة
bash scripts/deploy-vps.sh
```

5. Apache: أبقِ `api.upnexa-eg.com` بروكسي إلى `127.0.0.1:5000`. أضف موقع الواجهة من `deploy/apache-app.upnexa-eg.com.conf` على `app.upnexa-eg.com` ثم:

```bash
apachectl configtest && systemctl reload apache2
curl -sS http://127.0.0.1:5000/api/healthz
curl -sS https://api.upnexa-eg.com/api/healthz
```

## قيم `.env` الناقصة على السيرفر

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
```

لا تضف `TWILIO_*`. الموبايل الأصلي يستخدم `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com` بعد بناء الويب محلياً داخل سكربت الحزمة.

---

## بناء APK عبر EAS ورفعه على الـ VPS

الـ VPS **لا يبني** ملف Android. من ويندوز شغّل السكربت من جذر المشروع حتى لا يبقى المجلد `C:\Windows\system32`:

```powershell
cd C:\Fanni
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

أو يدوياً بعد التأكد أنك داخل مجلد فيه `app.json`:

```powershell
cd C:\Fanni\artifacts\mobile
dir app.json
npx --yes eas-cli@16 build -p android --profile preview
```

خطأ `Run this command inside a project directory` يعني أن `eas-cli` لم يرَ `app.json` في المجلد الحالي (غالباً الأمر اشتغل قبل `cd` أو عبر `npx` من مجلد النظام). لا تستخدم `C:\Windows\system32` كبداية بدون `cd`.


أو من جذر المشروع: `pnpm --filter @workspace/mobile run eas:apk`

البروفايل `preview` يضبط `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com` ويخرج **APK** (توزيع داخلي). بعد نجاح البناء نزّل الملف من صفحة Expo ثم ارفعه إلى مجلد الويب، مثلاً:

```bash
# على الـ VPS
install -d /var/www/fanni-web
# بعد نسخ fanni.apk من جهازك إلى السيرفر:
cp /root/fanni.apk /var/www/fanni-web/fanni.apk
```

رابط التحميل المتوقع: `https://app.upnexa-eg.com/fanni.apk` (Apache يخدم `/var/www/fanni-web`).

GitHub Action اختياري يحتاج secret `EXPO_TOKEN` — غير مُضاف هنا حتى تضع التوكن بنفسك.
