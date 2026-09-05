# Cloud E2E — بدون استهلاك Tokens في Cursor

## الاختيار

| المنصة | التكلفة | الاستخدام |
|--------|---------|----------|
| **GitHub Actions** (موصى به) | مجاني للريبو العام / دقائق مجانية للخاص | تشغيل Playwright كامل + تقرير HTML |
| **LambdaTest** (اختياري) | خطة مجانية محدودة + trial | فيديو الجلسة / UX على متصفح سحابي |

المشروع أصلًا مدمج مع Playwright في `e2e/` وLambdaTest عبر `pnpm test:e2e:lt`.

---

## 1) إعداد Secrets (مرة واحدة)

GitHub → **Settings → Secrets and variables → Actions** → New repository secret:

| Secret | مثال (إنتاج) |
|--------|----------------|
| `E2E_CLIENT_IDENTIFIER` | رقم عميل الاختبار |
| `E2E_CLIENT_PASSWORD` | |
| `E2E_TECH_IDENTIFIER` | رقم الفني |
| `E2E_TECH_PASSWORD` | |
| `E2E_ADMIN_IDENTIFIER` | `admin` |
| `E2E_ADMIN_PASSWORD` | |

اختياري للفيديو على LambdaTest:

| `LT_USERNAME` | من لوحة LambdaTest |
| `LT_ACCESS_KEY` | |

سجّل مجانًا: https://www.lambdatest.com/

---

## 2) تشغيل الاختبار عن بُعد

1. GitHub → **Actions** → **E2E Playwright** → **Run workflow**
2. اختر:
   - `suite`: `all` | `smoke` | `order-journey`
   - `target`: `production` (افتراضي) أو `custom`
   - `use_lambdatest`: `false` للتشغيل المجاني على GitHub runners
3. انتظر انتهاء الـ job (لا حاجة لـ Cursor)

### محلي (إن أردت)

```bat
cd /d E:\UpNexa.com\Fanni
pnpm test:e2e          rem أو test:e2e:local
pnpm test:e2e:lt       rem يحتاج LT_* في e2e/.env
pnpm test:e2e:full     rem لقطات شاشة + فيديو (full-app)
```

أو من سطح المكتب: `run-e2e-full-recorded.cmd` → `scripts\run-e2e-full-recorded.cmd`

---

## 2b) تسجيل لقطات شاشة + فيديو شاشة

مشروع Playwright: **`full-recorded`** (`e2e/tests/full-app/*.spec.ts`)

| الإعداد | القيمة |
|---------|--------|
| `video` | `on` → ملف `video.webm` لكل اختبار |
| `screenshot` | `on` → لقطة عند كل خطوة + فشل |
| `trace` | `on` → إعادة تشغيل التفاعل في التقرير |
| `film()` | لقطات مُسمّاة في التقرير + `test-results/**/screenshots/*.png` |

```bat
pnpm test:e2e:full
```

بعد التشغيل افتح:

- التقرير: `e2e\playwright-report\index.html`
- الفيديوهات: `e2e\test-results\**\video.webm`
- اللقطات: `e2e\test-results\**\screenshots\*.png`

اختياري: `E2E_RECORD=1` يجعل كل المشاريع (بما فيها smoke) تسجّل فيديو/لقطات دائمًا.

### حماية الإنتاج من بيانات الاختبار

| الإعداد | المعنى |
|---------|--------|
| `E2E_USE_LOCAL=1` | يستخدم `E2E_LOCAL_*` (موصى به لمسارات الكتابة) |
| `E2E_ALLOW_PROD_WRITES=1` | يسمح بإنشاء طلبات/شحن/بونص على الإنتاج — **لا تفعّله إلا عمدًا** |
| بدون السماح | أي `POST/PATCH` غير تسجيل الدخول يُرفض؛ اختبارات الكتابة تُتخطّى |

سكربتات:

- `scripts\run-e2e-full-recorded.cmd` — محلي أولًا (`E2E_USE_LOCAL=1`)
- `scripts\run-e2e-smoke-prod.cmd` — إنتاج للقراءة فقط
- Deploy VPS: `FANNI_SEED=1` فقط عند الحاجة لـ seed المواقع
- `sentry:test`: يحتاج `SENTRY_ALLOW_TEST_EVENTS=1`

---

## 3) مراجعة التقارير (UX / UI / E2E)

### من GitHub Actions
1. افتح الـ run الناجح/الفاشل
2. **Artifacts** → حمّل `playwright-report-<number>`
3. فك الضغط وافتح `index.html` في المتصفح
4. فيه: نتائج كل سيناريو · لقطات الفشل · traces عند إعادة المحاولة
5. **Job summary** في أسفل صفحة الـ run

### من LambdaTest (لو فعّلت `use_lambdatest`)
- https://automation.lambdatest.com/
- فيديو الجلسة · Network · Console — مناسب لمراجعة UX

---

## 4) ماذا يغطي الـ suite الحالي؟

| ملف | المحور |
|-----|--------|
| `tests/smoke.spec.ts` | تحميل الويب + login UI + API health |
| `full-app/00-…` | شاشات عامة (welcome/login/register) + فيديو |
| `full-app/10-…` | دخول أدوار + hubs (عميل/فني/أدمن) |
| `full-app/20-…` | شحن نقاط · طلب · إلغاء · decline · قبول→إكمال · fail-service |
| `full-app/30-…` | بونص أدمن + شاشة تسجيل (بدون OTP حقيقي) |
| `order-journey/01-…` | عميل: إنشاء / إلغاء |
| `02-…` | فني: بيانات مقنّعة / decline |
| `03-…` | قبول + تتبع |
| `04-…` | فشل خدمة / نزاع |
| `FULL_ORDER_JOURNEY.md` | خريطة الرحلة اليدوية + الأتمتة |

بعد ما يخلص الـ run: افتح التقرير هنا في الشات وابعت رابط الـ Actions run أو ارفع الـ HTML — نراجع النتائج مع بعض بدون إعادة تشغيل الاختبارات من الـ agent.
