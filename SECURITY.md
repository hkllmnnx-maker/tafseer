# سياسة الأمان — تفسير

> آخر تحديث: 2026-05-01

هذا المستند يصف سياسة الأمان في مشروع **تفسير**: كيف نتعامل مع الأسرار،
وكيف نُبلَّغ عن الثغرات، وما هي القيود المفروضة على الاستيراد، الأذونات،
الترويسات الأمنية، و CORS.

## 1. الإبلاغ عن الثغرات (Vulnerability disclosure)

- إذا اكتشفت ثغرة أمنية، أرسل تقريرًا خاصًا (private) إلى مالك المستودع
  عبر [GitHub Security Advisories](https://github.com/hkllmnnx-maker/tafseer/security/advisories/new)،
  ولا تفتح Issue علنية.
- يُرجى إرفاق: وصف الثغرة، الخطوات لإعادة إنتاجها، التأثير المحتمل،
  وأي PoC.
- نتعهّد بالردّ خلال 5 أيام عمل، ونعمل على إصلاح الثغرات الحرجة خلال 14 يومًا.

## 2. التعامل مع الأسرار والمتغيّرات البيئية (Secrets & env)

- **لا** يوجد في الكود أي مفاتيح أو رموز API أو بيانات اعتماد.
- متغيّرات الإنتاج تُحقن عبر **Cloudflare Pages secrets** (`wrangler pages secret put`).
- التطوير المحلي يستخدم `.dev.vars` (موجود في `.gitignore`).
- ملفات `.env*` و `.dev.vars` و `wrangler.toml.local` **محظور** رفعها للمستودع.
- لا تستخدم `console.log` لطباعة قيم سرّية.
- جميع طلبات `fetch` لخدمات خارجية تتمّ من **server-side only** عبر مسارات `/api/*`.

## 3. قيود الاستيراد (Import restrictions)

- نقطة `/admin/import` غير موجودة بعد، ولن تُضاف بدون مصادقة قوية
  (Cloudflare Access أو Bearer token مع rate limiting).
- مدقّق `scripts/importers/validate-import.mjs` يفرض:
  - حقول إلزامية: `id`, `bookId`, `surah`, `ayah`, `text`, `sourceType`, `verificationStatus`.
  - رفض القيم خارج القائمة البيضاء لـ `sourceType` و `verificationStatus`.
  - رفض أرقام السور خارج 1..114، ورفض رقم آية يتجاوز عدد آيات السورة.
  - رفض IDs المكرّرة داخل نفس الملف.
  - الحدّ الأدنى لطول النص = 5 أحرف.
- في الإنتاج: كل دفعة استيراد تُسجَّل في جدول `import_jobs` و `audit_logs`،
  وتمرّ بـ dry-run قبل التنفيذ.

## 4. حماية البيانات (Data protection)

- التطبيق لا يجمع بيانات شخصية (PII): لا تسجيل، لا حسابات، لا profile.
- المفضلة وسجلّ التصفّح يُخزَّنان **محليًا فقط** (LocalStorage)، ولا يُرسَلان
  إلى الخادم.
- لا يوجد cookie جلسة، ولا تتبّع تحليلي خارجي افتراضيًا.
- إن أُضيفت analytics مستقبلاً، ستكون من النوع cookieless (Cloudflare Web Analytics).

## 5. تشديد الترويسات (Header hardening)

التطبيق يستخدم middleware `secureHeaders` من Hono ويضبط:

| Header | القيمة | الغرض |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` + قيود مفصّلة | منع XSS وحقن الموارد |
| `X-Content-Type-Options` | `nosniff` | منع تخمين MIME |
| `X-Frame-Options` | `DENY` (عبر `frame-ancestors 'none'`) | منع clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | تقليل تسريب الـ referrer |
| `Strict-Transport-Security` | افتراضي من Hono | إجبار HTTPS |
| `Permissions-Policy` | افتراضي مقيّد | منع APIs الخطيرة |

CSP يسمح فقط بـ:
- Scripts/Styles من نفس الأصل + `unsafe-inline` (لـ tailwind أو inline styles).
- خطوط Google fonts.
- صور من نفس الأصل + `data:` و `blob:`.
- لا frames خارجية، لا scripts خارجية غير معروفة.

## 6. سياسة CORS

- `app.use('/api/*', cors({ origin: '*', allowMethods: ['GET'] }))`
- API للقراءة فقط (GET)؛ لا توجد نقاط POST/PUT/DELETE علنية.
- إذا أُضيفت نقاط كتابة لاحقًا (للاستيراد أو الإدارة) فستُقيَّد بأصل محدّد
  + Bearer token + rate limiting.

## 7. تجنّب البيانات الحسّاسة في LocalStorage

- LocalStorage يُستخدم فقط لـ:
  - `tafseer-bookmarks` (مفضلة الآيات — لا PII)
  - `tafseer-history` (آخر 50 آية تمّ تصفّحها — لا PII)
  - `tafseer-theme` (الوضع الليلي/النهاري)
  - `tafseer-font-size` (تفضيل حجم الخط)
- **لا** يُحفظ فيه أي token، أو session، أو email، أو معلومة شخصية.

## 8. عدم وجود واجهة إدارة بدون مصادقة

- لا توجد مسارات `/admin/*` فعّالة في النسخة الحالية.
- إن أُضيفت لاحقًا، فستُحمى بـ:
  - Cloudflare Access (Zero Trust) أو
  - Bearer token مخزَّن كـ Cloudflare secret + IP allow-list.
- مسارات التصدير `/api/export/*` آمنة لأنها تكشف فقط البيانات المرئية في الواجهة
  (التفاسير، السور، المؤلفون، الكتب، الموضوعات) — لا بيانات مستخدمين.

## 9. ضمان نظافة المدخلات

- جميع query params تُمرَّر عبر `sanitizeFilters()` التي تطبّق:
  - حدّ أقصى لطول النص (200 حرفًا).
  - clamp للأرقام داخل النطاق المسموح.
  - قائمة بيضاء للقيم النصّية (مدارس، أنواع مصدر، حالات تحقق، sort, searchIn).
  - الحدّ الأقصى لعدد عناصر المصفوفة = 30.
- جميع المخرجات HTML تمرّ عبر `escapeHtml()`/`highlightText()` (لا `dangerouslySetInnerHTML`
  على input مستخدم خام).

## 10. التحديثات الأمنية للاعتماديات

- نراقب `npm audit` بانتظام.
- لا توجد اعتماديات إنتاج خارج Hono (مكتبة واحدة).
- التحديثات الأمنية الرئيسية تُطبَّق في غضون 7 أيام من إصدار التصحيح.

## 11. نسخ احتياطية وانتعاش

- بيانات المستودع نفسها (المرجع الوحيد للحقيقة) محفوظة في Git.
- مستقبلاً: تصدير دوري لقاعدة D1 إلى R2 bucket مع تشفير at-rest.

## 12. اتصال

لأي استفسار أمني عاجل (لا يتعلّق بثغرة محدّدة):
- افتح Issue عامة وضع وسم `security` فقط للاستفسارات غير الحساسة.
- للأمور السرّية: استخدم GitHub Security Advisories الخاص.
