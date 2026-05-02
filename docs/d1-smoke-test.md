# D1 Smoke Test — تشغيل D1 محليًا والتحقق من `mode: d1`

هذا الدليل يشرح كيفية اختبار اتصال التطبيق بقاعدة بيانات Cloudflare D1
**محليًا** بدون الحاجة إلى أسرار في CI أو في المستودع، ثم التأكد أن
DataProvider يعمل في وضع `d1` فعلًا (وليس `seed`).

> ⚠️ المستودع يُسلَّم افتراضيًا بقسم `d1_databases` معلَّقًا في `wrangler.jsonc`.
> هذا متعمَّد كي لا يُسرَّب `database_id` حقيقي. عليك أنت تفعيله محليًا.

---

## الفحص السريع (لا يحتاج أسرارًا)

```bash
npm run d1:smoke
```

السكربت `scripts/d1-smoke-check.mjs` يتحقق من:

- وجود `dist/import/seed-data.sql` و `dist/import/seed-data.json`.
- أن seed SQL يبدأ بـ `PRAGMA`/`BEGIN` وينتهي بـ `COMMIT`.
- خلو SQL من literals خطيرة (`undefined`, `NaN`).
- وجود `db/migrations/*.sql`.
- إمكانية تحليل `wrangler.jsonc`.
- توفر `wrangler` CLI.
- (اختياري) إن كان `d1_databases` مفعّلًا، يحاول تنفيذ `SELECT 1`
  على D1 محليًا — بدون أي أسرار وغير مدمّر.

أوضاع إضافية:

```bash
# مخرجات JSON قابلة للقراءة آليًا
node scripts/d1-smoke-check.mjs --json

# يفشل إذا artefacts ناقصة (للاستخدام في CI صارم — اختياري)
node scripts/d1-smoke-check.mjs --strict
```

---

## التشغيل الفعلي مع D1 محليًا (خطوة بخطوة)

### 1) إنشاء قاعدة بيانات D1 (مرة واحدة)

```bash
npx wrangler login
npx wrangler d1 create tafseer-production
```

سيطبع Wrangler شيئًا مثل:

```
✅ Successfully created DB 'tafseer-production'
[[d1_databases]]
binding = "DB"
database_name = "tafseer-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2) تفعيل D1 binding في `wrangler.jsonc`

أزل التعليق `//` عن قسم `d1_databases` وضع `database_id` الفعلي:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "tafseer-production",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
]
```

> 🔒 **لا ترفع `database_id` الحقيقي إلى Git إذا كان حساسًا في سياقك**.
> يمكنك إبقاؤه كـ `REPLACE_WITH_REAL_D1_ID` في الـrepo، ووضع القيمة
> الفعلية محليًا فقط (أو في إعدادات Cloudflare Pages للإنتاج).

### 3) توليد seed SQL

```bash
npm run export:seed-sql
# يُنتج: dist/import/seed-data.sql + dist/import/seed-data.json
```

### 4) تطبيق الترحيلات على D1 المحلي

```bash
npm run db:migrate:local
# تكافئ: npx wrangler d1 migrations apply tafseer-production --local
```

### 5) تحميل seed إلى D1 المحلي

```bash
npx wrangler d1 execute tafseer-production --local \
  --file=dist/import/seed-data.sql
```

### 6) بناء التطبيق وتشغيله مع D1

```bash
npm run build
npx wrangler pages dev dist --d1=tafseer-production --local --ip 0.0.0.0 --port 3000
```

أو عبر PM2 — عدّل `ecosystem.config.cjs` ليضيف `--d1=tafseer-production --local`:

```bash
pm2 start ecosystem.config.cjs
```

### 7) التأكد أن DataProvider في وضع `d1`

```bash
curl http://localhost:3000/api/stats
```

يجب أن ترى في الجواب:

```json
{
  "mode": "d1",
  "data": { ... }
}
```

إن رأيت `"mode": "seed"` بدلًا من `"d1"`، فإن D1 binding غير ممرَّر إلى
الـ Worker. تحقق من أن `--d1=tafseer-production` في أمر الـ dev، وأن
`wrangler.jsonc` يحتوي قسم `d1_databases` غير معلَّق.

### 8) فحص بيانات فعلية

```bash
curl 'http://localhost:3000/api/ayah/1/1' | jq
curl 'http://localhost:3000/api/search?q=الله' | jq '.mode, (.data.results | length)'
curl 'http://localhost:3000/api/stats/detailed' | jq '.mode'
```

---

## في CI

CI لا يحتاج أسرار Cloudflare. يستدعي فقط:

```bash
npm run d1:smoke
```

الذي يفحص artefacts على القرص (seed SQL، migrations، wrangler.jsonc).
لا يحاول الاتصال بـ Cloudflare API ولا برفع secrets.

---

## ✅ تقرير تشغيل D1 محليًا فعليًا (Verified Run)

تم تشغيل D1 محليًا فعليًا والتحقق من جميع نقاط النهاية. النتائج موثَّقة هنا
كدليل أن `mode: "d1"` يعمل على البنية الحالية.

### إعداد `wrangler.jsonc` المحلي (لا يُرفع إلى Git)

استُخدمت قيمة `database_id` placeholder صفرية لأن `--local` لا تتصل
بـ Cloudflare الحقيقي:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tafseer-production",
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "db/migrations"
    }
  ]
}
```

> 💡 **`migrations_dir`** ضرورية لأن المشروع يضع الترحيلات في `db/migrations/`
> بدلًا من المسار الافتراضي `migrations/`.

### الخطوات المنفَّذة بالكامل

```bash
# 1) توليد seed SQL
npm run export:seed-sql
# ✓ dist/import/seed-data.sql  (177.1 KB)
# ✓ dist/import/seed-data.json (152.5 KB)

# 2) تطبيق الترحيلات محليًا
npx wrangler d1 migrations apply tafseer-production --local
# ✅ 0001_initial_schema.sql
# ✅ 0002_optional_fts5.sql
# 🚣 42 commands executed successfully

# 3) تحميل seed إلى D1 المحلي
npx wrangler d1 execute tafseer-production --local \
  --file=dist/import/seed-data.sql
# success: true

# 4) تأكيد الأعداد في D1
npx wrangler d1 execute tafseer-production --local \
  --command="SELECT (SELECT COUNT(*) FROM surahs) AS surahs,
                    (SELECT COUNT(*) FROM ayahs) AS ayahs,
                    (SELECT COUNT(*) FROM tafsir_books) AS books,
                    (SELECT COUNT(*) FROM authors) AS authors,
                    (SELECT COUNT(*) FROM tafsir_entries) AS tafseers"
# surahs=114, ayahs=295, books=12, authors=12, tafseers=97

# 5) بناء التطبيق
npm run build
# ✓ dist/_worker.js  332.16 kB

# 6) تشغيل Wrangler Pages مع D1 binding
npx wrangler pages dev dist --d1=DB=tafseer-production \
  --local --ip 0.0.0.0 --port 3000
# ✨ Compiled Worker successfully
# Your Worker has access to the following bindings:
#   env.DB (local-DB=tafseer-production)   D1 Database   local
# [wrangler:info] Ready on http://0.0.0.0:3000
```

### نتائج اختبار جميع نقاط النهاية API

| Endpoint | mode | الحقول الرئيسية |
|---|---|---|
| `/api/stats` | **d1** ✅ | surahs=114, ayahs=295, books=12, authors=12, tafseers=100 |
| `/api/stats/detailed` | **d1** ✅ | totals, perBook, perAuthor, bySchool, byCentury, topSurahs, ayahsCoveredCount, ayahsCoverageRatio, bySourceType, byVerification, scientific |
| `/api/ayah/1/1` | **d1** ✅ | نص الآية + 5 تفاسير |
| `/api/ayah/999/999` | — | HTTP 404 (`surah_not_found`) |
| `/api/search?q=الله` | **d1** ✅ | total=81, items=10 |
| `/api/search?q=الله&sourceTypes=summary` | **d1** ✅ | الفلترة تعمل |
| `/api/suggest?q=الرحمن` | **d1** ✅ | 8 اقتراحات |
| `/api/surahs` | **d1** ✅ | 114 سورة |
| `/api/books` | **d1** ✅ | 12 كتاب |
| `/api/authors` | **d1** ✅ | 12 مؤلف |

### نتائج اختبار صفحات HTML

| Page | HTTP | الحجم | ملاحظات |
|---|---|---|---|
| `/` | 200 | ~47 KB | الصفحة الرئيسية |
| `/search` | 200 | ~66 KB | فلاتر + شبكة بحث |
| `/search?q=الله` | 200 | ~67 KB | نتائج فعلية من D1 |
| `/ayah/1/1` | 200 | ~40 KB | آية + تفاسير |
| `/ayah/999/999` | 404 | ~14 KB | معالجة سليمة |
| `/dashboard` | 200 | ~54 KB | يعرض شارة `وضع البيانات: D1 (متّصل)` ✅ |
| `/surahs` | 200 | ~128 KB | قائمة 114 سورة |
| `/books` | 200 | ~36 KB | قائمة الكتب |
| `/authors` | 200 | ~36 KB | قائمة المؤلفين |
| `/methodology` | 200 | ~20 KB | منهجية المشروع |
| `/sitemap.xml` | 200 | ~71 KB | يحوي كل الآيات والصفحات |
| `/robots.txt` | 200 | 123 B | OK |
| `/manifest.json` | 200 | ~1 KB | PWA manifest |

### النتيجة

✅ **DataProvider يعمل في وضع `d1` فعليًا** عبر جميع نقاط النهاية.
✅ **شارة Dashboard** تعرض «وضع البيانات: D1 (متّصل)».
✅ **الفلاتر** (`sourceTypes`, `verificationStatuses`) تعمل عبر D1.
✅ **404 handling** صحيح للآيات/السور غير الموجودة.
✅ **No real `database_id`** committed — استُخدم placeholder صفري.
✅ **wrangler.jsonc** أُعيد إلى حالته الأصلية (D1 معلَّق) قبل الـ commit.

---

## ملاحظات أمان

- لا تضع `database_id` حقيقي في commit إذا كان مشروعك حساسًا.
- لا تضف admin routes تكتب على D1 من الإنترنت.
- استعمل `prepared statements` (`.bind()`) دائمًا — راجع `src/lib/data/d1-provider.ts`.
- لا تستعمل string interpolation للمدخلات — مسموح فقط لأسماء أعمدة
  ثابتة من قائمة بيضاء.
- لا تدخل بيانات قرآن أو تفسير من مصادر غير موثوقة. راجع
  `docs/scientific-verification.md` و `docs/importing-data.md`.
