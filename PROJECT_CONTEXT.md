📌 **سياق مشروع تطبيق فني (Fanni App & API) - UpNexa**

نحن نعمل على تطوير وتحديث تطبيق الموبايل والباك إند الخاص بـ **Fanni**. إليك التفاصيل التقنية الدقيقة للبنية التحتية الحالية:

1. **الباك إند (Backend & Server):**
   - السيرفر: Ubuntu VPS (اسم الجهاز: `UpNexa`).
   - خادم الويب الرئيسي: **Apache** (يدير الموقعيْن الرئيسي والمستضاف، ولا نستخدم Nginx).
   - إدارة العمليات: **PM2** لتشغيل خدمة الباك إند على المنفذ المحلي `http://127.0.0.1:5000`.
   - النطاق: `https://api.upnexa-eg.com` مزود بشهادة SSL (Let's Encrypt).
   - توجيه الـ WebSockets والـ Sentry: مفعل على Apache عبر موديلات `proxy_wstunnel` و `rewrite` للربط الحي عبر `ws://127.0.0.1:5000`.

2. **قاعدة البيانات (PostgreSQL):**
   - اسم قاعدة البيانات: `fanni_db`.
   - جدول المستخدمين: `users`.
   - أعمدة البيانات الأساسية: `id`, `first_name`, `last_name`, `mobile`, `email`, `role`, `created_at`.
   - أدوار المستخدمين: `client`, `technician`, `admin`.

3. **تطبيق الموبايل (React Native / Expo):**
   - المجلد المحلي: `C:\Users\Sam\Downloads\Fanni\artifacts\mobile`.
   - البيئة: ملف `.env` موجه لـ `EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com`.
   - تشغيل محلي: سكريبت `.bat` يدعم UTF-8 (`chcp 65001`) لضبط الـ IP المحلي بث `Metro` على الواي فاي وربطه بالباك إند الحي مباشرة.
   - تتبع الأخطاء: متصل بنجاح بـ **Sentry**.

👉 **الطلب:** يرجى التفاعل والرد بناءً على المعطيات والهيكلية البرمجية المذكورة أعلاه.

4. **النشر على الـ VPS (لا باسورد SSH في الشات):**
   - الترتيب الكامل: [`deploy/VPS-STEPS.md`](deploy/VPS-STEPS.md)
   - النطاق العام خلف **Cloudflare**؛ ادخل من لوحة الاستضافة أو IP الأصل ثم `git pull` و`bash scripts/deploy-vps.sh`.
   - Twilio وOPay ليسا جزءاً من هذا الرفع.