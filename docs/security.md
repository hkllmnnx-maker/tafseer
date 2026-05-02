# سياسة الأمان التقنية — منصّة تفسير

> آخر تحديث: 2026-05-02 (Beta متقدّمة)
> هذا الملف يوثّق التطبيق الفعلي لإجراءات الأمان داخل الكود (`src/index.tsx`)،
> وهو مكمّل لـ `SECURITY.md` في الجذر الذي يصف سياسة الإفصاح والاستجابة للحوادث.

---

## 1. ترويسات الأمان (Security Headers)

كل الطلبات تمرّ عبر `secureHeaders()` من Hono، وتُضاف الترويسات التالية:

| الترويسة | القيمة | الغرض |
|---------|--------|-------|
| `Content-Security-Policy` | راجع §2 | منع XSS وإدراج محتوى خارجي. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | إجبار HTTPS لمدة سنتين. |
| `X-Content-Type-Options` | `nosniff` | منع تخمين أنواع MIME. |
| `X-Frame-Options` | `DENY` | منع تأطير الصفحة (مكافحة click-jacking). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | تقليل تسريب URLs الداخلية. |
| `Cross-Origin-Opener-Policy` | `same-origin` | عزل النوافذ. |
| `Cross-Origin-Resource-Policy` | `same-origin` | منع سرقة الموارد. |
| `Permissions-Policy` | راجع §3 | تعطيل واجهات المتصفح غير المستخدمة. |

---

## 2. سياسة CSP الحالية

```
default-src 'self';
base-uri 'self';
form-action 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src  'self' https://fonts.gstatic.com data:;
img-src   'self' data: blob:;
script-src 'self' 'sha256-XDgFU4l0pZIkpiMebd0KPkXydQsyFJhP/U4A/laXaxU=';
script-src-attr 'none';
connect-src 'self';
frame-ancestors 'none';
object-src 'none';
manifest-src 'self';
worker-src 'self';
upgrade-insecure-requests;
```

### تطوّر CSP

| الإصدار | `script-src` | الحالة |
|---------|-------------|--------|
| المرحلة 1 | `'self' 'unsafe-inline'` | السماح بكل السكربتات inline (مفتوح). |
| **المرحلة 2 (الحالية)** | `'self' 'sha256-XDgF...'` | إزالة `'unsafe-inline'` ⇒ **CSP صارم**. سكربت inline واحد محدّد بالـ hash. |
| المرحلة 3 (مخطّطة) | `'self' 'nonce-...'` أو `strict-dynamic` | تحويل سكربت تهيئة الثيم إلى ملف خارجي ثم إزالة الـ hash. |

### لماذا `'unsafe-inline'` ما زال على `style-src`؟

- نظام التصميم يحقن `style="..."` على عدّة عناصر (شارات، فلاتر، شرائط تقدّم،
  متغيّرات CSS متغيّرة الحجم). إزالته تتطلّب بنية أوسع من classes ساكنة
  + nonces ديناميكيّة على كل عنصر.
- لا توجد على `style-src-attr` مخاطر تنفيذ كود فعلي (الـ CSS لا تُنفِّذ JS).
- خطّة الإزالة موثّقة في [خارطة الأمان](#9-الخارطة-الأمنية-القادمة).

### كيفية تحديث CSP hash

السكربت المضمَّن الوحيد المسموح به موجود في `src/renderer.tsx` (تهيئة الثيم
لمنع وميض الوضع الداكن). لتغييره:

1. عدّل النصّ داخل `dangerouslySetInnerHTML` في `src/renderer.tsx`.
2. أعد حساب الـ hash:
   ```bash
   node -e "import('node:crypto').then(c => console.log('sha256-' + c.createHash('sha256').update(\`\\n          (function() {\\n            try {\\n              ...\\n          })();\\n        \`).digest('base64')))"
   ```
   أو ابنِ المشروع، شغّله، ثم انسخ السكربت من DevTools واحسبه:
   ```bash
   echo -n '<script-content>' | openssl dgst -binary -sha256 | openssl base64
   ```
3. ضع القيمة الجديدة في `scriptSrc` داخل `src/index.tsx`.
4. اختبر صفحة واحدة على الأقل في DevTools تحت `Console`؛ إن ظهر:
   `Refused to execute inline script because it violates the following Content Security Policy directive` ⇒ الـ hash لا يطابق.
5. حدّث هذا الملف بالـ hash الجديد.

### لماذا JSON-LD لا يحتاج hash؟

السكربت `<script type="application/ld+json">` في `src/renderer.tsx` يحمل بيانات
وصفيّة (Schema.org) **ولا يُنفَّذ** ولا يخضع لقيود `script-src` في المتصفّحات
الحديثة (Chrome / Firefox / Safari). يبقى مرئيًا لروبوتات البحث فقط.

---

## 3. Permissions-Policy

يُعطَّل صراحةً كل ما يلي:

- camera, microphone, geolocation
- payment, usb
- accelerometer, gyroscope, magnetometer, midi

ويُسمح فقط:
- `fullscreen=(self)` لمستخدم القراءة المتسلسلة لاحقًا.

---

## 4. سياسة CORS

```ts
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
  exposeHeaders: ['Cache-Control'],
  credentials: false,
  maxAge: 600,
}))
```

- API للقراءة فقط. كل المحتوى عام (تفاسير، آيات، إحصاءات).
- `credentials: false` يمنع المتصفّح من إرسال كوكيز أو ترويسات خاصة.
- لا يوجد endpoint للكتابة عبر API العام.

---

## 5. التعامل مع الأخطاء

`app.onError(...)` و `app.notFound(...)` لا يكشفان:
- رسائل أخطاء داخلية.
- stack traces.
- أسماء حقول قاعدة البيانات.
- بيانات الطلب الأصلي.

تنسيق الأخطاء:

| المسار | الردّ |
|-------|------|
| `/api/*` | `{"ok":false,"error":"internal_error","message":"حدث خطأ غير متوقع."}` (HTTP 500) |
| باقي الصفحات | صفحة HTML ودودة بعنوان عام، بدون أي تفاصيل تقنية. |

تفاصيل الخطأ (الرسالة الأصلية، المسار، الأسلوب) تُسجَّل في `console.error`
وتظهر في **Cloudflare Logs** فقط، لا تصل المستخدم.

---

## 6. حماية المسارات الإدارية

- لا توجد حاليًا أيّ نقطة إدارية مفتوحة للعموم.
- نقاط الاستيراد تعمل **فقط من CLI محليًا** (`scripts/importers/*`)
  أو ستكون لاحقًا خلف **Cloudflare Access** عند نشرها.
- لا تحتوي قاعدة البيانات/الـ seed على أيّ بيانات شخصية لمستخدمين.

---

## 7. سياسة استيراد البيانات

كل ملف يمرّ على `validate-import.mjs` قبل أيّ كتابة فعلية إلى قاعدة D1:

- يرفض المحارف الغريبة، الـ HTML الخام، أو السكربتات داخل النصوص.
- يرفض الإدّعاءات غير المتسقة (`isOriginalText: false` مع `sourceType: 'original-text'`).
- يرفض تفاسير `verified` بدون `edition / page / sourceName`.
- ينتج تقرير قبول/رفض/تحذيرات قبل أي كتابة.

---

## 8. التحقّق العلمي قبل النشر

`scripts/verify-data.mjs` يفشل (exit code 1) إذا:

- وُجد تفسير `verified` بنصّ قصير جدًا.
- وُجد `sourceType: original-text` بدون مصدر معلَن.
- وُجد ID مكرّر، أو إشارة لكتاب/سورة/آية غير موجودة.

CI (`.github/workflows/ci.yml`) يشغّل هذا السكربت في كل push/PR،
ويفشل بناء الفرع تلقائيًا إن خرج بنتيجة سلبية.

---

## 9. الخارطة الأمنية القادمة

- [x] إزالة `'unsafe-inline'` من `script-src` (تمّت — تستخدم SHA-256 hash).
- [ ] نقل سكربت تهيئة الثيم إلى ملف `/static/theme-init.js` ⇒ إزالة الـ hash.
- [ ] إضافة `Reporting-Endpoints` و `Report-To` لجمع تقارير CSP في الإنتاج.
- [ ] تشغيل CSP في وضع `Content-Security-Policy-Report-Only` لمدة أسبوع.
- [ ] إزالة `'unsafe-inline'` من `style-src` (يتطلّب refactor للـ inline styles).
- [ ] إضافة rate limiting على `/api/search` و `/api/suggest`.
- [ ] مراجعة subresource integrity لخطوط Google.
- [ ] مراجعة دورية مع أداة مثل Mozilla Observatory.

---

## 10. كيف تبلّغ عن ثغرة؟

راجع `SECURITY.md` في جذر المستودع. باختصار:

- ثغرات حسّاسة → **GitHub Security Advisories** (خاصّة).
- استفسارات عامّة → Issue بوسم `security`.
- لا تُرسَل تفاصيل الثغرات في issues عامة.
