# تقرير تحديث Fanni — محلي (`C:\Fanni`) وإنتاج (VPS)

**الإصدار:** 1.0.10 / `versionCode` 10  
**التاريخ:** 30 أغسطس 2026  
**بعد إصلاحات:** سكربت `local-update.ps1`، تشغيل API عبر `scripts/dev.mjs` (بدون `cross-env`)، وإعادة تثبيت `node_modules`

---

## خريطة المسارات

| المكوّن | محلي (ويندوز) | إنتاج (VPS) | رابط عام |
|---------|---------------|-------------|----------|
| كود المشروع | `C:\Fanni` | `/var/www/fanni` | — |
| قاعدة البيانات | PostgreSQL محلي (`DATABASE_URL` في `.env`) | PostgreSQL على السيرفر (`DATABASE_URL` في `/var/www/fanni/.env`) | — |
| الباك اند (API) | `http://localhost:3000` | PM2 `fanni-api` على `:5000` | https://api.upnexa-eg.com |
| الفرونت — Web App | `C:\Fanni\artifacts\mobile\dist-web` | `/var/www/fanni-web` | https://app.upnexa-eg.com |
| الفرونت — موبايل | Expo dev / APK | APK على السيرفر | تثبيت من الرابط أدناه |
| ملف APK | نزّل من EAS → احفظ `fanni.apk` | **`/var/www/upnexa-eg.com/fanni.apk`** | https://upnexa-eg.com/fanni.apk |
| صور/ملفات | محلي حسب `.env` | `/var/www/storage/fanni` | — |

> **مهم:** مسار الـ APK على السيرفر هو موقع الموقع التسويقي:  
> `/var/www/upnexa-eg.com/fanni.apk`  
> وليس `/var/www/fanni-web/`.

> **migrate الحالي:** حتى الملف **024**. لا migrate جديد بعدها في هذا الإصدار.

---

## 1. تحديث قاعدة البيانات

Migrations موجودة في `lib/db/migrations/` وتُطبَّق عبر:

```text
pnpm --filter @workspace/db run migrate
```

### 1.1 تحديث قاعدة البيانات محلياً

**المتطلبات**

1. PostgreSQL يعمل محلياً.
2. قاعدة مثل `fanni_db` موجودة.
3. ملف `C:\Fanni\.env` فيه `DATABASE_URL` صحيح.

**الأوامر (cmd — أمر واحد ثم Enter)**

```cmd
cd /d C:\Fanni
git pull origin main
pnpm install
pnpm --filter @workspace/db run migrate
```

**أو سكربت التحديث المحلي الكامل** (install + migrate + typecheck + build API):

```cmd
cd /d C:\Fanni
pnpm run local:update
```

**بذور بيانات تطوير (اختياري فقط — لا تستخدمه على الإنتاج إلا بوعي)**

```cmd
pnpm --filter @workspace/db run seed
```

**تحقق**

- الأمر ينتهي بدون خطأ.
- إن فشل الاتصال: راجع `DATABASE_URL` في `.env`.

---

### 1.2 تحديث قاعدة البيانات في بيئة الإنتاج

على VPS، الـ migrate جزء من `deploy-vps.sh`. يُفضَّل المسار الكامل (قسم 2.2).

**مسار Git فقط لقاعدة البيانات**

```bash
cd /var/www/fanni
git pull --ff-only origin main
set -a && . ./.env && set +a
pnpm --filter @workspace/db run migrate
```

**أو ضمن النشر الكامل**

```bash
cd /var/www/fanni
git pull --ff-only origin main
sed -i 's/\r$//' scripts/deploy-vps.sh
export FANNI_APP_DIR=/var/www/fanni
bash scripts/deploy-vps.sh
```

السكربت يشغّل تلقائياً: `pnpm install` → **migrate** → seed → build API → PM2 → تصدير الويب.

**تحذير**

- لا تستبدل `DATABASE_URL` على الإنتاج بقيمة محلية.
- لا تشغّل `seed` على بيانات حية إلا إذا كنت تعرف أنه آمن.

---

## 2. تحديث الباك اند

الكود: `artifacts/api-server`  
عملية الإنتاج: PM2 اسمها عادة `fanni-api`.

### 2.1 تحديث الباك اند محلياً

```cmd
cd /d C:\Fanni
git pull origin main
pnpm install
pnpm run local:update
```

**تشغيل API للتطوير**

```cmd
cd /d C:\Fanni
pnpm run dev:api
```

اترك النافذة مفتوحة. من نافذة ثانية:

```cmd
curl http://localhost:3000/api/healthz
```

المتوقع: JSON فيه `"status":"ok"` أو ما يعادله.

> المنفذ المحلي **3000**. منفذ الإنتاج **5000**.

**إن ظهر خطأ حزم (مثل `cross-env` ناقص)**

```cmd
cd /d C:\Fanni
pnpm install --force
pnpm run dev:api
```

سكربت التشغيل المحلي: `artifacts/api-server/scripts/dev.mjs` (يضبط `NODE_ENV=development` ثم build + start).

---

### 2.2 تحديث الباك اند في بيئة الإنتاج

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

**Sentry (مُوصى به في `.env`)**

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

**تحقق**

```bash
curl -sS http://127.0.0.1:5000/api/healthz
curl -sS https://api.upnexa-eg.com/api/healthz
pm2 logs fanni-api --lines 30
```

**اختبار Sentry للباك**

```bash
cd /var/www/fanni
pnpm --filter @workspace/api-server run sentry:test
```

أو من لوحة الأدمن بعد تحديث التطبيق: **مراقبة Sentry → اختبار خطأ الخادم (Back)**.

---

## 3. تحديث الفرونت اند

يشمل:

1. **Web App** — `app.upnexa-eg.com`
2. **تطبيق الموبايل** — تطوير عبر Expo، وإنتاج عبر APK (القسم 4)

### 3.1 تحديث الفرونت اند محلياً

#### أ) Web App — تصدير

```cmd
cd /d C:\Fanni
git pull origin main
pnpm install
pnpm run export:web
```

المخرجات: `C:\Fanni\artifacts\mobile\dist-web\`

مع أرشيف للرفع:

```powershell
cd C:\Fanni
powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
```

ينتج أيضاً: `artifacts\mobile\dist-web.zip`

#### ب) موبايل — وضع التطوير

```cmd
cd /d C:\Fanni
set NODE_OPTIONS=--use-system-ca
pnpm run dev:mobile
```

للاختبار ضد API الإنتاج:

```cmd
set EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com
pnpm run dev:mobile
```

---

### 3.2 تحديث الفرونت اند في بيئة الإنتاج

#### أ) Web App عبر `deploy-vps.sh` (مع الباك)

عند تشغيل `bash scripts/deploy-vps.sh` يُصدَّر الويب تلقائياً إلى `/var/www/fanni-web`.

تخطي تصدير الويب على السيرفر (إن رفعت `dist-web` من ويندوز):

```bash
FANNI_SKIP_WEB=1 bash scripts/deploy-vps.sh
```

#### ب) Web App فقط من ويندوز

1. على ويندوز: `pnpm run export:web` أو `export-web.ps1 -Zip`
2. WinSCP: ارفع `dist-web.zip` → `/root/fanni-dist-web.zip`
3. على VPS:

```bash
mkdir -p /var/www/fanni-web
rm -rf /tmp/fanni-web-unpack && mkdir /tmp/fanni-web-unpack
unzip -o /root/fanni-dist-web.zip -d /tmp/fanni-web-unpack
rsync -a --delete /tmp/fanni-web-unpack/ /var/www/fanni-web/
ls -la /var/www/fanni-web/index.html
```

**تحقق**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://app.upnexa-eg.com/
```

افتح المتصفح: https://app.upnexa-eg.com/ — يجب شاشة الدخول وليس «No routes found».

#### ج) موبايل إنتاج

الفرونت الأصلي للموبايل = **APK** (القسم 4). بعد الرفع ثبّت من الرابط وتحقق من الإصدار **1.0.10**.

---

## 4. إنتاج نسخة APK

الـ VPS **لا يبني** Android. البناء دائماً من ويندوز عبر EAS.

### 4.1 البناء على ويندوز

```powershell
cd C:\Fanni
git pull origin main
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

السكربت يدخل `artifacts\mobile` ويبني بروفايل `preview` مع:

- `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com`
- Sentry مشروع `fanni` (org `upnexa-hb`)

بعد انتهاء البناء على [expo.dev](https://expo.dev):

1. نزّل ملف الـ APK
2. احفظه محلياً باسم **`fanni.apk`**

### 4.2 رفع APK إلى السيرفر

**المسار الرسمي على السيرفر:**

```text
/var/www/upnexa-eg.com/fanni.apk
```

**الخطوات**

1. WinSCP: ارفع `fanni.apk` إلى `/root/fanni.apk`
2. على VPS:

```bash
install -d /var/www/upnexa-eg.com
cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
chmod 644 /var/www/upnexa-eg.com/fanni.apk
ls -lh /var/www/upnexa-eg.com/fanni.apk
```

**رابط التحميل المتوقع:** https://upnexa-eg.com/fanni.apk

على الهاتف: أزل النسخة القديمة إن لزم → ثبّت من الرابط → تأكد أن الإصدار **1.0.10**.

### 4.3 اختبار Sentry من التطبيق

لوحة الأدمن → **مراقبة Sentry**:

| الزر | المشروع في Sentry |
|------|-------------------|
| اختبار خطأ التطبيق (Front) | `fanni` |
| اختبار خطأ الخادم (Back) | `node` (يحتاج API محدّث) |

لوحة: https://upnexa-hb.sentry.io

---

## ترتيب مقترح لجلسة نشر كاملة

| الترتيب | أين | ماذا |
|---------|-----|------|
| 1 | ويندوز | `git pull` + `pnpm run local:update` |
| 2 | ويندوز | `pnpm run export:web` (اختياري إن بُني الويب على VPS) |
| 3 | ويندوز | `scripts\eas-apk.ps1` → نزّل `fanni.apk` |
| 4 | VPS | `git pull` + `bash scripts/deploy-vps.sh` (DB + API + Web) |
| 5 | VPS | `cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk` |
| 6 | تحقق | healthz + app.upnexa-eg.com + تثبيت APK |

---

## أوامر سريعة — نسخ ولصق

### محلي (`C:\Fanni`)

```cmd
cd /d C:\Fanni
git pull origin main
pnpm run local:update
pnpm run export:web
```

```powershell
cd C:\Fanni
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

### إنتاج (VPS)

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

## سكربتات مساعدة

| السكربت | الغرض |
|---------|--------|
| `scripts\local-update.ps1` | migrate + typecheck + build API محلياً |
| `scripts\export-web.ps1` | تصدير Web App (+ `-Zip`) |
| `scripts\eas-apk.ps1` | بناء APK عبر EAS |
| `scripts\deploy-vps.sh` | نشر كامل على Ubuntu |
| `artifacts\api-server\scripts\dev.mjs` | تشغيل API محلياً بدون `cross-env` |

أوامر pnpm من الجذر:

```text
pnpm run local:update
pnpm run export:web
pnpm run dev:api
pnpm run dev:mobile
pnpm run migrate
```

---

## ملاحظات بعد إصلاحات 30 أغسطس

1. لا تلصق عدة أوامر مع تعليقات `#` في سطر واحد داخل **cmd**.
2. إن فشل `local:update.ps1`: تأكد أن الملف محدّث (`git pull`) — أُزيل حرف `—` الذي كان يكسر PowerShell.
3. إن فشل `dev:api` بخطأ `cross-env`: شغّل `pnpm install --force` ثم أعد المحاولة (السكربت لم يعد يعتمد على `cross-env`).
4. مسار APK الإنتاجي الصحيح: **`/var/www/upnexa-eg.com/fanni.apk`**.
