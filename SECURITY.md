# سياسة الأمان — تفسير

> آخر تحديث: 2026-05-02

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

- نقطة `/admin/import` **غير موجودة وغير مخطّطة بدون مصادقة قوية**
  (Cloudflare Access أو Bearer token مع rate limiting). المستوردات
  تُنفَّذ خارج التطبيق عبر CLI فقط (`wrangler d1 execute --file=...`).
- مدقّق `scripts/importers/validate-import.mjs` (تفاسير) يفرض:
  - حقول إلزامية: `id`, `bookId`, `surah`, `ayah`, `text`, `sourceType`, `verificationStatus`.
  - رفض القيم خارج القائمة البيضاء لـ `sourceType` و `verificationStatus`.
  - رفض أرقام السور خارج 1..114، ورفض رقم آية يتجاوز عدد آيات السورة.
  - رفض IDs المكرّرة داخل نفس الملف.
  - الحدّ الأدنى لطول النص = 5 أحرف.
- مدقّق التفاسير الجديد `scripts/importers/validate-tafsir-json.mjs` (v1.8) يفرض إضافيًا:
  - `sourceUrl` بصيغة `https://` فقط (مرفوض في `--strict` بدون ذلك).
  - `license` إلزامي في `--strict` (لتفادي رفع تفاسير محميّة بحقوق ملكية).
  - مدارس معتمدة فقط: `sunni-classical`, `sunni-modern`, `mufradat`, `lughawi`, ...
  - مطابقة `sourceType` لـ `isOriginalText`: `original-text` ⇔ `isOriginalText=true`.
  - رفض النصوص الفارغة وحرفيًا `undefined` / `NaN` / `null`.
  - اكتشاف التكرار داخل نفس الملف (`id` فريد).
  - 27 اختبار وحدة تغطّي كل قاعدة في `tests/tafsir-validator.test.mjs`.
- مدقّق + مستورد القرآن (`scripts/importers/validate-quran-json.mjs` و
  `scripts/importers/import-quran.mjs`) يفرض:
  - رفض النصوص الفارغة، أو التي تحوي حرفيًا `undefined` / `NaN` / `null`.
  - رفض تكرار الزوج `(surah, ayah)` ورفض أرقام عشريّة.
  - رفض `sourceUrl` غير `https://` في `--strict`.
  - في `--full`: يُلزم وجود 6236 آية بالضبط لـ 114 سورة.
  - الإخراج SQL يُولَّد محلّيًا فقط (`dist/import/ayahs-full.sql`)
    باستخدام `INSERT OR REPLACE` (idempotent) مع هروب الاقتباسات SQLite،
    ولا يلمس الشبكة، ولا يكتب أي ملفات خارج `dist/import/`.
  - تقرير `dist/import/quran-import-report.json` يحتفظ بـ `SHA-256`
    لمدخل JSON الأصلي للتدقيق والمراجعة المستقلة.
- بيانات القرآن الكاملة **لا تُلتزم في git** — يُحتفظ بها في `.imports/`
  المُستثناة عبر `.gitignore`، وتُنفَّذ على D1 عبر CLI خارج العمليّة العامة.
- في الإنتاج: كل دفعة استيراد تُسجَّل (مستقبلاً) في جدول `import_jobs` و
  `audit_logs`، وتمرّ بـ dry-run قبل التنفيذ.

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
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | إجبار HTTPS لمدة سنتين |
| `Permissions-Policy` | افتراضي مقيّد | منع APIs الخطيرة |
| `Cross-Origin-Opener-Policy` | `same-origin` | عزل النوافذ |
| `Cross-Origin-Resource-Policy` | `same-origin` | منع الموارد عبر الأصل |

CSP يسمح فقط بـ:
- `script-src`: نفس الأصل + **SHA-256 hash** محدد لسكربت تهيئة الثيم
  (لا `'unsafe-inline'` على scripts).
- `style-src`: نفس الأصل + `'unsafe-inline'` (مؤقّت — راجع docs/security.md
  لخطة الإزالة عبر hashing لاحقًا) + `https://fonts.googleapis.com`.
- `font-src`: نفس الأصل + `https://fonts.gstatic.com` + `data:`.
- `img-src`: نفس الأصل + `data:` + `blob:`.
- `frame-ancestors 'none'` (لا تضمين داخل iframes).
- `object-src 'none'`, `script-src-attr 'none'`.
- لا frames خارجية، لا scripts خارجية غير معروفة.

**كيفية تحديث CSP hash:** عند أي تعديل لسكربت inline في
`src/renderer.tsx`، أعد حساب SHA-256 hash للنص بالضبط (بما في ذلك
المسافات) وحدّث القيمة في `src/index.tsx`. تفاصيل في `docs/security.md`.

## 6. سياسة CORS

- `app.use('/api/*', cors({ origin: '*', allowMethods: ['GET','HEAD','OPTIONS'], credentials: false, maxAge: 600 }))`
- API للقراءة فقط (GET/HEAD/OPTIONS فقط)؛ لا توجد نقاط POST/PUT/DELETE علنية.
- `credentials: false` يمنع المتصفّح من إرسال cookies أو ترويسات اعتماد.
- `allowHeaders` مقصور على `Content-Type` و`Accept`.
- المحتوى عام (تفاسير، آيات، إحصاءات) ولا يحتوي بيانات مستخدم حسّاسة،
  لذلك `origin: '*'` آمن في هذا السياق.
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

## 9.1 حماية SQL في طبقة D1 Provider

`src/lib/data/d1-provider.ts` يلتزم بمبدأ **Defense in Depth** لمنع
حقن SQL، حتى عند استلام مدخلات غير موثوقة:

- **Prepared statements حصريًا**: كل قيمة مستخدم تمرّ عبر `db.prepare(...).bind(...)`،
  ولا يوجد string interpolation للقيم في أي استعلام.
- **Placeholders ديناميكية فقط من العدد**: عند بناء `IN (?, ?, ...)`،
  يُحسب عدد placeholders من طول المصفوفة، لا من قيم المستخدم.
- **String interpolation مسموح فقط لـ:**
  1. أسماء أعمدة/جداول ثابتة في الكود (literals).
  2. `ORDER BY` من قائمة بيضاء (`ALLOWED_SORTS`).
  3. `searchIn` من قائمة بيضاء (`ALLOWED_SEARCH_IN`).
  4. `HARD_LIMIT` (ثابت رقمي حرفي).
- **LIKE patterns مع ESCAPE**: كل `%`, `_`, `\` من المستخدم تُهرَّب،
  ويُضاف `ESCAPE '\\'` لكل LIKE.
- **Schools filter آمن داخل JSON**: قيمة مغلَّفة بـ `"..."` لمنع
  الالتباس بين اسم مدرسة جزئي وكاملة.
- **HARD_LIMIT** لكل بحث (500 صف) لمنع DoS.
- **Fallback على seed**: عند exception أو جدول فارغ تمامًا، نسقط بأمان
  إلى مزوّد seed بدلاً من إعادة خطأ تقني للمستخدم.
- **التحقّق العلمي للمحتوى**: حقول `source_type`, `verification_status`,
  `source_name`, `source_url`, `is_original_text`, `reviewer_note`
  تُحفظ في D1 وتُعاد في الـ API لتمييز النص الأصلي عن العيّنة.

## 10. التحديثات الأمنية للاعتماديات

- نراقب `npm audit` بانتظام.
- لا توجد اعتماديات إنتاج خارج Hono (مكتبة واحدة).
- التحديثات الأمنية الرئيسية تُطبَّق في غضون 7 أيام من إصدار التصحيح.

## 10.1 سياسة المحتوى الديني (Religious content policy)

- **يُمنع** إضافة نصوص قرآن أو تفسير غير موثَّقة بمصدر علمي معتمد.
- العيّنات المضمَّنة في `src/data/*` صغيرة، مُعلَّمة بـ `isSample: true` و
  `source_type: 'sample'`، ومُعرَّف منها مصدرها بوضوح.
- نصّ القرآن الكامل لا يُستورد إلا من مصادر معتمدة (مجمع الملك فهد لطباعة
  المصحف الشريف — `https://qurancomplex.gov.sa/`) عبر `npm run validate:quran`
  مع `--strict --full`.
- نصوص التفسير لا تُستورد إلا من مصادر مذكورة بـ `sourceUrl` يبدأ بـ `https://`
  ومرفقة بـ `edition`/`volume`/`page` للتدقيق.
- مدقّق `validate-quran-json.mjs` يرفض:
  - رقم سورة خارج 1..114، رقم آية خارج النطاق الكنسي للسورة.
  - أرقام عشرية للسورة/الآية.
  - نصّ فارغ أو يحتوي حرفيًا كلمة `undefined`.
  - `sourceUrl` لا يبدأ بـ `https://`.
  - تكرارات (نفس الـ surah:ayah) داخل الملف.
  - وضع `--full` يتطلب 6236 آية مع تغطية كل 114 سورة لعددها الكنسي.

## 10.2 التحقّق المحلي عبر D1

- `npm run d1:smoke` (سكربت `scripts/d1-smoke-check.mjs`) يفحص:
  المايجرشنز، seed-data.sql/json (PRAGMA/BEGIN/COMMIT، لا undefined/NaN)،
  parsability لـ `wrangler.jsonc`، حالة D1 binding، توفّر CLI.
- لا يحتاج هذا السكربت أي Cloudflare secrets ويعمل في CI بأمان.
- `wrangler.jsonc` يحتفظ بـ D1 binding **معطَّلًا** (placeholder
  `REPLACE_WITH_REAL_D1_ID`) كافتراضي آمن لمنع تسريب database_id حقيقي.
- `npm run verify:quran-d1` (سكربت `scripts/importers/verify-quran-d1.mjs`) v1.8 يفحص D1
  بعد الاستيراد: counts (114 سورة، 6236 آية)، checksums لكل سورة، عدم وجود تكرار،
  ولا قيم `undefined`/`NaN`/فارغة. مع `--dry-run` يعمل بدون اتصال D1 لاختبار
  السكربت في CI.

## 11. نسخ احتياطية وانتعاش

- بيانات المستودع نفسها (المرجع الوحيد للحقيقة) محفوظة في Git.
- مستقبلاً: تصدير دوري لقاعدة D1 إلى R2 bucket مع تشفير at-rest.

## 12. اتصال

لأي استفسار أمني عاجل (لا يتعلّق بثغرة محدّدة):
- افتح Issue عامة وضع وسم `security` فقط للاستفسارات غير الحساسة.
- للأمور السرّية: استخدم GitHub Security Advisories الخاص.
