# رفع الصور على الويب + صلاحيات التخزين (VPS)

## 1) مشكلة الكود (كانت تكسر الويب)

React Native يرسل الملف هكذا:

```ts
formData.append("file", { uri, type, name })
```

المتصفح **يتجاهل** هذا الشكل ويرسل طلبًا بلا ملف → API يرد `No file provided`.

**الإصلاح:** `artifacts/mobile/utils/appendImageToFormData.ts` يحوّل الـ URI إلى `Blob`/`File` على الويب.

كذلك `Alert.alert` بأزرار (معرض/كاميرا) غير موثوق على الويب → فتح منتقي الملفات مباشرة.

## 2) صلاحيات المجلدات على السيرفر (افحص بعد إصلاح الكود)

المسارات المتوقعة في `.env` على الـ VPS:

```bash
STORAGE_DRIVER=local
PRIVATE_OBJECT_DIR=/var/www/storage/fanni
PRIVATE_OBJECT_DIR_ID=/var/www/storage/fanni/id
PRIVATE_OBJECT_DIR_CARNEHAT=/var/www/storage/fanni/carnehat
```

أوامر التحقق والإصلاح:

```bash
# المجلدات
sudo mkdir -p /var/www/storage/fanni/{id,carnehat,avatars,documents,uploads}

# من يشغّل الـ API؟ (غالبًا www-data أو مستخدم systemd)
ps aux | grep -E 'node|api' | head

# صلاحيات الكتابة لمستخدم الخدمة
sudo chown -R www-data:www-data /var/www/storage/fanni
sudo chmod -R u+rwX,g+rwX /var/www/storage/fanni

# اختبار كتابة سريع
sudo -u www-data touch /var/www/storage/fanni/uploads/.write-test && sudo -u www-data rm /var/www/storage/fanni/uploads/.write-test && echo OK
```

لو الخدمة تعمل بمستخدم آخر (مثل `fanni` أو `nodejs`)، استبدل `www-data` بهذا المستخدم.

## 3) تحقق سريع بعد نشر dist-web الجديد

1. تسجيل فني → اختيار صورة لوجه/ظهر البطاقة → يجب أن يفتح حوار الملف ويظهر معاينة.
2. بعد إكمال التسجيل: Network → `POST https://api.upnexa-eg.com/api/upload` → **201** مع `url`.
3. على السيرفر: `ls -la /var/www/storage/fanni/id/` يظهر ملفًا جديدًا.

لا تجعل مجلد التخزين عامًا عبر Nginx؛ القراءة تتم عبر `/api/uploads/file` فقط.
