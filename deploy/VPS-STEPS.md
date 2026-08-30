# دليل النشر الكامل — Fanni v1.0.10

تحديث **قاعدة البيانات + الباك اند + الفرونت (موبايل) + Web App** — محلياً على ويندوز وعلى سيرفر الإنتاج.

| البيئة | مسار الكود | Web App | APK |
|--------|------------|---------|-----|
| **محلي (ويندوز)** | `C:\Fanni` | `C:\Fanni\artifacts\mobile\dist-web` | EAS من ويندوز فقط |
| **إنتاج (VPS)** | `/var/www/fanni` | `/var/www/fanni-web` | **`/var/www/upnexa-eg.com/fanni.apk`** |

| URL | الخدمة |
|-----|--------|
| https://api.upnexa-eg.com | API (PM2 `fanni-api` :5000) |
| https://app.upnexa-eg.com | Web App (Expo export) |
| https://upnexa-eg.com/fanni.apk | تحميل APK |

> دليل مفصّل بنفس الترقيم (DB / API / Front / APK): [`deploy/UPDATE-REPORT.md`](UPDATE-REPORT.md).

الإصدار الحالي: **`1.0.10`** / `versionCode` **10**. آخر commit متوقّع: `2247438` أو أحدث.

> **migrate:** حتى **024** (`icon` للمجالات/التخصصات). لا ملف migrate جديد بعدها في هذا الإصدار.

---

## ملخص سريع

| الخطوة | أين | الأمر |
|--------|-----|-------|
| تحديث محلي كامل | ويندوز `C:\Fanni` | `pnpm run local:update` |
| تصدير Web App محلياً | ويندوز | `pnpm run export:web` |
| بناء APK | ويندوز | `powershell -File scripts\eas-apk.ps1` |
| نشر API + DB + Web | VPS | `git pull` + `bash scripts/deploy-vps.sh` |
| رفع APK | WinSCP → VPS | `cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk` |
| Web فقط (بدون deploy كامل) | ويندوز → VPS | `export-web.ps1 -Zip` ثم رفع `dist-web.zip` |

---

# الجزء 1 — تحديث محلي (ويندوز `C:\Fanni`)

## 1.1 المتطلبات

- Node.js 20+، pnpm 10 (`packageManager` في `package.json`)
- PostgreSQL محلي + قاعدة `fanni_db`
- ملف `.env` في جذر المشروع (انسخ من `.env.example`)

```powershell
cd C:\Fanni
copy .env.example .env
# عدّل DATABASE_URL و SESSION_SECRET في .env
```

## 1.2 سحب الكود

```powershell
cd C:\Fanni
git pull origin main
git log -1 --oneline
```

## 1.3 قاعدة البيانات (migrate)

```powershell
cd C:\Fanni
pnpm install
pnpm --filter @workspace/db run migrate
```

بذور البيانات (اختياري — بيئة تطوير فقط):

```powershell
pnpm --filter @workspace/db run seed
```

## 1.4 الباك اند (API)

**سكربت واحد (migrate + typecheck + build):**

```powershell
cd C:\Fanni
pnpm run local:update
# مع seed:
powershell -ExecutionPolicy Bypass -File scripts\local-update.ps1 -Seed
```

**تشغيل API للتطوير:**

```powershell
cd C:\Fanni
pnpm run dev:api
```

تحقق:

```powershell
curl http://localhost:3000/api/healthz
```

> محلياً المنفذ **3000** (`PORT` في `.env`). على VPS الإنتاج المنفذ **5000**.

## 1.5 الفرونت — تطبيق موبايل (تطوير)

```powershell
cd C:\Fanni
$env:NODE_OPTIONS = "--use-system-ca"
pnpm run dev:mobile
```

- يتصل افتراضياً بـ API حسب `EXPO_PUBLIC_API_URL` في `artifacts/mobile/.env` أو المتغيرات.
- للاختبار ضد إنتاج: `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com`

## 1.6 Web App — تصدير محلي

```powershell
cd C:\Fanni
pnpm run export:web
```

أو مع أرشيف للرفع:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
```

المخرجات:

- مجلد: `C:\Fanni\artifacts\mobile\dist-web\`
- zip (اختياري): `C:\Fanni\artifacts\mobile\dist-web.zip`

معاينة محلية (اختياري):

```powershell
cd C:\Fanni\artifacts\mobile
pnpm run serve
```

## 1.7 فحص الجودة قبل النشر

```powershell
cd C:\Fanni
pnpm run typecheck
pnpm run lint
pnpm run test
```

---

# الجزء 2 — بناء APK للإنتاج (ويندوز)

الـ VPS **لا يبني** Android. دائماً ابدأ من `C:\Fanni`:

```powershell
cd C:\Fanni
git pull origin main
powershell -ExecutionPolicy Bypass -File scripts\eas-apk.ps1
```

السكربت ينتقل تلقائياً إلى `artifacts\mobile` ويبني بروفايل EAS `preview` (APK + `EXPO_PUBLIC_API_URL` إنتاج + Sentry DSN مشروع `fanni`).

بعد انتهاء EAS:

1. نزّل الـ APK من [expo.dev](https://expo.dev)
2. احفظه محلياً كـ `fanni.apk`
3. ارفعه لاحقاً إلى VPS (الجزء 3.4)

**بديل يدوي:**

```powershell
cd C:\Fanni\artifacts\mobile
$env:NODE_OPTIONS = "--use-system-ca"
pnpm run eas:apk
```

> خطأ `Run this command inside a project directory` = الأمر شُغّل من `C:\Windows\system32` بدون `cd C:\Fanni` أولاً.

---

# الجزء 3 — نشر الإنتاج على VPS

## 3.1 مسار Git (المفضّل) — DB + API + Web

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

ما يفعله `deploy-vps.sh` تلقائياً:

1. `pnpm install --frozen-lockfile`
2. **`pnpm --filter @workspace/db run migrate`** ← قاعدة البيانات
3. `seed`
4. **بناء API** + إعادة تحميل PM2 (`SENTRY_RELEASE=fanni-api@1.0.10`)
5. **`expo export --platform web`** → مزامنة إلى `/var/www/fanni-web`

تخطي تصدير الويب على السيرفر (إن رفعت `dist-web` من ويندوز):

```bash
FANNI_SKIP_WEB=1 bash scripts/deploy-vps.sh
```

### migrate يدوي فقط

```bash
cd /var/www/fanni
set -a && . ./.env && set +a
pnpm --filter @workspace/db run migrate
```

## 3.2 ضبط Sentry في `.env` (مُوصى به)

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

## 3.3 رفع Web App من ويندوز (بديل / أسرع)

بعد `pnpm run export:web` أو `export-web.ps1 -Zip` على `C:\Fanni`:

1. WinSCP: ارفع `artifacts\mobile\dist-web.zip` → `/root/fanni-dist-web.zip`
2. على VPS:

```bash
mkdir -p /var/www/fanni-web
rm -rf /tmp/fanni-web-unpack && mkdir /tmp/fanni-web-unpack
unzip -o /root/fanni-dist-web.zip -d /tmp/fanni-web-unpack
rsync -a --delete /tmp/fanni-web-unpack/ /var/www/fanni-web/
ls -la /var/www/fanni-web/index.html
# APK منفصل: /var/www/upnexa-eg.com/fanni.apk (انظر 3.4)
```

تفاصيل Nginx/SPA: [`deploy/WEB-APP-UPNEXA.md`](WEB-APP-UPNEXA.md).

## 3.4 رفع APK 1.0.10

WinSCP: `fanni.apk` → `/root/fanni.apk`

**المسار الرسمي على السيرفر:** `/var/www/upnexa-eg.com/fanni.apk`

```bash
install -d /var/www/upnexa-eg.com
cp /root/fanni.apk /var/www/upnexa-eg.com/fanni.apk
chmod 644 /var/www/upnexa-eg.com/fanni.apk
ls -lh /var/www/upnexa-eg.com/fanni.apk
```

رابط التحميل: https://upnexa-eg.com/fanni.apk

على الهاتف: أزل النسخة القديمة إن لزم، ثبّت، وتحقق من الإصدار **1.0.10**.

## 3.5 تحقق بعد النشر

```bash
curl -sS https://api.upnexa-eg.com/api/healthz
curl -sS https://api.upnexa-eg.com/ | head -5
curl -sS -o /dev/null -w "%{http_code}\n" https://app.upnexa-eg.com/
pm2 logs fanni-api --lines 30
```

### اختبار Sentry

| القناة | الطريقة |
|--------|---------|
| سكربت VPS | `cd /var/www/fanni && pnpm --filter @workspace/api-server run sentry:test` |
| API (مسئول) | `curl -X POST https://api.upnexa-eg.com/api/admin/sentry-test -H "Authorization: Bearer TOKEN"` |
| التطبيق | لوحة الأدمن → **مراقبة Sentry** → Front / Back |

لوحة: https://upnexa-hb.sentry.io — مشاريع `node` و `fanni`. تفاصيل: [`deploy/SENTRY-MCP.md`](SENTRY-MCP.md).

### تنظيف سجلات PM2 (اختياري)

```bash
pm2 flush fanni-api
pm2 reload fanni-api
```

---

# الجزء 4 — مسار WinSCP (بدون git pull)

على ويندوز:

```powershell
cd C:\Fanni
powershell -ExecutionPolicy Bypass -File scripts\pack-vps-upload.ps1
```

ينتج: `%USERPROFILE%\Downloads\fanni-vps-upload.zip` (كود + web export مدمج).

على VPS:

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

ثم ارفع APK كما في 3.4.

> `/var/www/storage/fanni` للصور فقط — **لا تضع فيه الكود**. لا ترفع `.env` المحلي ولا `node_modules`.

---

# الجزء 5 — نشر عبر GitHub Actions

المستودع: https://github.com/HFakhry81/Fanni

1. مرة واحدة على VPS: `sudo bash scripts/vps-bootstrap-from-github.sh` ثم أكمل `.env`
2. Secrets: `FANNI_VPS_HOST`, `FANNI_VPS_USER`, `FANNI_VPS_SSH_KEY`
3. دفع إلى `main` أو تشغيل workflow **Deploy VPS**

---

# قيم `.env` الإنتاج على VPS

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

لا تضف `TWILIO_*` حتى تتوفر بيانات Console. لا ترفع `.env` إلى Git.

---

# صيانة سجلات PM2

| الملاحظة | الإجراء |
|----------|---------|
| `level:30` في out | معلومات Pino عادية — طبيعي |
| `404` لـ `/robots.txt` | مسح آلي — طبيعي |
| تنظيف | `pm2 flush fanni-api` ثم `pm2 reload fanni-api` |

---

# سكربتات مساعدة (من `C:\Fanni`)

| السكربت | الغرض |
|---------|--------|
| `scripts\local-update.ps1` | migrate + typecheck + build API |
| `scripts\export-web.ps1` | تصدير `dist-web` (+ `-Zip`) |
| `scripts\eas-apk.ps1` | بناء APK عبر EAS |
| `scripts\pack-vps-upload.ps1` | حزمة WinSCP (كود + web) |
| `scripts\deploy-vps.sh` | نشر كامل على Ubuntu VPS |

أوامر pnpm من الجذر:

```powershell
cd C:\Fanni
pnpm run local:update
pnpm run export:web
pnpm run dev:api
pnpm run dev:mobile
pnpm run migrate
```
