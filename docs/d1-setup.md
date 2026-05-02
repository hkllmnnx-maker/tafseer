# إعداد Cloudflare D1 لمشروع تفسير

> هذا الدليل يشرح كيفية الانتقال من **seed mode** (البيانات داخل `src/data/*`)
> إلى **D1 mode** (قاعدة بيانات Cloudflare D1) دون كسر التطبيق الحالي.

---

## 1) فلسفة التشغيل: seed mode مقابل D1 mode

| الجانب | seed mode (الحالي) | D1 mode (المستهدف) |
|---|---|---|
| مصدر البيانات | ملفات TS في `src/data/*` | جداول في Cloudflare D1 (SQLite) |
| البحث | في الذاكرة (Array.filter) | SQL + indexes (+ FTS5 اختياريًا) |
| الحجم الموصى به | حتى ~5000 إدخال | غير محدود فعليًا |
| النشر | داخل bundle الـ Worker | جدول مستقلّ خارج الـ Worker |
| التبديل | افتراضي إذا لا يوجد binding | يُفعَّل عند وجود `DB` binding |

التطبيق يستعمل **Data Access Layer** (`src/lib/data/`) يختار مزوّد البيانات
تلقائيًا: إذا كان `env.DB` موجودًا فإنه يستعمل D1 provider، وإلا يعود إلى
seed provider. لا يحتاج كود الواجهة إلى أي تعديل.

---

## 2) إنشاء قاعدة D1

```bash
# 1. تسجيل الدخول إلى Cloudflare
npx wrangler login

# 2. إنشاء قاعدة الإنتاج
npx wrangler d1 create tafseer-production
# ملاحظة: انسخ database_id من المخرجات وضعه في wrangler.jsonc
```

ستحصل على مخرجات مثل:

```
[[d1_databases]]
binding = "DB"
database_name = "tafseer-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 3) تعديل `wrangler.jsonc`

أزل التعليقات حول قسم `d1_databases` وضع المعرّف الذي حصلت عليه:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "webapp",
  "compatibility_date": "2026-04-13",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tafseer-production",
      "database_id": "PUT-YOUR-ID-HERE"
    }
  ]
}
```

---

## 4) تشغيل migration محليًا

```bash
# 1. تطبيق المخطط الأساسي (بدون FTS5)
npx wrangler d1 migrations apply tafseer-production --local

# 2. اختيارياً — لو أردت FTS5 (تأكّد أن D1 يدعمه أولًا)
#    سيتم تطبيق 0002_optional_fts.sql ضمن migrations apply تلقائيًا
#    لأنه ضمن مجلد db/migrations.
#    إن لم ترغب بتطبيقه، انقله مؤقتًا خارج المجلد قبل التشغيل.
```

> 📌 **نصيحة**: تشغيل التطبيق محليًا مع D1:
>
> ```bash
> npx wrangler pages dev dist --d1=tafseer-production --local --ip 0.0.0.0 --port 3000
> ```

---

## 5) تشغيل migration إنتاجيًا

```bash
# تطبيق على Cloudflare الإنتاج
npx wrangler d1 migrations apply tafseer-production

# تحقق من الجداول
npx wrangler d1 execute tafseer-production \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

---

## 6) حول FTS5 (البحث النصي الكامل)

FTS5 ليس مضمونًا في كل نُسخ D1. للتحقق:

```bash
npx wrangler d1 execute tafseer-production --local \
  --command "SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
```

- **إذا كانت النتيجة فارغة**: لا تطبّق `0002_optional_fts.sql`.
  ابقَ على البحث عبر `LIKE` (يعمل لكنه أبطأ على البيانات الضخمة).
- **إذا ظهرت `ENABLE_FTS5`**: طبّق الترحيل وستحصل على بحث نصي سريع
  مع تطبيع التشكيل العربي.

> راجع `db/migrations/0002_optional_fts.sql` للتفاصيل وآلية الـ rollback.

---

## 7) الفرق بين الوضعين في الكود

في `src/lib/data/index.ts` يتم اختيار المزوّد:

```ts
// Pseudo-code (الواقع موجود في الملفات الفعلية)
export function getDataProvider(env?: { DB?: D1Database }) {
  if (env?.DB) return makeD1Provider(env.DB)   // قادم
  return seedProvider                          // الحالي الافتراضي
}
```

لا تستدعِ `TAFSEERS` و `AYAHS` مباشرة من الـ pages الجديدة —
استدعِ المزوّد بدلاً من ذلك ليبقى الكود متوافقًا مع المستقبل.

---

## 8) سكربتات npm للـ D1

```jsonc
"db:migrate:local": "wrangler d1 migrations apply tafseer-production --local",
"db:migrate:prod":  "wrangler d1 migrations apply tafseer-production"
```

ستضاف لاحقًا:
- `db:seed:local` — يُحمِّل بيانات seed داخل D1 محلي للتجربة.
- `db:export` — تصدير محتوى D1 إلى JSON.
- `db:import` — استيراد JSON موثّق إلى D1 (يستعمل المدقّق الموجود).

---

## 9) فحص ما بعد الترحيل

```bash
# عدد الجداول
npx wrangler d1 execute tafseer-production --local \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# تحقق من الفهارس
npx wrangler d1 execute tafseer-production --local \
  --command "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
```

النتيجة المتوقعة:
- 9 جداول رئيسية: `surahs, ayahs, authors, tafsir_books, tafsir_entries,
  categories, book_categories, import_jobs, audit_logs`.
- إن طُبِّق 0002: جدول إضافي `tafsir_entries_fts` + 3 مشغّلات.

---

## 10) خطة الانتقال من seed إلى D1

1. تطبيق `0001_initial_schema.sql` على القاعدة المحلية.
2. تشغيل سكربت seed (سيُضاف لاحقًا) لتعبئة `surahs`, `authors`, `tafsir_books`,
   `categories` من ملفات `src/data/*.ts`.
3. استيراد دفعات `tafsir_entries` عبر المدقّق الحالي
   (`scripts/importers/validate-import.mjs`).
4. تفعيل D1 provider بضبط binding في `wrangler.jsonc`.
5. مراجعة الأداء، ثم تكرار العملية على بيئة الإنتاج.

> ⚠️ لا تنقل قاعدة الإنتاج قبل اختبار كامل على البيئة المحلية.
