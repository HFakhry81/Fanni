# تحليل سكربت E2E الشامل مقابل Fanni الفعلي

**التاريخ:** 5 سبتمبر 2026  
**المدخل:** سكربت Playwright مفاهيمي (Lead leakage · Wallet race · Geo · Cancel/Refund · Admin · OCR)  
**المخرج:** تحليل عيوب + مواصفة مكيَّفة قابلة للتشغيل

---

## الحكم

السكربت المسود **لا يطابق عقود Fanni**. تشغيله كما هو سيفشل على المسارات، المصادقة، رموز الحالة، ونموذج المنتج (خصوصًا OCR).

النسخة المكيَّفة: `e2e/tests/logic/60-comprehensive-edge-adapted.spec.ts`

---

## جدول الفجوات (مسودة → واقع)

| # | المسودة | الواقع في Fanni | التصحيح |
|---|---------|-----------------|---------|
| 1 | `POST /api/orders/create` → **201** + `sanitized_description` | `POST /api/orders` → **400** `CONTACT_PII_IN_DESCRIPTION` | رفض الإنشاء عند وجود هاتف/واتساب |
| 2 | `Bearer mock_tech_token_low_balance` | تسجيل دخول حقيقي + `POST .../accept` أو `/unlock` | **402** `Insufficient points` + رسالة عربية في `message` |
| 3 | `GET /api/technician/available-orders` + بوابة 5 كم | `GET /api/orders/pending`؛ نصف القطر عبر WebSocket tiers (15→50→100 سقف) | لا بوابة HTTP كاملة للمسافة |
| 4 | `POST .../cancel` + `refund_issued` | `PATCH .../cancel`؛ عميل يلغي **pending** فقط؛ `refundedUnlocks` خلال 3 دقائق بلا اتصال | مصفوفة: pending / بعد قبول مرفوض / fail-service |
| 5 | `/admin/login` + username | Expo `/(admin)/(tabs)/...` + `login-with-password` | تأكيد دفع API + audit-logs |
| 6 | `/api/invoices/complete` + OCR fallback | فواتير العمل/OCR **مُحالة للتقاعد**؛ الإكمال عمولة فتح طلب فقط | اختبار complete بدون OCR |
| + | لا اختبار سباق قبول | `FOR UPDATE` + تعيين شرطي | اختبار قبول متزامن ≤ فائز واحد |

---

## عيوب هندسية في المسودة

1. **BASE_URL واحد** لواجهة وAPI — في المشروع: تطبيق ويب/Expo منفصل عن API.  
2. **إطلاق Chromium يدويًا** يتعارض مع fixtures Playwright والمشاريع `logic-suite` / `full-recorded`.  
3. **رموز وهمية** لا تمر من `authMiddleware`.  
4. **افتراضات منتج قديمة** (OCR، sanitize بدل reject، إلغاء بعد القبول مع استرداد تلقائي مطلق).

---

## التشغيل

```bat
set E2E_USE_LOCAL=1
set E2E_LOGIC_UI_LOGIN=1
scripts\run-e2e-logic-suite.cmd
```

أو استهداف الملف فقط عبر Playwright project `logic-suite`.

---

## تغطية مكمّلة موجودة مسبقًا

| الملف | الدور |
|-------|------|
| `10-wallet-points` | شحن تأكيد/رفض، بونص |
| `20-order-lifecycle` | دورة كاملة + fail-service |
| `30-edge-conditions` | قبول مزدوج، إلغاء بعد قبول، قناع |
| `40-dispute-rate-circle` | نزاعات وتقييم |
| `50-security-gaps` | PII، مرجع مكرر، سباق |
| `60-comprehensive-edge-adapted` | جسر السكربت المفاهيمي → عقود حقيقية |
