# نشر الإنتاج عبر GitHub (المسار المعتمد)

المستودع: `https://github.com/HFakhry81/Fanni`.

1. على الـ VPS مرة واحدة: `sudo bash scripts/vps-bootstrap-from-github.sh` ثم أكمل `/var/www/fanni/.env` (انظر القيم أسفل) ثم `bash scripts/deploy-vps.sh`.
2. في GitHub → Settings → Secrets → Actions أضف:
   - `FANNI_VPS_HOST` = IP الأصل (ليس Cloudflare)
   - `FANNI_VPS_USER` = مستخدم SSH
   - `FANNI_VPS_SSH_KEY` = مفتاح خاص لمستخدم النشر (صلاحية محدودة)
   - اختياري: `FANNI_VPS_PORT`
3. الدفع إلى `main` أو Actions → **Deploy VPS** → Run workflow.
4. Apache يبقى كما هو: `api.upnexa-eg.com` → `127.0.0.1:5000`، و`app.upnexa-eg.com` من `/var/www/fanni-web`.

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
