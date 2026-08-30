# Sentry + Cursor MCP — Fanni

## المشاريع على Sentry

| الخدمة | Org | Project | DSN env |
|--------|-----|---------|---------|
| API (`fanni-api` على PM2) | `upnexa-hb` | `node` | `SENTRY_DSN` (اختياري على VPS) |
| Mobile APK | `upnexa-hb` | `fanni` | `EXPO_PUBLIC_SENTRY_DSN` (في EAS) |

لوحة Sentry: https://upnexa-hb.sentry.io

الإصدارات:

- **API release:** `SENTRY_RELEASE=fanni-api@<version>` في `.env` على VPS (مثال بعد نشر: `fanni-api@1.0.9`)
- **Mobile release:** `com.fanni.app@1.0.9+9` (تلقائي من `app.json`)

---

## ربط Cursor بـ Sentry MCP (مطلوب مرة واحدة)

1. تأكد أن إضافة **Sentry** مفعّلة: Cursor → **Settings → Plugins → Sentry**
2. افتح **Settings → MCP** وابحث عن **sentry**
3. اضغط **Connect** / **Sign in** — سيفتح OAuth على `https://mcp.sentry.dev`
4. سجّل الدخول بحساب Sentry الذي يملك org **`upnexa-hb`**
5. أعد تحميل نافذة Cursor (**Developer: Reload Window**) إن لم يظهر MCP

ملف المشروع `.cursor/mcp.json` يشير إلى:

```json
{ "mcpServers": { "sentry": { "url": "https://mcp.sentry.dev/mcp" } } }
```

بعد الربط يمكنك في المحادثة:

- «اعرض آخر issues في fanni» (موبايل) أو `node` (API)
- `/sentry-debug-issue` مع رابط خطأ
- `/sentry-create-alert` لتنبيه Slack أو بريد

---

## تحقق من أن التيليمتري يصل

### API (بعد نشر)

```bash
curl -sS https://api.upnexa-eg.com/healthz
# ثم راقب Sentry → node → Issues
```

### Mobile

افتح التطبيق، سجّل دخولاً، ثم راقب **fanni** في Sentry (JS errors فقط؛ `enableNative: false`).

---

## ملاحظات الإنتاج

- EAS: `SENTRY_DISABLE_AUTO_UPLOAD=true` — لا رفع source maps تلقائي (تجنب فشل Gradle)
- API: `consoleIntegration` يلتقط `warn/error` فقط في الإنتاج
- لا تضع `SENTRY_AUTH_TOKEN` في Git — للـ CLI/source maps فقط على CI إن لزم
