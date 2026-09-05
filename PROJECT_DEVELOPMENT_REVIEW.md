# Fanni — مراجعة تطور المشروع (مرجع مستمر)

آخر مراجعة: 05 سبتمبر 2026

منصة طلبات صيانة منزلية في مصر: عميل ينشئ طلبًا، النظام يطابق فنيًا، الفني يدفع نقاطًا لكشف بيانات العميل، ثم تتبع جغرافي وتأكيد وصول ونتيجة خدمة. **محاسبة المنصة = عمولة Lead فقط** (لا فواتير صيانة/OCR).

هذا الملف هو **القاموس المرجعي للتطور**: ملخص الحالة + بوابات القبول + سجل المراحل + قاموس كل Commit. لا يُعاد كتابة السجلات السابقة؛ تُضاف صفوف جديدة فقط.

المواصفة الموحّدة: [`SPEC_BASELINE.md`](SPEC_BASELINE.md) · الشروط: [`TERMS_OF_USE.md`](TERMS_OF_USE.md).

## التسجيل التلقائي بعد كل Commit

بعد كل `git commit` يُضاف صف في **قاموس الـ Commits** (الهاش، الرسالة، أبرز الملفات) دون حذف الصفوف القديمة.

| الآلية | متى تعمل |
|---|---|
| Git hook `post-commit` | بعد أي commit من الطرفية أو Git أو Cursor |
| Git hook `prepare-commit-msg` | يُدخل تحديث القاموس السابق داخل الـ commit التالي |
| Cursor hook `afterShellExecution` | احتياطي إذا نفّذ الوكيل `git commit` |
| تثبيت الخطافات | تلقائي عبر `pnpm prepare` عند `pnpm install` |

أوامر يدوية:

```bash
pnpm review:log                          # سجّل HEAD الحالي إن لم يكن مسجَّلًا
pnpm review:seed                         # املأ القاموس من آخر 40 commit
pnpm review:update -- "ما تم" "المتبقي"  # صف في سجل المراحل (ليس قاموس الهاش)
```

لتجاوز التسجيل: `SKIP_REVIEW_LOG=1`. الخطافات تُنسخ إلى `.git/hooks` دون تعديل git config.

---

## صورة المشروع

| الطبقة | المسار | الدور |
|---|---|---|
| API | `artifacts/api-server` | Express: طلبات، محفظة، جغرافيا، فواتير، إدارة |
| تطبيق | `artifacts/mobile` | Expo: عميل / فني / أدمن |
| قاعدة البيانات | `lib/db` | Drizzle + PostgreSQL/PostGIS + migrations |
| عقود API | `lib/api-zod`, `lib/api-spec`, `lib/api-client-react` | توليد الأنواع والعميل |

اقتصاد المنتج المعتمد (`SPEC_BASELINE.md`): هدية ترحيب **60** مرة واحدة؛ افتراضي Lead **20**؛ الشحن **120 نقطة لكل 100 جنيه** (باقات Word: 100/250/500/750/1000 → 120/300/600/900/1200). الخصم على السيرفر داخل معاملة واحدة مع دفتر محفظة وأوعية ترويجي/مشترى.

---

## الحالة حسب المنصة

| المنصة | الحالة | ما هو موجود |
|---|---|---|
| API Server | مكتمل جزئيًا | محفظة بأوعية، Lead ذري، جيوفنس، تسعير Lead، اتصال مقنّع، فواتير بلا OCR، تدقيق مالي، قيد مزدوج 020، CORS وحد معدّل |
| تطبيق الهاتف | مكتمل جزئيًا | حوار القبول، تتبع نعم/لا، نتيجة الخدمة، Lead Pricing، شروط استخدام، اتصال مقنّع |
| قاعدة البيانات | مكتمل جزئيًا | 017–020 اقتصاد وأوعية وأستاذ؛ `order_declines`؛ `masked_call_sessions`؛ `admin_audit_logs`؛ أعمدة OCR تاريخية |
| الإدارة | مكتمل جزئيًا | 7 تبويبات؛ KPIs وخرائط OSM؛ عملاء/فنيين/كتالوج؛ مالية وتدقيق؛ موافقة فني + بونص ترحيب بعد التأكيد؛ ينقص طلبات الأدمن من API |
| التخزين | جزئي | رفع خاص محلي بلا makePublic؛ VPS الإنتاجي عند توفر البيانات |

---

## دورة الطلبات (المواصفة النهائية) مقابل التنفيذ

المصدر: نظام الطلبات النسخة النهائية — قبول → تأكيد خصم → التزام → GPS → تأكيد وصول → نتيجة خدمة.

| المرحلة | المطلوب | التنفيذ |
|---|---|---|
| 1 أمان الخصم | إخفاء البيانات، خصم ذري، دفتر، افتراضي 20 | **تم**: `unlockLeadAtomically`، إخفاء بيانات الفني، احتياطي التطبيق 20 |
| 2 قبول = تأكيد نقاط | شاشة مصرية، «موافق وكمل» يخصم ويُسند، «لا مش دلوقتي» بلا خصم | **تم**: حوار في `available-orders.tsx` → `POST /accept` / `POST /decline`؛ 402 يفتح شحن الرصيد |
| 3 تسعير Lead | قواعد خدمة+يوم+وقت من Super Admin | **تم**: محرك + CRUD `/admin/lead-pricing-rules` + شاشة الأدمن + ربط قائمة الفني |
| 4 وصول 30 دقيقة | جيوفنس `en_route`، نعم/لا العميل، مؤقت ثم إسقاط الفني | **تم**: `geo.ts` على `en_route/arrived/acknowledged`، عامل `startArrivalTimeoutWorker` عند الإقلاع، أزرار نعم/لا |
| 5 نتيجة الخدمة | نعم → إكمال+تقييم؛ لا → أسباب إلزامية | **تم**: سؤال في تطبيق الفني + `PATCH /fail-service`؛ التقييم عبر API موجود |
| 6 استرداد استثنائي | لا استرداد تلقائي بعد الكشف إلا سياسة/أدمن | نزاعات أدمن ذرية؛ طلب استرداد عند `client_not_present` / `client_refused`؛ استرداد إلغاء عميل خلال 3 دقائق بلا تواصل (سياسة قائمة) |

---

## مكتمل في المنتج (محفظة وطلبات)

- نقاط داخل المنصة؛ باقات Word المعتمدة 100/250/500/750/1000 → 120/300/600/900/1200 (migrations 017/018/022)؛ تكلفة افتراضية 20 في `unlock_costs`.
- خصم Lead على السيرفر مع دفتر وسبب Customer Data Access.
- إخفاء بيانات العميل قبل الدفع (مسارات الفني في API).
- تتبع اتصال مقنّع (Twilio Voice bridge)؛ نزاع واحد لكل فتح؛ استرداد أدمن غير قابل للتكرار.
- تقييم بعد الإكمال؛ صور مراحل العمل؛ **بدون** فواتير صيانة/OCR (محاسبة المنصة = عمولة Lead فقط).
- تنظيف هاتف/بريد/واتساب/تيليجرام من وصف الطلب قبل البث.
- قبول Lead وإسناده ذريًا؛ تسجيل خدمة غير مكتملة مع أسباب؛ إسقاط فني/إعادة مطابقة جاهز في الكود.
- واجهة الفني: حوار «قبل ما نكمّل» مع `/accept` و`/decline` وشحن الرصيد عند 402.
- شاشة Lead Pricing للأدمن؛ جيوفنس على `en_route` مع مؤقت 30 دقيقة؛ سؤال نتيجة الخدمة.

## مكتمل في جلسة 22 أغسطس مساءً (للاستئناف)

- حوكمة المال: `requireAdmin` + صلاحيات + CORS من env + حد معدّل + `admin_audit_logs`.
- اقتصاد معتمد في migrations **017/018/022**: ترحيب 60، Lead 20، باقات Word 100→120 … 1000→1200، أوعية ترويجي/مشترى.
- شروط الاستخدام في التسجيل؛ رفع خاص بلا `makePublic`؛ اتصال مقنّع في الكود؛ شحن يدوي حتى OPay.
- آخر دفع معروف: `e06bf79`. المتبقي الحي: e2e، Twilio بيئة، OPay، VPS.

## يحتاج استكمالًا (أولوية) — قائمة مهام للاستئناف

الجرد المحدَّث 27 أغسطس 2026: **migrate 023 + APK 1.0.8 + تخزين الصور على VPS مؤكَّدة**؛ تسجيل حساب جديد نجح على هاتف حقيقي. المتبقي الحي لـ Live-pass الكامل = إكمال مسار الطلب/Lead/أدمن على الجهاز + مؤجلات Twilio/OPay/GL.

آخر دفع على `origin/main`: **`a9d3e6e`** (05 سبتمبر). migrate **023/024** مطبّقان تشغيليًا حسب التقارير؛ E2E محلي logic-suite أخضر؛ تقرير فجوات: `E2E_GAP_SOLUTIONS_REPORT.md` (تنفيذ سد الثغرات قيد التنفيذ).

| # | الحالة | الوحدة | المهمة |
|---|---|---|---|
| 1 | [x] | M4 تشغيل | migrate 017–020 على بيئة التطوير (طُبّق 020 هنا) |
| 2 | [x] | M1 | KYC: مسارات `id`/`carnehat`/`uploads` على VPS — **يستقبل الصور** (27 أغسطس) |
| 3 | [x] | M3 | نزاع رقم خاطئ / عدم رد آلي + حد يومي **2** |
| 4 | [~] | M3/M5 | e2e: full-recorded + **logic-suite** (محفظة/طلبات/حواف) محليًا ناجح؛ حماية إنتاج؛ Live-pass جهاز ما زال جزئيًا |
| 5 | [~] | M6 | شريحة قيد مزدوج أولى (ترحيل + ميزان + قيود). ينقص فترات/مراكز تكلفة/تسوية بوابة |
| 6 | [~] | M7 | Twilio مؤجّل — لا يوقف الرفع |
| 7 | [x] | M8 | تبويبات الأدمن + ملف شخصي + أدوات موقع موصولة |
| 8 | [x] | M0 | شاشة تدقيق في الأدمن |
| 9 | [ ] | M4 | ربط OPay عند وصول الـ API |
| 10 | [x] | M9 | مسارات `/var/www/storage/fanni/{id,carnehat,uploads}` مفعَّلة على السيرفر وتستقبل الرفع |
| 11 | [x] | M2 | Accuracy/Source على `/geo/update` |
| 12 | [x] | M4 APK | **v1.0.8** / `versionCode` 8 — منشور على `app.upnexa-eg.com` + مثبت على هاتف حقيقي (27 أغسطس) |
| 13 | [x] | Auth UX | رسائل خطأ تسجيل/دخول حقيقية + إعادة محاولة بدون PostGIS |
| 14 | [x] | UI | فصل animated drivers في MapPickerModal (Sentry useNativeDriver) |
| 15 | [x] | API base | توحيد `getApiBase`/`getWsUrl` وإزالة `http://DOMAIN` من المسارات الحية |
| 16 | [x] | DB | migrate **023** (`working_hours`) على الإنتاج — 27 أغسطس |
| 17 | [x] | جودة | strict TypeScript + ESLint + Jest + قاعدة quality-loop في Cursor (`77a9574`) |
| 18 | [x] | UX ميداني | إصلاحات تجربة 29-08: كيبورد، طلب جديد، خريطة فني، طلبات API (`56c179a`) |
| 19 | [x] | تسجيل فني | رفض التخطي بدون صور البطاقة + تنبيه وتمرير (`90a0455`) |
| 20 | [x] | أدمن | لوحة تحكم API حقيقية، خرائط OSM (حية/مراقبة/تخصص)، عملاء/فنيين، كتالوج صور (`0c47a05`) |
| 21 | [~] | DB | migrate **024** — مذكور مطبّق في تقارير التشغيل؛ تأكيد دوري على VPS عند كل نشر |
| 22 | [ ] | UX متبقي | صورة العميل في شاشات الفني، ملف شخصي كامل، OPay، جدولة طلبات 15 دقيقة |
| 23 | [~] | أمان/فجوات | تقرير حلول الثغرات مكتوب؛ P0 مفتوح: unique مرجع شحن، فلتر PII سيرفر، فرض mustChangePassword على API |
| 24 | [x] | تشغيل ويندوز | UPDATE_ALL / إصلاح node_modules / Metro / سكربتات تشغيل موحّدة على مسار E: |
| 25 | [x] | مطابقة فني | مهنة + محافظة/موقع يومي + رصيد حي قبل القبول؛ decline = إخفاء إشعار فقط |

---

## ملخص جلسة 29 أغسطس 2026

**المرجع:** مرفق «تجربة استخدام 29-08-2026.docx» + طلبات متابعة في المحادثة.

**الهدف:** إغلاق أعلى نقاط تأثيرًا من تجربة الميدان، ثم ربط لوحة الأدمن بالـ API الحقيقي.

### Commits المدفوعة على `main` (بالترتيب)

| الهاش | الموضوع |
|---|---|
| `77a9574` | strict TypeScript، ESLint، Jest، قاعدة `.cursor/rules/quality-loop.mdc` |
| `56c179a` | UX ميداني: كيبورد، افتراضيات طلب جديد، خريطة فني حقيقية، طلبات من API، صور بطاقة، موقع يومي |
| `90a0455` | تسجيل فني: رفض التخطي بدون صور البطاقة (تنبيه + تمرير + حماية عند الإرسال) |
| `0c47a05` | أدمن: KPIs وطلبات من API، خريطة OSM مدمجة، أوضاع live/monitor/tech، تعليق حساب، فلتر موافقة، رفع صور كتالوج |
| `e4e12fd` | سكربت `scripts/extract-docx.mjs` لاستخراج نصوص مرفقات Word |

### ما تم تنفيذه (تفصيل)

**تجربة المستخدم (عميل/فني):**
- مساحة تمرير أسفل الكيبورد في `KeyboardAwareScrollViewCompat`.
- طلب جديد: تاريخ اليوم، الوقت الحالي، عنوان من الملف، وصف المشكلة إجباري.
- فني: خريطة OSM حقيقية، طلبات من `/api/technician/pending-orders`، تنبيه موقع مرة/يوم، شريط اتصال بعد 8 ثوانٍ.
- تسجيل فني: صور البطاقة إجبارية مع `technicianRegisterValidation` + 15 اختبار Jest.

**لوحة الأدمن:**
- `GET /admin/dashboard/stats` + `GET /admin/orders` + `GET /admin/ledger`.
- خريطة: `AdminLiveMapPreview` في اللوحة؛ `map-dashboard` بأوضاع `live` (30 ث) / `monitor` (30 د) / `tech` (ألوان تخصص).
- عملاء/فنيين: بيانات API، فلاتر الكل/نشط/موقوف/بانتظار الموافقة؛ إصلاح `PATCH /admin/users/:id` للتعليق.
- كتالوج: رفع صورة للمجال والتخصص؛ migration **024** لعمود `icon` في `service_specializations`.
- `map-data` محمي بـ auth ويعيد `specialty` + `availableOnly`.

**الجودة:** `pnpm run typecheck` و`pnpm --filter @workspace/mobile test` ناجحان بعد التغييرات.

### المتبقي من مرفق 29-08 (للجولات القادمة)

| الموضوع | الحالة |
|---|---|
| خطوة التحقق في التسجيل + ربط API كامل | لم يُنفَّذ |
| منتقي ساعات عمل بعقارب (مثل وقت الزيارة) | جزئي (عرض نهار/ليل فقط) |
| تعديل الملف الشخصي الكامل (عميل/فني) | لم يُنفَّذ |
| صورة العميل في كل شاشات الفني + ربط مرفقات | لم يُنفَّذ |
| محفظة الفني — رسالة ترحيب بالنقاط (مرة واحدة) | جزئي |
| شاشة طلبات الأدمن (`orders.tsx`) — ما زالت mock | لم يُنفَّذ |
| OPay / الدفع الحقيقي | مؤجّل |
| جدولة الطلبات كل 15 دقيقة في الـ backend | لم يُنفَّذ |
| تخصصات إضافية في الشاشة الرئيسية للعميل | لم يُنفَّذ |

### خطوات تشغيل بعد النشر

1. تطبيق migration **024** على Postgres الإنتاج: `pnpm --filter @workspace/db run migrate`
2. إعادة بناء ونشر API على VPS
3. بناء APK جديد وتثبيته للتحقق من الأدمن والتسجيل والخريطة

**آخر دفع على `origin/main`:** `e4e12fd` (29 أغسطس 2026).

---

## إصلاح اتصال الموبايل + الأنيميشن (26 أغسطس 2026 مساءً)

| المشكلة | السبب | الحالة في الكود |
|---|---|---|
| «تعذّر الاتصال» عند حفظ تسجيل / دخول | `res.json()` على HTML 500؛ أو Base URL عبر `EXPO_PUBLIC_DOMAIN` فارغ؛ أو فشل PostGIS | **محلولة في الكود** — يحتاج نشر API + APK لاحق |
| Crash Sentry `useNativeDriver` | FAB في MapPicker يخلط JS `bottom` مع native `scale` | **محلولة في الكود** (`de0f263`) |
| متصفح الهاتف يرى `/healthz` ok | الشبكة/SSL سليمة على الجهاز | مُؤكد بلقطة مستخدم |

**قرار 26 أغسطس مساءً:** بناء **APK v1.0.6** بعد إغلاق بنود الكود (اتصال/أنيميشن/كيبورد/شروط). المؤجّل عمدًا يبقى: Twilio، OPay، نشر VPS اليدوي، E2E جهاز حي، GL المتقدم.

---

## تقرير APK / EAS (24–26 أغسطس 2026)

### ملخص الجلسة

**الهدف:** APK إنتاجي مرتبط بـ `https://api.upnexa-eg.com`، يُحمَّل من `https://app.upnexa-eg.com/fanni.apk` بعد رفعه على الـ VPS (WinSCP → `/var/www/fanni-web/fanni.apk`). الـ VPS لا يبني أندرويد؛ البناء على EAS Cloud من `artifacts/mobile`.

**ما كان جاهزًا في الكود قبل هذه الجلسة:** هجرة `021_schema_gap_repair.sql`، أمر `pnpm --filter @workspace/db run seed`، `eas.json` داخل الموبايل فقط، بروفايل `preview` (`buildType: apk`)، `scripts/eas-apk.ps1`، توثيق في `deploy/VPS-STEPS.md`.

**محاولات البناء على EAS (بالترتيب):**

| Build ID | المرحلة التي سقطت | السبب |
|---|---|---|
| `e39d19dd` | Bundle JavaScript | `Invalid call … process.env.EXPO_ROUTER_APP_ROOT` في `expo-router/_ctx.android.js` |
| `c23a3e77` | Bundle JS (ثم Gradle في محاولة لاحقة) | تكرار `@react-navigation/core` (7.17.2 vs 7.21.13)؛ ثم `sentry-cli` بدون `--org` |
| `0d1b9846` | — | نجح لكن APK يُغلق فور الفتح (Babel worklets) |
| `89991f75` | Gradle | تعطيل `newArchEnabled` كسر Reanimated 4 (`assertNewArchitectureEnabledTask`) |
| `0bea6779` | — | نجح — v1.0.1، New Arch مفعّل، babel بلا بلجن إضافي بعد worklets |
| `146287ef` | — | نجح — v1.0.1؛ APK مُنزَّل محليًا |
| `2d798c8e` | — | **نجح** — v1.0.2 (Sentry متأخر + بدون KeyboardProvider في الجذر) |
| `08c6ea00` | Pre-install | `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` — `patchedDependencies` في الأرشيف دون `patches/` على EAS |
| `51a8992e` | INSTALL_CUSTOM_TOOLS | pnpm 11.23.0 يتطلب Node ≥22؛ EAS Builder على Node 20 |
| `bae7ee22` | — | **نجح** — v1.0.3 / `versionCode` 3؛ OSM WebView؛ بلجن محلي `./plugins/withReactNativeWebView` |
| `60610e5a` | — | **نجح** — v1.0.4 / `versionCode` 4؛ Sentry JS (`fanni-app`)؛ بدون keyboard-controller |

**إصلاحات طُبّقت في الجلسة:**

- محاذاة حزم SDK 54 في `package.json` + تحديث `pnpm-lock.yaml` (محليًا: `NODE_OPTIONS=--use-system-ca` عند فشل TLS على npm).
- إزالة الاعتماد المباشر على `@react-navigation/core@7.17.2`؛ `usePreventRemove` من `@react-navigation/native`؛ `pnpm.overrides` يثبّت `core` على 7.21.13.
- `metro-router-ctx.js` + `resolveRequest` في `metro.config.js` لاستبدال `_ctx` Android بمسار `./app` ثابت.
- **لا** بلجن إضافي بعد preset في `babel.config.js` (worklets يجب أن يبقى آخر بلجن).
- `SENTRY_DISABLE_AUTO_UPLOAD=true` و`SENTRY_ALLOW_FAILURE=true` في `eas.json`؛ `Sentry.init` داخل try/catch؛ إزالة `captureException` التجريبي من `(admin)/_layout`.
- `reactCompiler: false`؛ `newArchEnabled: true` (مطلوب لـ Reanimated 4).
- `scripts/eas-apk.ps1`: `NODE_OPTIONS=--use-system-ca` على ويندوز؛ حذف `eas.json`/`app.json` الخاطئين من جذر المستودع.
- v1.0.3 (26 أغسطس): بلجن Expo محلي `artifacts/mobile/plugins/withReactNativeWebView.js` بدل `"react-native-webview"` في `app.json` (كان `index.js` ESM يكسر `expo config` على Node)؛ استبعاد `android/`/`ios` من `.easignore`؛ إزالة `patchedDependencies` من lockfile.

**النتيجة (25 أغسطس):** بناء `146287ef` Finished (بعد فشل `89991f75`). APK محلي `artifacts/mobile/dist/fanni.apk` (~40.3MB؛ `index.android.bundle` + `classes.dex`). صفحة البناء: https://expo.dev/accounts/haithamfakhry/projects/mobile/builds/146287ef-e88c-481e-b020-8e2be4c7fb32 — بديل ناجح سابق: `0bea6779`.

**المتبقي اليدوي (لا SSH محليًا):** WinSCP → `/var/www/fanni-web/fanni.apk` من الملف المحلي ثم `chmod 644`. التحقق: `https://app.upnexa-eg.com/fanni.apk` يجب أن يصبح ~42281277 بايت (حاليًا ما زال ~42324365 من `0d1b9846`).

### ماذا أردنا
نسخة **APK** للإنتاج مرتبطة بـ `https://api.upnexa-eg.com`، تُرفع على الـ VPS ويُحمَّل التطبيق من `https://app.upnexa-eg.com/fanni.apk` عبر WinSCP إلى `/var/www/fanni-web/fanni.apk`. الـ VPS لا يبني أندرويد.

### المشاكل التي ظهرت (بالترتيب) وما نُفِّذ

| # | العَرَض | السبب الحقيقي | الحل المنفَّذ |
|---|---|---|---|
| 1 | فشل «كل طرق» استخراج APK | سكربت `pnpm build` في الموبايل يحزّم Expo Go/Replit وليس APK؛ `eas.json` كان في جذر المستودع بينما `app.json` في `artifacts/mobile` | إبقاء `eas.json` داخل الموبايل فقط؛ بروفايل `preview` بـ `buildType: apk` و`EXPO_PUBLIC_API_URL` |
| 2 | EAS: `eas-build-pre-install` رمز 1 | `pnpm install --frozen-lockfile` بينما `package.json` على حزم SDK 54 و`pnpm-lock.yaml` كان على مواصفات SDK 55 | حُدّث الـ lockfile (`expo-clipboard` ~8، `expo-file-system` ~19.0.24، `expo-notifications` ~0.32.17، netinfo 11.4.1، Sentry 7.2.0). `eas-build-pre-install` عاد إلى `--frozen-lockfile`. على ويندوز استخدم `NODE_OPTIONS=--use-system-ca` إن فشل TLS |
| 3 | محليًا: `Run this command inside a project directory` | الأمر شُغِّل من PowerShell كمسؤول يبدأ من `C:\Windows\system32`؛ `npx eas-cli@16` لم يرَ `app.json` | سكربت `scripts/eas-apk.ps1` يثبت مجلد `artifacts/mobile` قبل البناء (`eb1687f`) |
| 4 | EAS Prebuild: `expo doctor` | `expo-file-system` كان 18.0.12 (غير موجود كـ 18.0.24 على npm لـ SDK 54)؛ netinfo 11.5.2؛ Sentry 7.13.0 | محاذاة مع `bundledNativeModules` لـ SDK 54: `expo-file-system ~19.0.24`، netinfo `11.4.1`، Sentry `7.2.0`. الـ lockfile حُدّث محلياً مع `NODE_OPTIONS=--use-system-ca`؛ `eas-build-pre-install` عاد إلى `--frozen-lockfile` |
| 5 | EAS Bundle JS: `EXPO_ROUTER_APP_ROOT` | Babel على EAS لا يحوّل `require.context(process.env.EXPO_ROUTER_APP_ROOT)` داخل `expo-router/_ctx.android.js` (pnpm: `hasModule('expo-router')` قد يفشل من `babel-preset-expo`) | ملف `metro-router-ctx.js` بمسار `./app` ثابت + `resolveRequest` يستبدل `_ctx`؛ بلجن expo-router صراحة في babel |
| 6 | EAS Bundle JS: `expo doctor` + `export:embed` | نسختان من `@react-navigation/core` (7.17.2 مباشرة و7.21.13 تحت `@react-navigation/native`) | إزالة الاعتماد المباشر 7.17.2؛ الاستيراد من `@react-navigation/native`؛ `pnpm.overrides` يثبّت `core` على 7.21.13 |
| 7 | EAS Gradle: رفع خرائط Sentry | `sentry-cli` بدون `--org` أثناء `createBundleReleaseJsAndAssets_SentryUpload` | `SENTRY_DISABLE_AUTO_UPLOAD=true` و`SENTRY_ALLOW_FAILURE=true` في بروفايلات EAS (التشغيل يبقى عبر DSN) |
| 8 | APK يُغلق فور الفتح (بدون رسالة) | بلجن `expo-router` في `babel.config.js` بعد `worklets` يكسر Reanimated في release | إزالة البلجن الإضافي؛ `metro-router-ctx.js`؛ إعادة بناء v1.0.1 |
| 10 | APK splash ثم إغلاق (فيديو 25 أغسطس) | تثبيت من `app.upnexa-eg.com`؛ شاشة FANNI تظهر ثم يقفل بلا رسالة (native). الموقع كان قد يخدم نسخة قديمة؛ مع ذلك يُشتبه أيضًا في Sentry native + KeyboardProvider عند الإقلاع | v1.0.2: تأخير Sentry بعد أول رسم مع `enableNative:false`؛ إزالة بلجن Sentry من prebuild؛ إزالة KeyboardProvider؛ ScrollView بدل keyboard-controller |
| 11 | إغلاق عند خطوة تحديد العنوان (تسجيل) | `IllegalStateException: API key not found` لـ `com.google.android.geo.API_KEY` عند إنشاء `MapView` | استبدال Google Maps بـ **OpenStreetMap + Leaflet داخل WebView** (`OsmMapView` / `OsmMultiMap`)؛ إزالة `react-native-maps`؛ v1.0.3 + `versionCode` 3 |

### تشخيص: التطبيق يظهر ثم يُغلق فورًا

هذا **ليس** خطأ API أو شبكة — غالبًا **Native crash** (Hermes/Reanimated/وحدة native) قبل أن يظهر `ErrorBoundary`. للتأكيد على جهاز أندرويد مع USB debugging:

```powershell
adb logcat *:E | Select-String -Pattern "FATAL|ReactNative|Reanimated|keyboard-controller|Sentry|com.fanni"
```

إن ظهر `Worklets` أو `Reanimated` أو `keyboard-controller` → أعد البناء بعد إصلاح babel أعلاه (`scripts/eas-apk.ps1`).

هجرات/بذور منفصلة عن APK (تمت في الكود): `021_schema_gap_repair.sql` + `pnpm --filter @workspace/db run seed` في `deploy-vps.sh` و`migrate-local.ps1`.

### الحالة الحالية

| البند | الحالة |
|---|---|
| كود الخرائط | **OSM/Leaflet WebView** — بدون Google API key؛ شاشات: تسجيل العنوان، تتبع الطلب، خريطة الأدمن |
| إصدار التطبيق | **1.0.10** / `versionCode` 10 |
| بناء EAS / APK | مسار السيرفر **`/var/www/upnexa-eg.com/fanni.apk`** — رابط `https://upnexa-eg.com/fanni.apk` |
| تسجيل حي | **نجح** — حساب جديد من الجهاز ضد الإنتاج |
| تخزين الملفات | **يعمل** — VPS يستقبل الصور المرفوعة (KYC/uploads) |
| migrate إنتاج | **024** مطبَّق (`icon` للمجالات/التخصصات) |
| الناشر | **UpNexa** — `Info@upnexa-eg.com` · https://upnexa-eg.com |
| Sentry | org **`upnexa-hb`** — مشروع موبايل **`fanni`** + API **`node`**؛ Cursor MCP متصل |
| Google Sign-In | واجهة مربوطة؛ يحتاج OAuth Client IDs على EAS + `OIDC_CLIENT_ID` على API |

---

## بوابة قبول — المحفظة والمحاسبة

### المرحلة 1 — الاقتصاد والمحفظة

- [x] قيمة النقاط والباقات محددة.
- [x] تكلفة فتح افتراضية محددة.
- [x] التسعير حسب التخصص قابل للإدارة (جدول `unlock_costs` وقواعد Lead Pricing في الواجهة).
- [x] لا يوجد تحويل نقاط بين الفنيين أو سحب نقدي.

### المرحلة 2 — حماية بيانات العميل

- [x] بيانات الاتصال مخفية قبل الفتح (API).
- [x] وصف الطلب يُنظف من وسائل الاتصال.
- [x] نقرات الاتصال وواتساب مسجلة.
- [x] الاتصال المقنّع معتمد تشغيليًا (Twilio Voice؛ يحتاج بيانات حساب في البيئة).

### المرحلة 3 — النزاعات والاستردادات

- [x] نزاع واحد لكل عملية فتح.
- [x] الاسترداد الإداري ذري وغير قابل للتكرار.
- [x] الاسترداد التلقائي للإلغاء المبكر دون تواصل.
- [x] قواعد الرقم الخاطئ وعدم الاستجابة الآلية + حد يومي.

### المرحلة 4 — التشغيل والمحاسبة

- [x] حركات النقاط مرتبطة بالطلب.
- [x] المصروفات التشغيلية لها جدول وAPI.
- [x] شاشة إدخال ومراجعة المصروفات.
- [x] ميزان مراجعة + صافي دخل القيود في شاشة الحسابات وشاشة الأستاذ.
- [ ] فترات محاسبية ومراكز تكلفة وتسوية بوابة.

### المرحلة 5 — التحقق عبر المنصات

- [x] API typecheck وmigration على بيئة التطوير.
- [ ] اختبار تدفق العميل على تطبيق الهاتف.
- [ ] اختبار تدفق الفني على تطبيق الهاتف.
- [ ] اختبار الإدارة للنزاعات والمصروفات.
- [ ] اختبار الصور في بيئة التخزين المعتمدة.

### المرحلة 6 — قرار OCR والفوترة

- [x] أُزيل رفع فواتير المشتريات وOCR من التطبيق والخادم.
- [x] أُوقف إنشاء الفواتير الثلاث عند إكمال الطلب (محاسبة عمولة Lead فقط).
- [x] مسارات كتابة الفواتير تُرجع 410؛ الجداول التاريخية محفوظة بلا DROP.
- [x] إكمال الطلب: وصف/رضا/صور عمل — بلا أجور/مواد/نقل.

## بوابة قبول — دورة الطلبات (المواصفة)

- [x] خصم Lead ذري + دفتر + إخفاء بيانات في API.
- [x] قبول يربط الخصم بالإسناد على السيرفر.
- [x] واجهة تأكيد النقاط باللهجة المصرية.
- [x] قواعد تسعير وقت/يوم من الأدمن مربوطة بالقائمة.
- [x] جيوفنس + مؤقت 30 دقيقة مفعّلان في التشغيل.
- [x] نتيجة الخدمة (نعم/لا + أسباب) في التطبيق.
- [x] استرداد استثنائي عبر النزاع/أدمن دون خصم من التطبيق.

---

---

## ملخص الجلسات 30 أغسطس → 05 سبتمبر 2026

**HEAD الحالي:** `a9d3e6e` · **ملف فجوات:** [`E2E_GAP_SOLUTIONS_REPORT.md`](E2E_GAP_SOLUTIONS_REPORT.md).

### أ) تشغيل محلي ويندوز + مسار المشروع (01–05 سبتمبر)

- نقل/تثبيت على `E:\\UpNexa.com\\fanni`؛ تقسيم env محلي/إنتاج؛ سكربتات تشغيل ويندوز (`run-fanni`, `UPDATE_ALL`, safe-push).
- إصلاحات متكررة لـ pnpm/junctions على ويندوز: `repair-node-modules`، إصلاح `@esbuild/win32-x64`، `expo-font`، `@sentry/core`، `chrome-launcher`.
- Metro: تضييق `watchFolders` ومنع `.map` للتبعيات؛ بدء Expo offline عند التعليق.
- توحيد مكدس API المحلي وإيقاف إطلاق سيرفرين مزدوجين؛ تقوية `dev.mjs` حتى لا يكسرها cwd من Desktop.
- إزالة سكربتات بالية وفك تكرار حزم Expo من الجذر + overrides؛ typecheck موبايل يمر.

### ب) منتج / مطابقة / محفظة / أدمن (31 أغسطس – 05 سبتمبر)

- موقع خدمة يومي + بث WebSocket متوافق؛ مطابقة فني بالمهنة والجغرافيا؛ `categoryMatch` لـ UUID المجال → فئة الطلب.
- قبول الطلب مشروط برصيد المحفظة الحي؛ رفض الطلب (`decline`) = إخفاء إشعار فقط مع بقاء الطلب pending لباقي الفنيين.
- عنوان الطلب الجديد من ملف العميل؛ إصلاح بوابة محافظة المطابقة وإزالة شريط sync العالق.
- موافقة أدمن على الويب بتأكيد؛ نقاط الترحيب **بعد** التأكيد فقط؛ تهنئة فني قابلة للإغلاق.
- بونص Super Admin + توثيق رحلة الطلب E2E؛ تحديث رصيد المحفظة حيًا لشاشات الأدمن/الفني.
- إصلاح رفع الصور (MIME)؛ محاذاة بوابة موافقة الفني مع قائمة pending الأدمن.
- تعليق حساب بسبب إلزامي + تدقيق؛ إصلاح قوائم الأطراف SQL؛ خريطة أدمن `map-data` قبل catch-all.
- دخول ويب عبر AsyncStorage؛ خروج آمن للمتصفح؛ تطبيع معرّفات الدخول لكل الأدوار.
- نشر ويب/APK: مسار `app.upnexa-eg.com` + خدمة APK من `upnexa-eg.com`.

### ج) E2E Playwright (31 أغسطس – 05 سبتمبر)

| Commit | الموضوع |
|---|---|
| faabd86 — حزمة Playwright + LambdaTest + smoke إنتاج |
| 823f913 — full-app مع لقطات وفيديو (`full-recorded`) |
| bfacc5a — حراسة ضد كتابة بيانات وهمية على الإنتاج |
| e624108 — مسار متصفح Playwright + قبول URL لوحة الأدمن |
| 3c3dbb1 — **logic-suite**: محفظة / دورة طلب / استرداد |
| 099bc68 — unwrap محفظة، كاش دخول، دوائر حافة |
| 42172bc — تسجيل دخول UI افتراضيًا لالتقاط فيديو حقيقي |

- مشاريع: `local-chrome`، `full-recorded`، `logic-suite`؛ متصفحات تحت `e2e/.playwright-browsers`.
- تشغيل موصى به محليًا: `E2E_USE_LOCAL=1` + `scripts\\run-e2e-logic-suite.cmd` (آخر تشغيل معروف: ~22 ناجح / 1 skipped).
- توثيق: `e2e/LOGIC_SCRIPTS.md`، `e2e/CLOUD_E2E.md`، `E2E_360_REPORT.md`.

### د) تحليل الثغرات والحلول (05 سبتمبر مساءً)

- مراجعة تقرير الفجوات (محفظة، جغرافيا، نزاعات، أمان) مقابل الكود.
- تقرير الحلول: **`E2E_GAP_SOLUTIONS_REPORT.md`** — ما تم / جزئي / مفتوح + P0–P2.
- **مُوافق عليه للتنفيذ (لم يُبرمج بعد في جولة التوثيق هذه):** unique لمرجع الشحن، فلتر PII على وصف الطلب، فرض `mustChangePassword` على APIs الأدمن المالية، إيصال إلزامي، سقف `BROADCAST_RADIUS_TIERS_KM`، اختبار سباق قبول متزامن.

### المتبقي الحي بعد هذه الجولة

1. تنفيذ حزمة سد ثغرات P0/P1 من تقرير الفجوات.
2. Live-pass كامل على جهاز حقيقي (طلب→قبول→وصول→إكمال).
3. OPay / Twilio بيئة / فترات GL المتقدمة.
4. صورة العميل في شاشات الفني + ملف شخصي كامل + طلبات أدمن من API (بدل mock إن بقي).


## سجل التحديثات المختصر

| التاريخ | المرحلة | ما تم | المتبقي |
|---|---|---|---|
| 05 سبتمبر 2026 | E2E + تشغيل ويندوز + فجوات | logic-suite/full-recorded + حراسة إنتاج؛ مطابقة فني/decline/موافقة ترحيب؛ إصلاحات ويندوز/Metro؛ تقرير `E2E_GAP_SOLUTIONS_REPORT.md`؛ HEAD `a9d3e6e`؛ إعادة بناء قاموس Commits بعد تلف | تنفيذ P0 فجوات (مرجع شحن/PII/mustChangePassword)؛ Live-pass جهاز؛ OPay/Twilio/GL |
| 30 أغسطس 2026 | تقرير تحديث مفصّل | `deploy/UPDATE-REPORT.md` (DB/API/Front/APK محلي+إنتاج)؛ مسار APK **`/var/www/upnexa-eg.com/fanni.apk`**؛ إصلاح `local-update` + `dev.mjs` | EAS APK → رفع المسار الصحيح؛ `deploy-vps.sh` |
| 29 أغسطس 2026 | إطلاق 1.0.9 | رفع الإصدار `1.0.9`/`versionCode` 9؛ تصدير ويب `dist-web`؛ EAS APK؛ خطوات تحديث VPS كاملة في `deploy/VPS-STEPS.md` (migrate **024** + ويب + APK) | (استُبدِل بـ 1.0.10) |
| 29 أغسطس 2026 | جلسة UX + أدمن | quality-loop؛ إصلاحات ميدان 29-08؛ رفض تخطي صور البطاقة؛ أدمن API/خرائط/كتالوج؛ سكربت extract-docx (`77a9574`→`e4e12fd`) | migrate **024**؛ APK جديد؛ صورة عميل؛ ملف شخصي؛ OPay؛ طلبات أدمن من API |
| 27 أغسطس 2026 | تشغيل حي — بوابة جزئية | migrate **023** على VPS؛ APK **1.0.8** منشور ومثبت؛ تسجيل حساب جديد نجح؛ تخزين الصور يستقبل الرفع | إكمال Live-pass (طلب→Lead→أدمن)؛ ضبط Google OAuth؛ Twilio/OPay مؤجّل |
| 27 أغسطس 2026 | Google + إصدار | دخول عبر Google بدل Replit؛ عرض الإصدار `1.0.8` بلا أقواس؛ ملكية UpNexa على شاشة الدخول (`62ca586`) | Client IDs في EAS + VPS |
| 27 أغسطس 2026 | UX فني + صور | ساعات عمل، محفظة موافقة، شريط اتصال، صور ملف شخصي (`e4787ac`) | (مدمج في APK 1.0.8) |
| 26 أغسطس 2026 | اتصال + أنيميشن + E2E 360 | رسائل auth حقيقية؛ تسجيل يتخطى PostGIS؛ إصلاح MapPicker FAB؛ توحيد getApiBase/getWsUrl؛ خطة E2E 360 في SPEC | (استُكمِل جزئيًا تشغيلًا في 27 أغسطس) |
| 26 أغسطس 2026 | باقات Word + v1.0.5 | سلم 100/250/500/750/1000؛ migration 022؛ رفع versionCode 5؛ تجهيز EAS شبه نهائي | migrate على VPS؛ Finished → WinSCP |
| 26 أغسطس 2026 | محاسبة عمولة فقط | إكمال بلا labour/مواد؛ 410 على كتابة الفواتير؛ إخفاء تبويبات الفواتير؛ مقارنة 7 مواصفات Word؛ تحديث OCR/SPEC/REVIEW | (يُغطّى في بناء v1.0.5) |
| 26 أغسطس 2026 | APK v1.0.4 EAS Finished | بناء `60610e5a` نجح (1.0.4 / versionCode 4)؛ Sentry JS monitor على `fanni-app`؛ APK محلي `dist/fanni.apk` | تثبيت + تحقق Sentry → ثم rebuild بعد قرار الفواتير |
| 26 أغسطس 2026 | APK v1.0.4 + Sentry monitor | توحيد Sentry.init + wrap + ErrorBoundary + user tags؛ `enableNative: false`؛ بدء EAS preview v1.0.4 | (استُكمِل — `60610e5a`) |
| 26 أغسطس 2026 | APK v1.0.4 — تثبيت قبل البناء | إزالة `keyboard-controller`؛ نقل الحزم الأصلية إلى `dependencies`؛ حذف `android/` المحلي القديم؛ تنظيف metro maps stub؛ `packageManager: pnpm@10.15.1` | بناء EAS preview v1.0.4 → WinSCP |
| 26 أغسطس 2026 | APK v1.0.4 — دمج PRs | دمج PR #1 (توثيق EAS `bae7ee22`) + PR #2 (`--frozen-lockfile` + lockfile نظيف)؛ رفع الإصدار إلى **1.0.4** / `versionCode` 4؛ إزالة `.idea` من Git | بناء EAS v1.0.4 عند الحاجة؛ رفع APK للموقع |
| 26 أغسطس 2026 | APK v1.0.3 EAS Finished | إصلاح `react-native-webview`/`expo config` (بلجن محلي)؛ فشلان `08c6ea00`/`51a8992e`؛ بناء ناجح `bae7ee22`؛ APK `artifacts/mobile/dist/fanni.apk` (~96.8MB) | (استُكمِل — APK مُثبَّت محليًا) |
| 25 أغسطس 2026 | APK v1.0.3 OSM | استبدال Google Maps بـ OSM/Leaflet WebView؛ إزالة `react-native-maps`؛ تحسين دبوس/شريط العنوان؛ commit `1d8866f`؛ إزالة بلجن webview الخاطئ من `app.json` (كان يكسر `expo config`)؛ إعادة EAS | (استُكمِل في 26 أغسطس — `bae7ee22`) |
| 25 أغسطس 2026 | APK crash-fix + rebuild | فشل `89991f75` (New Arch off ↔ Reanimated 4)؛ إعادة New Arch؛ بناء `146287ef` v1.0.1؛ APK محلي صالح | WinSCP → `/var/www/fanni-web/fanni.apk` ثم `chmod 644`؛ تثبيت من الرابط الجديد على الهاتف |
| 25 أغسطس 2026 | APK / EAS — إغلاق البناء | ثلاث محاولات EAS؛ إصلاح lockfile SDK 54، تكرار `@react-navigation/core`، `EXPO_ROUTER_APP_ROOT`، رفع Sentry؛ بناء ناجح `0d1b9846` | (استُبدِل ببناء `146287ef` بعد إصلاح crash + New Arch) |
| 24 أغسطس 2026 | APK / EAS — تشخيص | lockfile مجمّد + eas من system32؛ pre-install و`eas-apk.ps1`؛ توثيق WinSCP | (استُكمِل في 25 أغسطس) |
| 24 أغسطس 2026 | نقل محلي + مسار GitHub | تثبيت pnpm؛ migrate 20/20 على Postgres المحلي؛ API على :3000 (`/healthz` 200)؛ CI + Deploy workflows؛ bootstrap VPS من GitHub | أسرار GitHub SSH ثم دفع `main`؛ e2e حي؛ Twilio؛ OPay؛ فترات GL |
| 23 أغسطس 2026 | تقفيلة رفع VPS | Twilio مؤجّل؛ خطوات `deploy/VPS-STEPS.md`؛ السكربت يحمّل `.env` ولا يضيف مفاتيح Twilio | تشغيل الخطوات على أصل Ubuntu |
| 23 أغسطس 2026 | تأكيد migrate 020 | إعادة تشغيل `pnpm --filter @workspace/db run migrate`: كل 20 ملفًا مطبّقة مسبقًا (020 موجود على Postgres المحلي) | KYC VPS، e2e حي، Twilio بيئة، OPay، VPS، إكمال GL (فترات/مراكز/تسوية) |
| 23 أغسطس 2026 | قيد مزدوج + IA أدمن | migration 020؛ قيود على الشحن/الهدية/الفتح/الاسترداد/المصروف؛ ميزان مراجعة؛ 7 تبويبات أدمن | e2e حي، Twilio بيئة، OPay، VPS |
| 23 أغسطس 2026 | شريحة دفتر الأستاذ | قيد مزدوج أول: 020 + ترحيل (شحن/ترحيب/فتح/استرداد/مصروف) + ميزان وقيود في الأدمن + اختبارات الوحدة. طُبّق 020 محليًا | فترات/مراكز تكلفة، تسوية بوابة، واجهة نسبة الرسوم، e2e، Twilio، OPay، VPS |
| 23 أغسطس 2026 | استكمال مهام | KYC pending_review عند رفع البطاقة؛ استرداد نزاع آلي بحد يومي؛ شاشة تدقيق أدمن؛ migration 019 | e2e حي، GL مزدوج، Twilio، IA الأدمن، OPay، VPS |
| 22 أغسطس 2026 | تجميد السجل | تحديث الحالة الحيّة + قائمة 11 مهمة مربعة للاستئناف + قاموس الهاشات حتى e06bf79 | ابدأ من بند 1 (migrate) ثم 2 (KYC) |
| 22 أغسطس 2026 | نقطة استئناف | تجميد المرحلة: 13/24 حوكمة منتهية؛ قائمة 11 بندًا للاستئناف من migrate ثم KYC | البنود 1–11 في قسم يحتاج استكمالًا |
| 22 أغسطس 2026 | قائمة TODO حوكمة | جرد Module by Module: 13 منتهية و11 متبقية من 24 بندًا | KYC VPS، قيد مزدوج، e2e، Twilio، IA الأدمن |
| 22 أغسطس 2026 | تدقيق مالي | تسجيل admin_audit_logs على المحفظة والشحن والنزاع والتسعير والمصروفات + GET /admin/audit-logs | KYC VPS، قيد مزدوج، نزاع الرقم الخاطئ الآلي |
| 22 أغسطس 2026 | M4 محافظ + شروط | فصل Promotional/Purchased مع استهلاك الترويجي أولاً؛ شروط استخدام في التسجيل؛ بطاقات الباقات تعرض المكافأة | Audit مالي، KYC على VPS، e2e، OPay |
| 22 أغسطس 2026 | M0+M4 تنفيذ | CORS من CORS_ORIGINS؛ حد رفع؛ تخزين خاص بلا makePublic؛ باقات 100–500 (+20…+100)؛ ترحيب 60 مع تسوية +10؛ محول دفع يدوي/OPay | OPay حي، Audit مالي، GL، KYC على VPS، e2e |
| 22 أغسطس 2026 | مواصفة موحّدة | دمج وحدات TXT النهائية مع الكود وأفضل الممارسات في SPEC_BASELINE.md؛ حسْم 60 نقطة ترحيب وباقات 20% وRBAC | سد M0 ثم محاذاة المحفظة |
| 22 أغسطس 2026 | قائمة مواصفات موحّدة | دمج 7 وحدات نهائية + أفضل ممارسات في `SPEC_BASELINE.md` و`TERMS_OF_USE.md`؛ توحيد `requireAdmin` على المال | اقتصاد الباقات/الهدية، CORS، حد معدّل، KYC خاص |
| 22 أغسطس 2026 | OCR + اتصال مقنّع | إزالة OCR لفواتير المشتريات؛ اتصال مقنّع Twilio Voice مع إخفاء الأرقام | مصروفات تشغيلية، تخزين صور، اختبارات تدفق |
| 22 أغسطس 2026 | واجهة دورة الطلبات | حوار «قبل ما نكمّل»، شاشة Lead Pricing، جيوفنس `en_route` مع مؤقت 30 دقيقة، سؤال نتيجة الخدمة | مصروفات تشغيلية، اتصال مقنّع، اختبارات تدفق |
| 22 أغسطس 2026 | مرجع التطور | تقرير شامل في هذا الملف + تسجيل تلقائي لكل Commit في قاموس الهاش | إكمال واجهة دورة الطلبات والتسعير الجغرافي |
| 22 أغسطس 2026 | دورة الطلبات API | قبول Lead ذري، fail-service، مهلة وصول في الكود، migration 015 | شاشات الفني/الأدمن/الجيوفنس الحي |
| 22 أغسطس 2026 | المتابعة الآلية | أمر تحديث سجل المراحل | استخدامه بعد كل مرحلة مكتملة |
| 22 أغسطس 2026 | OCR والفواتير | فشل OCR غير مانع مع إدخال يدوي | اختبار طلب فعلي والفواتير الثلاث |
| 20 أغسطس 2026 | المحفظة والمحاسبة | باقات وتكلفة فتح ومصروفات ونزاعات | تقرير صافي الربح وتخزين الصور |

## ضوابط قبل النشر

- لا تُعدّل إعدادات الإنتاج أو تُنشر قبل إغلاق بوابات القبول أعلاه.
- أي تغيير في قيم seed يجب أن يصاحبه migration idempotent.
- لا يُحذف OCR أو فواتير المواد قبل مراجعة أثر الحذف على إغلاق الطلب والمحاسبة.
- مفاتيح التخزين والاتصال في Secrets فقط، ليست في الكود ولا في هذا الملف.
- هذا الملف يُحدَّث بالإضافة فقط (لا حذف لصفوف القاموس أو سجل المراحل).

## قاموس الـ Commits

سجل تلقائي بعد كل `git commit`. لا يُعاد كتابة الصفوف السابقة؛ يُضاف صف جديد لكل هاش فريد.
(أُعيد بناء القاموس في 05 سبتمبر 2026 بعد تلف صفوف قديمة؛ الصفوف التالية من `git log` عبر `pnpm review:seed`.)

| التاريخ | الهاش | الرسالة | أبرز الملفات |
|---|---|---|---|
| 05 سبتمبر 2026 | `42172bc` | Enable UI login by default so logic E2E videos capture real screens. | e2e/LOGIC_SCRIPTS.md, e2e/tests/helpers/ui.ts, scripts/run-e2e-logic-suite.cmd |
| 05 سبتمبر 2026 | `099bc68` | Harden logic E2E: wallet unwrap, login cache, and edge circles. | e2e/tests/helpers/apiClient.ts, e2e/tests/helpers/ui.ts, e2e/tests/logic/10-wallet-points.spec.ts, e2e/tests/logic/20-order-lifecycle.spec.ts +2 |
| 05 سبتمبر 2026 | `3c3dbb1` | Add full business-logic E2E suite for wallet, orders, and refunds. | .gitignore, e2e/.env.example, e2e/LOGIC_SCRIPTS.md, e2e/package.json +11 |
| 05 سبتمبر 2026 | `e624108` | Fix E2E runner browser path and accept admin dashboard URL. | .gitignore, e2e/tests/full-app/10-role-hubs.spec.ts, scripts/run-e2e-full-recorded.cmd |
| 05 سبتمبر 2026 | `bfacc5a` | Guard scripts and E2E against writing junk data to production. | .github/workflows/e2e-playwright.yml, artifacts/api-server/scripts/sentry-test-events.mjs, artifacts/api-server/src/index.ts, e2e/.env.example +18 |
| 05 سبتمبر 2026 | `823f913` | Enable full-app E2E with screenshots and video recording. | .github/workflows/e2e-playwright.yml, e2e/.env.example, e2e/CLOUD_E2E.md, e2e/package.json +9 |
| 31 أغسطس 2026 | `faabd86` | Add Playwright E2E package with LambdaTest cloud and production smoke tests. | .env.example, .gitignore, e2e/.env.example, e2e/lambdatest.config.ts +7 |
| 29 أغسطس 2026 | `56039ee` | Fix ESLint errors and hook ordering across mobile and API packages. | .eslintrc.cjs, artifacts/api-server/src/lib/orderBroadcaster.ts, artifacts/api-server/src/lib/settings/index.ts, artifacts/api-server/src/routes/admin-geo.ts +19 |
| 29 أغسطس 2026 | `0c55284` | Log 29 Aug session summary in project development review. | PROJECT_DEVELOPMENT_REVIEW.md |
| 29 أغسطس 2026 | `8fc6e12` | Update project review log date after quality-loop commit. | PROJECT_DEVELOPMENT_REVIEW.md |
| 27 أغسطس 2026 | `5093342` | Clean workspace junk: drop attached_assets, dumps, and ignore build artifacts. | .gitignore, ".tmp-spec-extract/AsliTools-Website-\330\252\330\255\331\210\331\212\331\204-TXT-\330\245\331\204\331\211-Markdown (1).en.txt", ".tmp-spec-extract/AsliTools-Website-\330\252\330\255\331\210\331\212\331\204-T |
| 27 أغسطس 2026 | `4f024aa` | Fix web image uploads: use Blob FormData and file picker on browser. | artifacts/mobile/app/register.tsx, artifacts/mobile/utils/appendImageToFormData.ts, artifacts/mobile/utils/pickPhoto.ts, artifacts/mobile/utils/uploadPhoto.ts +1 |
| 05 سبتمبر 2026 | `a9d3e6e` | chore: local UPDATE_ALL refresh (2026-09-05 23:12) | E2E_GAP_SOLUTIONS_REPORT.md |
| 05 سبتمبر 2026 | `af0e1ef` | E2E test configuration | .github/workflows/e2e-playwright.yml, artifacts/api-server/src/routes/technicians.ts, artifacts/mobile/app/(tech)/available-orders.tsx, artifacts/mobile/context/OrderContext.tsx +2 |
| 05 سبتمبر 2026 | `4a709a0` | Keep declined pending orders visible for techs; treat decline as notification dismiss only. | artifacts/api-server/src/lib/orderLifecycle.ts, artifacts/api-server/src/routes/orders.ts, artifacts/api-server/src/routes/technicians.ts, artifacts/mobile/app/(tech)/available-orders.tsx +2 |
| 05 سبتمبر 2026 | `500c3d5` | Unify local run scripts on one Fanni API stack and stop dual-server launchers. | deploy/LOCAL-AND-PROD-ENV.md, package.json, scripts/run-fanni.cmd, scripts/run-local-mobile.cmd +3 |
| 05 سبتمبر 2026 | `8033820` | Fix tech order matching by governorate, default new-order address from profile, and remove stuck sync banner hairline. | artifacts/api-server/src/lib/categoryMatch.ts, artifacts/api-server/src/lib/orderBroadcaster.ts, artifacts/api-server/src/routes/orders.ts, artifacts/api-server/src/routes/technicians.ts +8 |
| 05 سبتمبر 2026 | `55f1c93` | Fix admin approve flow: confirm on web, grant welcome points only after confirm, and dismissible tech congrats. | artifacts/api-server/src/index.ts, artifacts/api-server/src/lib/sms.ts, artifacts/api-server/src/routes/admin.ts, artifacts/mobile/app/(admin)/(tabs)/pending.tsx +1 |
| 05 سبتمبر 2026 | `c774e7f` | chore: local UPDATE_ALL refresh (2026-09-05 13:44) | artifacts/mobile/app/(tech)/_layout.tsx |
| 05 سبتمبر 2026 | `bca89d0` | Fix image upload MIME rejection and align tech approval gating with admin pending. | .gitignore, artifacts/api-server/src/lib/fileStorage.ts, artifacts/api-server/src/routes/admin.ts, artifacts/api-server/src/routes/upload.mime.test.ts +8 |
| 05 سبتمبر 2026 | `4a09e47` | Update project development review log after recent local and API script changes. | PROJECT_DEVELOPMENT_REVIEW.md |
| 05 سبتمبر 2026 | `8953d65` | Harden local API start script so Desktop cwd cannot break pnpm. | scripts/run-local-server.cmd |
| 05 سبتمبر 2026 | `2bb5368` | chore: local UPDATE_ALL refresh (2026-09-05 13:09) | scripts/fix-windows-deps.ps1 |
| 04 سبتمبر 2026 | `45dd879` | Harden Metro on Windows by narrowing watchFolders and blocking dependency .map files. | artifacts/mobile/metro.config.js |
| 04 سبتمبر 2026 | `62da84d` | Auto-repair incomplete chrome-launcher installs that break Expo on Windows. | scripts/fix-windows-deps.ps1 |
| 04 سبتمبر 2026 | `99b17df` | Auto-repair incomplete @sentry/core installs on Windows after pnpm extract failures. | scripts/fix-windows-deps.ps1 |
| 04 سبتمبر 2026 | `2a87373` | Wire tech order matching to profession and geo, and gate accept on live wallet balance. | artifacts/api-server/src/lib/categoryMatch.test.ts, artifacts/api-server/src/lib/categoryMatch.ts, artifacts/api-server/src/lib/orderBroadcaster.ts, artifacts/api-server/src/routes/technicians.ts +7 |
| 04 سبتمبر 2026 | `4b310c1` | Add categoryMatch helper to resolve service-domain UUIDs to canonical order categories. | artifacts/api-server/src/lib/categoryMatch.ts |
| 04 سبتمبر 2026 | `bfcae70` | Clarify E2E credential placeholders in e2e/.env.example for client, tech, and admin. | e2e/.env.example |
| 04 سبتمبر 2026 | `5ce9e35` | Remove the stuck WebSocket ConnectionBanner strip from client and tech layouts. | artifacts/mobile/app/(client)/_layout.tsx, artifacts/mobile/app/(tech)/_layout.tsx |
| 04 سبتمبر 2026 | `c813b3a` | set final before test | scripts/deploy-vps-from-local.ps1, scripts/remote-install-from-zip.sh |
| 04 سبتمبر 2026 | `e8c7705` | Auto-repair corrupted expo-font and @sentry/react-native packages during Windows deps fix. | scripts/fix-windows-deps.ps1, scripts/repair-node-modules.ps1 |
| 04 سبتمبر 2026 | `5eef28d` | Auto-repair broken @esbuild/win32-x64 junctions in fix-windows-deps after pnpm wipe. | scripts/fix-windows-deps.ps1 |
| 04 سبتمبر 2026 | `a344c56` | Remove obsolete scripts, harden Windows pipeline helpers, and unblock mobile typecheck. | UPDATE_ALL.ps1, artifacts/mobile/sentry-react-native.d.ts, deploy/LOCAL-AND-PROD-ENV.md, scripts/deploy-vps-from-local.ps1 +13 |
| 04 سبتمبر 2026 | `f14a99f` | Skip prepare git-hooks install when the hook script is missing so pnpm install can finish. | package.json |
| 04 سبتمبر 2026 | `ae232d4` | Harden repair-node-modules so Full clean no longer wipes pnpm workspace sources via junctions. | scripts/repair-node-modules.ps1 |
| 04 سبتمبر 2026 | `ffd1cd2` | Bump PROJECT_DEVELOPMENT_REVIEW last-reviewed date to 04 Sep 2026. | PROJECT_DEVELOPMENT_REVIEW.md |
| 04 سبتمبر 2026 | `076b09f` | Add repair-node-modules script for corrupted pnpm installs after interrupted deletes. | package.json, scripts/repair-node-modules.ps1 |
| 04 سبتمبر 2026 | `329e26f` | Refresh pnpm-lock.yaml after removing root Expo duplicates. | pnpm-lock.yaml |
| 04 سبتمبر 2026 | `a985806` | Deduplicate Expo native modules by removing root expo deps and pinning overrides. | .npmrc, artifacts/mobile/package.json, package.json, pnpm-workspace.yaml |
| 04 سبتمبر 2026 | `49b6ba9` | Add UPDATE_ALL pipeline and fix apk-check PowerShell parse errors. | UPDATE_ALL.ps1, package.json, scripts/apk-check.ps1, update_all.bat |
| 04 سبتمبر 2026 | `aa46daa` | Fix safe-push env tracking check under PowerShell Stop mode. | scripts/git-push-safe.ps1 |
| 04 سبتمبر 2026 | `645d401` | Fix git-push-safe.ps1 PowerShell parsing on Windows. | scripts/git-push-safe.ps1 |
| 04 سبتمبر 2026 | `6bb4184` | Harden gitignore and safe push after repo move; soften APK doctor preflight. | .gitignore, artifacts/mobile/.easignore, artifacts/mobile/.gitignore, package.json +3 |
| 03 سبتمبر 2026 | `754c54f` | انتهاء النقل | PROJECT_DEVELOPMENT_REVIEW.md, package.json |
| 03 سبتمبر 2026 | `95042c2` | fix: update pnpm-lock.yaml | pnpm-lock.yaml |
| 02 سبتمبر 2026 | `2c7399a` | expo install | package.json, pnpm-lock.yaml |
| 02 سبتمبر 2026 | `96eb521` | chore: add app.json and eas.json | app.json, eas.json |
| 02 سبتمبر 2026 | `15f3b74` | Update project development review date to September 2026. | PROJECT_DEVELOPMENT_REVIEW.md |
| 02 سبتمبر 2026 | `7b16305` | Stage fanni.apk in web deploy so app.upnexa-eg.com serves the APK download. | artifacts/mobile/constants/appIdentity.ts, deploy/WEB-APP-UPNEXA.md, deploy/nginx-app.upnexa-eg.com.conf, scripts/deploy-vps.sh +5 |
| 02 سبتمبر 2026 | `16043ba` | Simplify tech work-hours picker and fix web input focus scrolling. | artifacts/mobile/app/(tech)/profile.tsx, artifacts/mobile/app/register.tsx, artifacts/mobile/components/FanniInput.tsx, artifacts/mobile/components/KeyboardAwareScrollViewCompat.tsx +4 |
| 02 سبتمبر 2026 | `a9c92d6` | Fix web deploy path so app.upnexa-eg.com assets publish correctly. | deploy/WEB-APP-UPNEXA.md, scripts/export-web.ps1, scripts/publish-fanni-web.sh, scripts/update_server.sh +1 |
| 02 سبتمبر 2026 | `b6aa699` | Normalize login identifiers across auth flows for all user roles. | artifacts/api-server/src/lib/phone.test.ts, artifacts/api-server/src/lib/phone.ts, artifacts/api-server/src/routes/admin.ts, artifacts/api-server/src/routes/auth.ts +10 |
| 01 سبتمبر 2026 | `ffd683d` | Create update_all.bat | update_all.bat |
| 01 سبتمبر 2026 | `2fedb12` | Align WebSocket order broadcast with daily service location. | artifacts/api-server/src/lib/orderBroadcaster.ts, artifacts/api-server/src/lib/serviceLocation.ts, artifacts/mobile/components/ServiceLocationDailyModal.tsx, artifacts/mobile/context/TechWsContext.tsx |
| 01 سبتمبر 2026 | `00556d0` | Fix tech approval refresh and add daily service location matching. | artifacts/api-server/src/lib/addressCompleteness.ts, artifacts/api-server/src/lib/serviceLocation.ts, artifacts/api-server/src/routes/admin.ts, artifacts/api-server/src/routes/auth.ts +23 |
| 01 سبتمبر 2026 | `af396c6` | Update project development review date to September 2026. | PROJECT_DEVELOPMENT_REVIEW.md |
| 01 سبتمبر 2026 | `9d53849` | Remove conflicting --offline flag from Expo start args. | artifacts/mobile/scripts/dev-start.js |
| 01 سبتمبر 2026 | `f7e31ae` | Fix Expo Metro hang on Windows by starting offline. | artifacts/mobile/scripts/dev-start.js, scripts/run-local-mobile.cmd, scripts/run-mobile-prod-api.cmd |
| 01 سبتمبر 2026 | `cf639d3` | Fix Windows local dev: deps, Jest, and run scripts for E: path. | .npmrc, artifacts/api-server/package.json, artifacts/api-server/src/lib/bonusGrants.test.ts, artifacts/mobile/jest.config.js +11 |
| 01 سبتمبر 2026 | `8edaf31` | Add local/prod env split and Windows run scripts for new project path. | .env.example, .env.local.example, .env.production.example, .gitignore +15 |
| 31 أغسطس 2026 | `52eab60` | Add live wallet balance refresh for admin and technician screens. | artifacts/api-server/src/lib/walletSummary.test.ts, artifacts/api-server/src/lib/walletSummary.ts, artifacts/api-server/src/routes/wallet.ts, artifacts/mobile/app/(tech)/_layout.tsx +5 |
| 31 أغسطس 2026 | `60cb9c0` | Fix missing bonus grant button by using correct permissions API. | artifacts/api-server/src/routes/wallet.ts, artifacts/mobile/components/admin/TechBonusGrantsPanel.tsx |
| 31 أغسطس 2026 | `7f4340a` | Update project development review date after bonus grants release. | PROJECT_DEVELOPMENT_REVIEW.md |
| 31 أغسطس 2026 | `6781887` | Add Super Admin bonus grants, order journey E2E docs, and test hooks. | artifacts/api-server/src/lib/bonusGrants.test.ts, artifacts/api-server/src/lib/bonusGrants.ts, artifacts/api-server/src/routes/wallet.ts, artifacts/mobile/app/(admin)/(tabs)/users.tsx +19 |
| 31 أغسطس 2026 | `bd76978` | Fix admin Sentry front test on web by relaying through API. | artifacts/api-server/src/lib/mobileSentryRelay.test.ts, artifacts/api-server/src/lib/mobileSentryRelay.ts, artifacts/api-server/src/lib/sentryConfig.test.ts, artifacts/api-server/src/lib/sentryConfig.ts +3 |
| 31 أغسطس 2026 | `50b54cd` | Disable Playwright video capture in E2E runs to reduce artifact size. | e2e/playwright.config.ts |
| 30 أغسطس 2026 | `3fd86cd` | Refresh E2E 360 report for v1.0.10, pending deploy, and Live-pass checklist. | E2E_360_REPORT.md |
| 30 أغسطس 2026 | `3cfea2d` | Add account suspension with required reason, audit trail, and user notices. | artifacts/api-server/src/routes/admin.ts, artifacts/api-server/src/routes/auth.ts, artifacts/mobile/app/(admin)/(tabs)/users.tsx, artifacts/mobile/app/_layout.tsx +4 |
| 30 أغسطس 2026 | `72bac74` | Fix admin parties lists by correcting GET /admin/users SQL and surfacing load errors. | artifacts/api-server/src/routes/admin.ts, artifacts/mobile/app/(admin)/(tabs)/users.tsx |
| 30 أغسطس 2026 | `2b09844` | Clear ESLint noise: fix escapes, empty catches, any types, and safe hook deps. | artifacts/api-server/src/lib/locationNormalizer.ts, artifacts/api-server/src/lib/orderBroadcaster.ts, artifacts/api-server/src/lib/settings/index.ts, artifacts/api-server/src/routes/auth.ts +31 |
| 30 أغسطس 2026 | `85d806e` | Fix web logout by replacing Alert.alert with a browser-safe confirm dialog. | artifacts/mobile/app/(admin)/(tabs)/profile.tsx, artifacts/mobile/app/(client)/profile.tsx, artifacts/mobile/app/(tech)/profile.tsx, artifacts/mobile/app/tech-pending.tsx +3 |
| 30 أغسطس 2026 | `4ae6518` | Fix admin map-data 404 by mounting geo routes before the catch-all handler. | artifacts/api-server/src/index.ts, artifacts/api-server/src/routes/admin-geo.ts, artifacts/api-server/src/routes/index.ts, artifacts/mobile/constants/appIdentity.ts |
| 30 أغسطس 2026 | `617e7c6` | Fix web login session storage by using AsyncStorage instead of SecureStore. | artifacts/mobile/app/(admin)/(tabs)/profile.tsx, artifacts/mobile/app/(admin)/add-admin.tsx, artifacts/mobile/app/login.tsx, artifacts/mobile/app/register.tsx +4 |
| 30 أغسطس 2026 | `ad2352f` | Sentry_Plugin | .cursor/settings.json |
| 30 أغسطس 2026 | `d24f5cd` | Document local/prod update steps and correct APK path to upnexa-eg.com. | PROJECT_DEVELOPMENT_REVIEW.md, deploy/UPDATE-REPORT.md, deploy/VPS-STEPS.md, deploy/WEB-APP-UPNEXA.md +1 |
| 30 أغسطس 2026 | `82ba3af` | Fix Windows local API startup by replacing broken cross-env with a Node script. | artifacts/api-server/package.json, artifacts/api-server/scripts/dev.mjs, scripts/local-update.ps1 |
| 30 أغسطس 2026 | `d32c9f1` | Add local deploy scripts and expand VPS guide for C:\Fanni workflow. | PROJECT_DEVELOPMENT_REVIEW.md, deploy/VPS-STEPS.md, deploy/WEB-APP-UPNEXA.md, package.json +4 |
| 30 أغسطس 2026 | `2247438` | Document VPS rollout and Sentry checks for release 1.0.10. | PROJECT_DEVELOPMENT_REVIEW.md, deploy/SENTRY-MCP.md, deploy/VPS-STEPS.md, deploy/env.production.example |
| 30 أغسطس 2026 | `5e16d0e` | Add Sentry test hooks and align monitoring to upnexa-hb for release 1.0.10. | PROJECT_DEVELOPMENT_REVIEW.md, artifacts/api-server/package.json, artifacts/api-server/scripts/sentry-test-events.mjs, artifacts/api-server/src/lib/sentryConfig.test.ts +9 |
| 30 أغسطس 2026 | `ed655a0` | Centralize Sentry config and wire Cursor MCP for Fanni. | .cursor/mcp.json, artifacts/api-server/src/lib/sentryConfig.test.ts, artifacts/api-server/src/lib/sentryConfig.ts, artifacts/api-server/src/middlewares/authMiddleware.ts +8 |
| 30 أغسطس 2026 | `dedc928` | Bump project review date after API log hardening commit. | PROJECT_DEVELOPMENT_REVIEW.md |
| 30 أغسطس 2026 | `dfc2b56` | Reduce PM2 log noise and harden API public endpoints. | artifacts/api-server/src/app.ts, artifacts/api-server/src/index.ts, artifacts/api-server/src/lib/logNoise.test.ts, artifacts/api-server/src/lib/logNoise.ts +3 |
| 29 أغسطس 2026 | `48aa25e` | Document full VPS rollout for app 1.0.9 and migrate 024. | PROJECT_DEVELOPMENT_REVIEW.md, deploy/VPS-STEPS.md |
| 29 أغسطس 2026 | `427788c` | Bump mobile app to 1.0.9 (versionCode 9). | artifacts/mobile/app.json, artifacts/mobile/package.json |
