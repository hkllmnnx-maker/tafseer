# بنية البيانات — منصّة تفسير

> آخر تحديث: 2026-05-02

هذا المستند يصف **نموذج البيانات** في مشروع تفسير، سواء في وضع
**seed** الحالي (TypeScript modules داخل `src/data/*`) أو في وضع
**D1** المستهدف (Cloudflare D1 SQLite).

---

## 1. نظرة عامة

تنقسم البيانات إلى ست كيانات أساسيّة:

| الكيان    | المصدر الحالي           | الجدول المقابل في D1 |
|-----------|-------------------------|----------------------|
| السور     | `src/data/surahs.ts`    | `surahs`             |
| الكتب     | `src/data/books.ts`     | `books`              |
| المؤلّفون | `src/data/authors.ts`   | `authors`            |
| الموضوعات | `src/data/categories.ts`| `categories`         |
| الآيات    | `src/data/ayahs.ts`     | `ayahs`              |
| التفاسير  | `src/data/tafseers.ts`  | `tafsir_entries`     |

ملفّات الترحيل: `db/migrations/0001_initial_schema.sql`
و `db/migrations/0002_optional_fts.sql`.

---

## 2. الجداول

### 2.1 `surahs`
- `number` (PK): 1..114
- `name`, `name_latin`, `ayah_count`, `type` (مكية/مدنية), `order` (ترتيب النزول)

### 2.2 `books`
- `id` (PK): مثل `saadi`, `ibn-kathir`, `qurtubi`
- `title`, `author_id` (FK → authors), `school`, `century`, `popularity`, `featured`

### 2.3 `authors`
- `id` (PK)
- `name`, `birth_year`, `death_year`, `school`, `origin`, `bio`

### 2.4 `categories`
- `id` (PK)
- `name`, `description`, `icon`

### 2.5 `ayahs`
- `(surah, number)` (PK مركّب)
- `text`, `juz`, `page`
- ملاحظة: ليست **كل** الآيات مدرجة حاليًا — فقط عيّنة (~295 آية).
  راجع `src/lib/coverage.ts` لمعرفة التغطية الفعليّة.

### 2.6 `tafsir_entries`
- `id` (PK), `book_id` (FK), `surah` (FK), `ayah`
- `text`: نص التفسير (قد يكون ملخّصًا أو نقلًا أصليًا — يُحدَّد بـ `source_type`).
- `source` / `source_name`: اسم المصدر المعروض.
- **حقول التحقّق العلمي** (مهمّة جدًا):
  - `source_type`: `original-text` | `summary` | `sample` | `translation` | `paraphrase`
  - `verification_status`: `verified` | `partially-verified` | `unverified` | `pending`
  - `is_original_text`: bool — لا يجوز أن يكون `true` إلا إذا كان النص نقلًا حرفيًا.
  - `edition`, `page`, `volume` — مرجعيّة للنسخة الورقيّة.
  - `reviewer_note` — ملاحظة المراجع، تظهر في الواجهة فقط للحالات الخاصة.

---

## 3. الفهارس

`0001_initial_schema.sql` ينشئ فهارس على:
- `tafsir_entries(surah, ayah)` — أهم استعلام (جلب تفاسير آية معيّنة).
- `tafsir_entries(book_id)`     — صفحة الكتاب.
- `tafsir_entries(source_type, verification_status)` — فلاتر البحث.
- `ayahs(surah)` — صفحة القراءة المتسلسلة.

## 4. FTS5 (اختياري)

الفهرس النصّي الكامل (`tafsir_entries_fts`) **مفصول** في
`0002_optional_fts.sql` لأن FTS5 ليس مضمونًا في كل بيئات D1.
طبّقه فقط بعد التأكد من توفّره:

```bash
wrangler d1 execute tafseer-production --command "SELECT fts5(0)"
```

إن نجح، نفّذ:
```bash
wrangler d1 migrations apply tafseer-production
```

ثم اعتمد البحث النصّي السريع في `src/lib/data/d1-provider.ts` (مستهدف).

---

## 5. وضعا التشغيل

### Seed mode (الحالي)
- البيانات داخل `src/data/*.ts`.
- لا يحتاج إلى Cloudflare account.
- مناسب للتطوير المحلي والاختبار والـ CI.
- محدود الحجم (~100 إدخال تفسير).

### D1 mode (المستهدف)
- البيانات داخل قاعدة `tafseer-production` على Cloudflare D1.
- يدعم البحث النصّي الكامل.
- يدعم آلاف الإدخالات.
- راجع `docs/d1-setup.md` لخطوات الإعداد.

التبديل بينهما يتمّ عبر **Data Access Layer** (`src/lib/data/index.ts`):
- إذا كان `env.DB` متاحًا → D1 provider.
- وإلّا → seed provider.
