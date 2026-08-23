# رفع فني على VPS (UpNexa) — الترتيب مهم

Twilio **غير مطلوب** لهذا الرفع. اترك `TWILIO_*` فارغة؛ الاتصال المقنّع يعيد 503 بالعربية حتى يتوفر الحساب.

لا تستخدم `ssh api.upnexa-eg.com` — النطاق خلف Cloudflare. ادخل بلوحة الاستضافة أو IP الأصل.

لا تضع باسورد SSH أو توكن Twilio في الشات أو في git.

## على جهازك (تم)

- الكود على `main`: `e68d31f` وما بعده على GitHub.
- التطبيق المحلي يبقى كما هو؛ الرفع يتم من السيرفر عبر `git pull`.

## على سيرفر Ubuntu (بهذا الترتيب)

1. ادخل جلسة الأصل (ليس Cloudflare).
2. اذهب لمجلد النسخة الحالي (غالباً `/var/www/fanni` أو مسار PM2 الحالي):
   `cd /path/to/Fanni && pwd`
3. إن كان السكربت بنهاية سطر ويندوز:
   `sed -i 's/\r$//' scripts/deploy-vps.sh`
4. حدّث الكود:
   `git fetch origin && git checkout main && git pull origin main`
5. راجع `.env` في جذر المشروع (لا تستبدله بالكامل):
   - أبقِ `DATABASE_URL` و`SESSION_SECRET` الحاليين.
   - أضف إن نقص: `PORT=5000` `NODE_ENV=production` `PUBLIC_API_URL=https://api.upnexa-eg.com`
   - `CORS_ORIGINS=https://api.upnexa-eg.com,https://app.upnexa-eg.com`
   - `STORAGE_DRIVER=local`
   - `PRIVATE_OBJECT_DIR=/var/www/storage/fanni`
   - `PRIVATE_OBJECT_DIR_ID=/var/www/storage/fanni/id`
   - `PRIVATE_OBJECT_DIR_CARNEHAT=/var/www/storage/fanni/carnehat`
   - `DISPUTE_AUTO_DAILY_CAP=2`
   - `PAYMENT_PROVIDER=manual`
   - **لا** تضف مفاتيح Twilio.
6. إن كان اسم عملية PM2 ليس `fanni-api`:
   `pm2 ls` ثم `export FANNI_PM2_NAME=الاسم`
7. نفّذ:
   `bash scripts/deploy-vps.sh`
8. تحقق:
   `curl -sS http://127.0.0.1:5000/api/healthz`
   `curl -sS https://api.upnexa-eg.com/api/healthz`
9. Apache كما هو (بروكسي إلى `127.0.0.1:5000` + websocket). لا تجعل مجلدات `id`/`carnehat` عامة.
10. تطبيق الموبايل يشير أصلاً إلى `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com` — لا حاجة لرفع APK مع هذا التحديث ما لم تغيّر واجهة العميل.

## بعد الرفع (اختياري)

- مسار قبول: تسجيل فني بصور → اعتماد → شحن يدوي → طلب → موافق وكمل → وصول. بدون اتصال مقنّع.
- OPay لاحقاً. Twilio لاحقاً.
