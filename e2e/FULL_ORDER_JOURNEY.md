# Fanni — اختبار رحلة الطلب الكاملة (Live-pass + E2E)

**آخر تحديث:** 31 أغسطس 2026  
**المرجع:** [`E2E_360_REPORT.md`](../E2E_360_REPORT.md) · [`SPEC_BASELINE.md`](../SPEC_BASELINE.md)  
**البيئة:** `https://app.upnexa-eg.com` · `https://api.upnexa-eg.com` · APK `https://upnexa-eg.com/fanni.apk`

---

## 1) الهدف

إغلاق **القبول الحي (Live-pass)** لمسار الطلب من إنشاء الطلب حتى التقييم، مع **كل الاستثناءات**:

| المحور | ما يُختبر |
|---|---|
| المطابقة | توسيع نطاق البث الجغرافي (سيرفر) |
| الخصوصية | إخفاء بيانات العميل قبل فتح الـ Lead |
| القبول/الرفض | خصم نقاط · رفض بلا خصم · بقاء الطلب `pending` للفنيين الآخرين |
| الإلغاء | عميل يلغي قبل القبول فقط |
| التتبع | خريطة · وصول · بدء العمل · إكمال |
| المحفظة | خصم فتح Lead · شحن · مكافأة يدوية · استرداد نزاع |
| الاستثناء | `client_not_present` / `client_refused` → نزاع + طلب استرداد |
| التقييم | نجوم بعد `completed` |

**التوثيق المطلوب:** 12 لقطة شاشة + فيديو واحد على الأقل للتتبع والقبول.

---

## 2) طبقتا الاختبار

### أ) Live-pass يدوي (الأولوية)

تسجيل فيديو/لقطات على **APK** (موصى به للـ WS/GPS) أو ويب بعد `pnpm run export:web`.

### ب) أتمتة Playwright (`e2e/tests/order-journey/`)

```bash
pnpm test:e2e:local          # Chrome محلي
pnpm test:e2e:lt             # LambdaTest — فيديو الجلسة في لوحة LT
```

متغيرات الحسابات في `e2e/.env` (انظر `.env.example`). الاختبارات **تُتخطى** إن لم تُضبط.

---

## 3) متطلبات ما قبل الاختبار

- [ ] نشر API + migrate حتى **026** (`wallet_bonus_grants`)
- [ ] تصدير ويب: `pnpm run export:web`
- [ ] APK **1.0.10+** على الموقع
- [ ] **عميل** نشط (C1 مكتمل)
- [ ] **فني 1 + فني 2** معتمدان · متاحان · نفس التخصص/المنطقة · رصيد ≥ 20 نقطة
- [ ] **Super Admin** لاختبار مكافأة يدوية
- [ ] Twilio (اتصال مقنّع): **مؤجّل** — خارج معايير النجاح الحالية

---

## 4) خريطة الرحلة (كود المشروع)

### دورة الحالة

```
pending → (accept + unlock) → accepted/en_route/arrived → in_progress → completed
       → cancelled (إلغاء عميل قبل القبول | فشل خدمة)
```

### مسارات Expo Router

| الدور | المسار |
|---|---|
| عميل | `/login` → `/(client)/home` → `/new-order` → `/order-tracking` → `/(client)/orders` |
| فني | `/login` → `/(tech)/available-orders` → `/(tech)/orders` → `/(tech)/map` |
| أدمن | `/(admin)/(tabs)/dashboard` · `orders` · `disputes` · `users` (مكافآت) |

### API محوري

| الخطوة | Method + Path |
|---|---|
| إنشاء طلب | `POST /api/orders` |
| إلغاء (عميل، pending فقط) | `PATCH /api/orders/:id/cancel` |
| رفض فني | `POST /api/orders/:id/decline` |
| قبول + خصم | `POST /api/orders/:id/accept` |
| فشل خدمة | `PATCH /api/orders/:id/fail-service` (`client_not_present`) |
| إكمال | `PATCH /api/orders/:id/complete` |
| مكافأة يدوية (Super Admin) | `POST /api/admin/wallet/bonus-grant` |
| تأكيد المكافأة (فني) | `POST /api/wallet/bonus-grants/:id/acknowledge` |

### توسيع نطاق البث

- السيرفر: `orderBroadcaster.ts` — مستويات افتراضية **`15 → 50 → 100` كم** (`BROADCAST_RADIUS_TIERS_KM`)
- **لا عنصر UI** باسم `search-radius-indicator` — التحقق عبر سجلات السيرفر أو سلوك وصول الإشعار للفني

### إخفاء الهاتف

- الصيغة: `01••••78` (`maskPhoneDisplay`) — وليس `******`

---

## 5) قائمة التحقق Live-pass (12 لقطة)

| # | المحطة | الدليل | معيار النجاح |
|---|---|---|---|
| 01 | إنشاء طلب | لقطة عميل + رقم الطلب | `status: pending` |
| 02 | إشعار فني | `available-orders` | بطاقة طلب · هاتف مقنّع |
| 03 | إلغاء قبل قبول | تاريخ العميل | `cancelled` · اختفاء من الفني |
| 04 | طلب جديد | نفس العميل | `pending` جديد |
| 05 | رفض فني 1 | قبل/بعد الرفض | لا خصم · الطلب يبقى للآخرين |
| 06 | ظهور عند فني 2 | جلسة ثانية | بطاقة ظاهرة |
| 07 | تأكيد خصم النقاط | Alert القبول | رسالة «قبل ما نكمّل» |
| 08 | كشف البيانات | بعد القبول | رقم غير مقنّع |
| 09 | تتبع + وصول | فيديو أو لقطتان | خريطة · «وصل الفني» |
| 10 | إكمال + تقييم | لقطتان | `completed` + تقييم |
| 11 | `client_not_present` | لقطة فني | نزاع/طلب استرداد |
| 12 | أدمن نزاع + محفظة | disputes + wallet | حالة الاسترداد |

### محطة إضافية — مكافأة Super Admin

| # | المحطة | الدليل |
|---|---|---|
| 13 | منح مكافأة | أدمن: رسالة + تأكيد إرسال |
| 14 | تأكيد فني | فني: إشعار + زر استلام |
| 15 | تأكيد أدمن | قائمة المكافآت: `credited` |

---

## 6) استثناءات المحفظة والنزاع

| السيناريو | السلوك المتوقع |
|---|---|
| رفض قبل القبول | لا خصم |
| قبول | خصم من promo أولًا ثم purchased |
| إلغاء عميل قبل القبول | استرداد unlock إن وُجد (`refundEligibleUnlocksForCancelledOrder`) |
| `client_not_present` | `refundStatus: requested` + dispute — ليس دائمًا فوريًا |
| حد استرداد آلي يومي | `DISPUTE_AUTO_DAILY_CAP` افتراضي **2** |
| مكافأة يدوية | promotional · بعد تأكيد الفني فقط |

---

## 7) ملفات الأتمتة

```
e2e/
  FULL_ORDER_JOURNEY.md          ← هذا الملف
  tests/
    smoke.spec.ts
    order-journey/
      01-client-create-cancel.spec.ts
      02-tech-mask-decline.spec.ts
      03-tech-accept-tracking.spec.ts
      04-fail-service-dispute.spec.ts
    helpers/
      auth.ts
      orders.ts
      lambdatest.ts
```

**محددات الاختبار (`data-testid`):**

| العنصر | testID |
|---|---|
| حقل الدخول | `login-identifier` |
| كلمة المرور | `login-password` |
| زر الدخول | `login-submit` |
| إرسال طلب | `create-order-submit` |
| إلغاء طلب | `cancel-order-btn` |
| بطاقة طلب فني | `incoming-order-card` |
| قبول | `accept-order-btn` |
| رفض | `reject-order-btn` |
| مكافأة فني | `bonus-grant-confirm` |

---

## 8) تشغيل LambdaTest والفيديو

```bash
# من جذر المستودع
pnpm test:e2e:lt
```

- **فيديو:** LambdaTest → Web Automation → Build اليوم
- **صور محلية:** `e2e/test-results/` و `testInfo.attach` في التقارير
- **تقرير HTML:** `pnpm --filter @workspace/e2e run report`

---

## 9) معايير إغلاق E2E 360

يُعتبر **Live-pass الكامل** مغلقًا عند:

1. اكتمال القسم 5 (لقطات 01–12) على إنتاج منشور.
2. اجتياز `order-journey/*` على بيئة اختبار أو إنتاج مع حسابات مخصصة.
3. توثيق التاريخ وHEAD في `E2E_360_REPORT.md`.

---

**توقيع:** Fanni Engineering · 31 أغسطس 2026
