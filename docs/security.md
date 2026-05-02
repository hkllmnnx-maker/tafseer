# سياسة الأمان التقنية — منصّة تفسير

> آخر تحديث: 2026-05-02
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
script-src 'self' 'unsafe-inline';
script-src-attr 'none';
connect-src 'self';
frame-ancestors 'none';
object-src 'none';
manifest-src 'self';
worker-src 'self';
upgrade-insecure-requests;
```

### لماذا `'unsafe-inline'` ما زال موجودًا؟

- **`style-src`**: نظام التصميم يحقن متغيّرات CSS مضمَّنة (RTL، تبديل المظهر،
  أحجام ديناميكية في صفحات الإحصاءات والقراءة). إزالته تتطلّب بنية أوسع
  من classes ساكنة + nonces.
- **`script-src`**: عدد قليل من سكربتات inline في القوالب (تهيئة المظهر قبل
  أوّل رسم، تركيب أحداث الأشرطة، إلخ). البديل المخطّط له:
  - **خطوة 1:** إضافة `nonce` لكل `<script>` inline يولَّد لكل طلب.
  - **خطوة 2:** نقل الباقي إلى ملفات منفصلة تحت `/static/` ثم إزالة `'unsafe-inline'` من `script-src`.
- `script-src-attr 'none'` يضمن أنّه حتى مع `'unsafe-inline'` على `script-src`،
  لا تُسمح معالجات الأحداث المضمَّنة (`onclick="..."`) — وهي أخطر بكثير.

### خطوات تتبع التراجع عن `'unsafe-inline'`

1. تشغيل CSP في وضع **report-only** على بيئة staging.
2. جمع التقارير لمدة أسبوع كامل.
3. فهرسة كل سكربت/ستايل inline متبقٍّ.
4. إضافة `nonce` ديناميكي.
5. إزالة `'unsafe-inline'` من `script-src` أوّلًا، ثم لاحقًا من `style-src`.

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

- [ ] إضافة `Reporting-Endpoints` و `Report-To` لجمع تقارير CSP في الإنتاج.
- [ ] تشغيل CSP في وضع `Content-Security-Policy-Report-Only` لمدة أسبوع.
- [ ] إزالة `'unsafe-inline'` من `script-src` ثم من `style-src`.
- [ ] إضافة rate limiting على `/api/search` و `/api/suggest`.
- [ ] مراجعة subresource integrity لخطوط Google.
- [ ] مراجعة دورية مع أداة مثل Mozilla Observatory.

---

## 10. كيف تبلّغ عن ثغرة؟

راجع `SECURITY.md` في جذر المستودع. باختصار:

- ثغرات حسّاسة → **GitHub Security Advisories** (خاصّة).
- استفسارات عامّة → Issue بوسم `security`.
- لا تُرسَل تفاصيل الثغرات في issues عامة.
