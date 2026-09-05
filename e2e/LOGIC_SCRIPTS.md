# Fanni — خريطة منطق التطبيق + سكربتات الاختبار

**الموقع:** `e2e/tests/logic/`  
**التشغيل:** `scripts\run-e2e-logic-suite.cmd` أو `pnpm test:e2e:logic`  
**شرط الكتابة:** بيئة محلية (`E2E_USE_LOCAL=1`) أو `E2E_ALLOW_PROD_WRITES=1` (بحذر).

---

## 1) المحفظة والنقاط

| السيناريو | المنطق (سيرفر) | السكربت |
|-----------|----------------|---------|
| **شحن رصيد** | فني `POST /api/payments/request` → أدمن `PATCH .../confirm` → زيادة `pointsBalance` | `10-wallet-points` A |
| **رفض شحن** | أدمن `.../reject` → **لا** رصيد | `10-wallet-points` B |
| **نقاط المسئول** | أدمن `POST /api/admin/wallet/bonus-grant` → فني `acknowledge` → رصيد ترويجي | `10-wallet-points` C |
| **نقاط ترحيب** | **فقط** عند `PATCH /admin/technicians/:id/approve` بعد تأكيد الأدمن — ليست seed عند الإقلاع | `10-wallet-points` D (`E2E_APPROVE_PENDING_TECH=1`) |

---

## 2) دورة الطلب

```
إنشاء (pending)
  ├─ إلغاء عميل ───────────────────────────► cancelled
  ├─ رفض فني (decline) ────────────────────► يبقى pending (بلا خصم) — إخفاء إشعار فقط
  └─ قبول (accept + unlock points)
        ├─ start ──► in_progress
        │     ├─ complete ──► completed ──► rate
        │     └─ fail-service(reason)
        │           ├─ client_not_present / client_refused ──► cancelled + refundRequested + dispute
        │           └─ حلول بديلة (different_problem, parts_unavailable, cannot_repair, …)
        │                 ──► cancelled بدون استرداد تلقائي
        └─ أدمن: PATCH /admin/disputes/:id { approve → refund | reject }
```

| السيناريو | المنطق | السكربت |
|-----------|--------|---------|
| إنشاء + إلغاء | عميل يلغي وهو `pending` فقط | `20-order-lifecycle` 1 |
| رفض | `POST .../decline` بلا خصم؛ الطلب يبقى للقائمة | `20-order-lifecycle` 2 |
| قبول → إكمال → تقييم | خصم نقاط unlock عند القبول؛ `start` → `complete` → `rate` | `20-order-lifecycle` 3 |
| عدم التمكن من الوصول | `fail-service` + `client_not_present` → نزاع/استرداد | `20-order-lifecycle` 4 |
| حلول بديلة | أسباب بدون `refundRequested` | `20-order-lifecycle` 5 |
| رفض العميل للخدمة | `client_refused` → نزاع + قرار أدمن | `20-order-lifecycle` 6 |
| استرداد/إكمال لاحق | طلب جديد يُكمَل بعد فشل سابق | `20-order-lifecycle` 7 |

### أسباب `fail-service` (API)

| reason | استرداد تلقائي؟ |
|--------|------------------|
| `client_not_present` | نعم (`refundRequested`) |
| `client_refused` | نعم |
| `different_problem` | لا |
| `parts_unavailable` | لا |
| `extra_time` | لا |
| `cannot_repair` | لا |
| `other` | لا |

---

## 3) أين النتائج؟

- فيديو: `e2e/test-results/**/video.webm`
- لقطات: `e2e/test-results/**/screenshots/*.png`
- تقرير HTML: `e2e/playwright-report/index.html`
- ملخص الحلقة: `e2e/quality-loop-out/SUMMARY.md`

---

## 4) أوامر سريعة

```bat
:: محلي (موصى به للكتابة)
set E2E_USE_LOCAL=1
scripts\run-e2e-logic-suite.cmd

:: أو
pnpm test:e2e:logic
```
