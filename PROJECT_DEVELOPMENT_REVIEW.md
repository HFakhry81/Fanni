# Fanni — مراجعة تطور المشروع (مرجع مستمر)

آخر مراجعة: 22 أغسطس 2026 — القائمة المعتمدة: `SPEC_BASELINE.md` · الشروط: `TERMS_OF_USE.md`

منصة طلبات صيانة منزلية في مصر: عميل ينشئ طلبًا، النظام يطابق فنيًا، الفني يدفع نقاطًا لكشف بيانات العميل، ثم تتبع جغرافي وتأكيد وصول ونتيجة خدمة وفوترة ثلاثية.

هذا الملف هو **القاموس المرجعي للتطور**: ملخص الحالة + بوابات القبول + سجل المراحل + قاموس كل Commit. لا يُعاد كتابة السجلات السابقة؛ تُضاف صفوف جديدة فقط.

المواصفة الموحّدة بعد دمج النسخ النهائية للوحدات: [`SPEC_BASELINE.md`](SPEC_BASELINE.md).

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

اقتصاد المنتج المعتمد (`SPEC_BASELINE.md`): هدية ترحيب **60** مرة واحدة؛ افتراضي Lead **20** من قاعدة البيانات؛ الشحن **120 نقطة لكل 100 جنيه** (باقات 100/250/500/750/1000). التنفيذ الحالي ما زال على 50/100/200 وهدية 50 حتى migration الاقتصاد. الخصم على السيرفر داخل معاملة واحدة مع دفتر محفظة وسجل Lead.

---

## الحالة حسب المنصة

| المنصة | الحالة | ما هو موجود |
|---|---|---|
| API Server | مكتمل جزئيًا | محفظة، Lead ذري، جيوفنس، مهلة 30 دقيقة، تسعير Lead، اتصال مقنّع Twilio، فواتير بدون OCR |
| تطبيق الهاتف | مكتمل جزئيًا | حوار القبول، تتبع نعم/لا، نتيجة الخدمة، Lead Pricing، اتصال مقنّع بدل tel/واتساب |
| قاعدة البيانات | مكتمل جزئيًا | محافظ، تسعير، `order_declines`، `masked_call_sessions`، أعمدة OCR تاريخية فقط |
| الإدارة | مكتمل جزئيًا | باقات، تكلفة الفتح، قواعد Lead Pricing، نزاعات، محاسبة، مستخدمون |
| التخزين | يحتاج قرارًا | سياسة VPS/Object Storage ومدة الاحتفاظ بالصور |

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

- نقاط داخل المنصة؛ باقات 50/100/200؛ تكلفة افتراضية 20 في `unlock_costs`.
- خصم Lead على السيرفر مع دفتر وسبب Customer Data Access.
- إخفاء بيانات العميل قبل الدفع (مسارات الفني في API).
- تتبع اتصال مقنّع (Twilio Voice bridge)؛ نزاع واحد لكل فتح؛ استرداد أدمن غير قابل للتكرار.
- تقييم بعد الإكمال؛ صور مراحل العمل؛ فواتير ثلاثية ذرية **بدون** OCR لفواتير المشتريات.
- تنظيف هاتف/بريد/واتساب/تيليجرام من وصف الطلب قبل البث.
- قبول Lead وإسناده ذريًا؛ تسجيل خدمة غير مكتملة مع أسباب؛ إسقاط فني/إعادة مطابقة جاهز في الكود.
- واجهة الفني: حوار «قبل ما نكمّل» مع `/accept` و`/decline` وشحن الرصيد عند 402.
- شاشة Lead Pricing للأدمن؛ جيوفنس على `en_route` مع مؤقت 30 دقيقة؛ سؤال نتيجة الخدمة.

## يحتاج استكمالًا (أولوية) — بعد القائمة الموحّدة

1. تشغيل migration 017 و018 على بيئة التطوير (باقات + ترحيب 60 + أوعية النقاط).
2. Audit مالي كامل.
3. KYC بطاقة على مسار VPS عند توفر البيانات (المحول المحلي جاهز).
4. شاشة مصروفات وقيود مزدوجة/صافي الربح.
5. اختبارات تدفق e2e وتشغيل Twilio.

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
- [ ] قواعد الرقم الخاطئ وعدم الاستجابة الآلية + حد يومي.

### المرحلة 4 — التشغيل والمحاسبة

- [x] حركات النقاط مرتبطة بالطلب.
- [x] المصروفات التشغيلية لها جدول وAPI.
- [ ] شاشة إدخال ومراجعة المصروفات.
- [ ] تقرير صافي الأرباح يجمع الإيرادات والرسوم والمصروفات.

### المرحلة 5 — التحقق عبر المنصات

- [ ] API typecheck وmigration على بيئة التطوير.
- [ ] اختبار تدفق العميل على تطبيق الهاتف.
- [ ] اختبار تدفق الفني على تطبيق الهاتف.
- [ ] اختبار الإدارة للنزاعات والمصروفات.
- [ ] اختبار الصور في بيئة التخزين المعتمدة.

### المرحلة 6 — قرار OCR والفوترة

- [x] إنشاء الفواتير الثلاث داخل transaction عند إغلاق الطلب.
- [x] أُزيل نظام OCR ورفع فواتير المشتريات من تطبيق الفني.
- [x] إدخال إجمالي المواد يدويًا (اختياري، يشمل صفر).
- [x] أعمدة OCR التاريخية محفوظة للقراءة فقط.

## بوابة قبول — دورة الطلبات (المواصفة)

- [x] خصم Lead ذري + دفتر + إخفاء بيانات في API.
- [x] قبول يربط الخصم بالإسناد على السيرفر.
- [x] واجهة تأكيد النقاط باللهجة المصرية.
- [x] قواعد تسعير وقت/يوم من الأدمن مربوطة بالقائمة.
- [x] جيوفنس + مؤقت 30 دقيقة مفعّلان في التشغيل.
- [x] نتيجة الخدمة (نعم/لا + أسباب) في التطبيق.
- [x] استرداد استثنائي عبر النزاع/أدمن دون خصم من التطبيق.

---

## سجل التحديثات المختصر

| التاريخ | المرحلة | ما تم | المتبقي |
|---|---|---|---|
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

| التاريخ | الهاش | الرسالة | أبرز الملفات |
|---|---|---|---|
| 22 أغسطس 2026 | `17fc9ec` | Remove purchase-invoice OCR and add Twilio masked calling. | .env.example, OCR_INVOICE_REVIEW.md, PROJECT_DEVELOPMENT_REVIEW.md, artifacts/api-server/build.mjs +26 |
| 22 أغسطس 2026 | `e4343a1` | Record the review-log commit in the project dictionary. | PROJECT_DEVELOPMENT_REVIEW.md |
| 22 أغسطس 2026 | `5fc03e6` | Add a living project review and auto-log every commit into it. | .cursor/hooks.json, .cursor/hooks/after-git-commit.mjs, PROJECT_DEVELOPMENT_REVIEW.md, package.json +6 |
| 22 أغسطس 2026 | `82a8474` | Assign leads atomically on accept and record incomplete service with optional refund requests. | artifacts/api-server/src/lib/leadUnlock.ts, artifacts/api-server/src/lib/orderLifecycle.ts, artifacts/api-server/src/routes/orders.ts, lib/db/migrations/011_lead_pricing_unlock_ledger.sql +1 |
| 21 أغسطس 2026 | `0455095` | last22082026 | PROJECT_DEVELOPMENT_REVIEW.md, package.json, scripts/package.json, scripts/src/update-project-review.mjs |
| 20 أغسطس 2026 | `e6e167b` | Update replit configuration | .replit |
| 21 أغسطس 2026 | `30168bd` | Update project reviews and order functionality in mobile app | OCR_INVOICE_REVIEW.md, PROJECT_DEVELOPMENT_REVIEW.md, artifacts/mobile/app/(tech)/orders.tsx |
| 20 أغسطس 2026 | `b3faea1` | OCR order | OCR_INVOICE_REVIEW.md, PROJECT_DEVELOPMENT_REVIEW.md |
| 20 أغسطس 2026 | `14feb3e` | Implement accounting tab features | artifacts/mobile/app/(admin)/(tabs)/accounting.tsx |
| 20 أغسطس 2026 | `d3856f0` | Implement lead unlock functionality and add operational expenses migration | PROJECT_DEVELOPMENT_REVIEW.md, artifacts/api-server/src/lib/leadUnlock.ts, artifacts/api-server/src/routes/orders.ts, artifacts/api-server/src/routes/wallet.ts +2 |
| 20 أغسطس 2026 | `e5d2beb` | Add technical wallet system analysis document | "attached_assets/\330\252\330\255\331\204\331\212\331\204_\331\206\330\270\330\247\331\205_\331\205\330\255\331\201\330\270\330\251_\330\247\331\204\331\201\331\206\331\212_1787188145476.docx" |
| 20 أغسطس 2026 | `56dbec7` | Update memory configuration and add points default file | .agents/memory/MEMORY.md, .agents/memory/points-default-updates.md |
| 20 أغسطس 2026 | `971c497` | Credit system | artifacts/mobile/components/VectorIcon.tsx, artifacts/mobile/context/AppContext.tsx |
| 20 أغسطس 2026 | `158c176` | Update point system defaults and integrate order processing logic | artifacts/api-server/migrations/009-seed-points-demo.ts, artifacts/api-server/src/index.ts, artifacts/api-server/src/routes/orders.ts, artifacts/api-server/src/routes/wallet.ts +3 |
| 10 أغسطس 2026 | `94fe389` | Add new asset file | attached_assets/Untitled_1786402361472.txt |
| 10 أغسطس 2026 | `364786b` | Remove unnecessary configuration from replit file | .replit |
| 20 أغسطس 2026 | `034ae57` | Order Gvernance phase1 | .agents/memory/MEMORY.md, .agents/memory/migration-drift.md, artifacts/api-server/src/lib/contactSanitizer.ts, artifacts/api-server/src/routes/geo.ts +4 |
| 20 أغسطس 2026 | `ad7c183` | Update invoice and dispute API routes and add documentation | artifacts/api-server/src/routes/disputes.ts, artifacts/api-server/src/routes/invoices.ts, "attached_assets/\331\206\330\270\330\247\331\205_\330\247\331\204\331\201\331\210\330\247\330\252\331\212\330\261_\331\210\330\24 |
| 19 أغسطس 2026 | `09aabc3` | Refactor order processing logic and update agent memory documentation | .agents/memory/MEMORY.md, .agents/memory/order-matching.md, artifacts/api-server/src/lib/orderBroadcaster.ts, artifacts/api-server/src/routes/auth.ts +2 |
| 19 أغسطس 2026 | `6da7847` | Add final orders system documentation | "attached_assets/\331\206\330\270\330\247\331\205_\330\247\331\204\330\267\331\204\330\250\330\247\330\252_\330\247\331\204\331\206\330\263\330\256\330\251_\330\247\331\204\331\207\330\247\330\246\331\212\330\251_1787174 |
| 20 أغسطس 2026 | `f0f81d7` | Regestration Goverance | .npmrc, artifacts/api-server/src/lib/leadPricing.ts, artifacts/api-server/src/lib/leadUnlock.ts, artifacts/api-server/src/lib/orderLifecycle.ts +12 |
| 09 أغسطس 2026 | `70c92da` | Project Context md file | PROJECT_CONTEXT.md |
| 09 أغسطس 2026 | `394b61b` | 0 | artifacts/mobile/tsconfig.json |
| 08 أغسطس 2026 | `7c783a3` | ignore deprecation | artifacts/mobile/tsconfig.json |
| 26 يوليو 2026 | `e620b5a` | انها ربط Sentry بال Backend | artifacts/api-server/src/sentry.ts |
| 26 يوليو 2026 | `5065c49` | ربط backend ب sentry | artifacts/api-server/build.mjs, artifacts/api-server/package.json, artifacts/api-server/src/app.ts, artifacts/api-server/src/sentry.ts +1 |
| 24 يوليو 2026 | `3a1df85` | انهاء ربط Senty لل FrontEnd | artifacts/mobile/app/(admin)/_layout.tsx, artifacts/mobile/app/_layout.tsx |
| 24 يوليو 2026 | `37d2e66` | Sentry Plugin Install Manual | artifacts/mobile/app.json, artifacts/mobile/package.json, artifacts/mobile/sentry-wizard-installation-error-1784843142257.log, pnpm-lock.yaml +1 |
| 24 يوليو 2026 | `45bce5f` | set all payment updates | artifacts/mobile/sentry-wizard-installation-error-1784842873168.log, lib/db/drizzle/0003_thankful_black_widow.sql, lib/db/drizzle/meta/0003_snapshot.json, lib/db/drizzle/meta/_journal.json |
| 23 يوليو 2026 | `d919a60` | last_one | artifacts/mobile/package.json, lib/db/drizzle/0002_dashing_the_fallen.sql, lib/db/drizzle/meta/0002_snapshot.json, lib/db/drizzle/meta/_journal.json +2 |
| 23 يوليو 2026 | `0f20462` | Implement payment processing and admin profile functionality | artifacts/api-server/src/index.ts, artifacts/api-server/src/routes/index.ts, artifacts/api-server/src/routes/notifications.ts, artifacts/api-server/src/routes/payments.ts +9 |
| 22 يوليو 2026 | `59b86c1` | الدفع والتأكيد والنقاط | attached_assets/Pasted-Call-Stack-myRequests-slice-map-argument-0-artifacts-mo_1784759990883.txt |
| 22 يوليو 2026 | `e7a6b86` | Add API server implementation and enhance mobile wallet UI with transaction history | .agents/memory/MEMORY.md, .agents/memory/payment-request-flow.md, .replit, artifacts/api-server/src/index.ts +10 |
| 02 يوليو 2026 | `0704432` | Add a dispute resolution system and automated demo data seeding | artifacts/api-server/migrations/009-seed-points-demo.ts, artifacts/api-server/src/index.ts, artifacts/mobile/app/(admin)/(tabs)/_layout.tsx, artifacts/mobile/app/(admin)/(tabs)/disputes.tsx |
| 01 يوليو 2026 | `eb9d4df` | Add a points system for technicians to unlock leads | .agents/memory/MEMORY.md, .agents/memory/fanni-points-system.md, artifacts/api-server/src/routes/disputes.ts, artifacts/api-server/src/routes/index.ts +11 |
| 01 يوليو 2026 | `b266052` | Enable offline mode to prevent mobile app startup failures | artifacts/mobile/scripts/dev-start.js |
| 01 يوليو 2026 | `8cb61e9` | Saved progress at the end of the loop | .replit |
| 30 يونيو 2026 | `b58eea8` | Update admin interface with a new tab structure and user management hub | .agents/memory/MEMORY.md, .agents/memory/admin-redesign.md, artifacts/mobile/app/(admin)/(tabs)/_layout.tsx, artifacts/mobile/app/(admin)/(tabs)/permissions.tsx +3 |
| 23 يونيو 2026 | `64fa4cd` | database backup | backup.sql, backup_new.sql |
| 23 يونيو 2026 | `aaf6e50` | Good runing | artifacts/api-server/package.json |
| 23 يونيو 2026 | `f7727a4` | مش متاكد | artifacts/mobile/constants/egyptLocations.ts, lib/db/drizzle.config.ts, lib/db/drizzle/0001_minor_scourge.sql, lib/db/drizzle/meta/0001_snapshot.json +6 |
| 22 يونيو 2026 | `5239e30` | feat: tech approval flow, email/mobile edit for all users | .agents/memory/MEMORY.md, .agents/memory/admin-mobile-otp.md, .agents/memory/tech-approval-gate.md, artifacts/api-server/src/routes/auth.ts +9 |
| 21 يونيو 2026 | `d70d4f5` | fix: resolve technician registration failure on Replit and local dev | .env.example, artifacts/mobile/.env.example, artifacts/mobile/scripts/dev-start.js, attached_assets/Screenshot_2026-06-22-01-00-27-82_f73b71075b1de7323614b647fe39_1782079402172.jpg +1 |
