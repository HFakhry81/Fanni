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
```

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
| `order-journey/01-…` | عميل: إنشاء / إلغاء |
| `02-…` | فني: بيانات مقنّعة / decline |
| `03-…` | قبول + تتبع |
| `04-…` | فشل خدمة / نزاع |
| `FULL_ORDER_JOURNEY.md` | خريطة الرحلة اليدوية + الأتمتة |

بعد ما يخلص الـ run: افتح التقرير هنا في الشات وابعت رابط الـ Actions run أو ارفع الـ HTML — نراجع النتائج مع بعض بدون إعادة تشغيل الاختبارات من الـ agent.
