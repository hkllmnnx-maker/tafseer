# خطة استيراد التفسير الكامل (Full Tafsir Import Plan)

> آخر تحديث: 2026-05-02
>
> هذه الوثيقة تصف الخطوات اللازمة لاستيراد كتاب تفسير كامل (مثل تفسير ابن كثير،
> تفسير السعدي، التفسير الميسَّر، الطبري، …) إلى قاعدة Cloudflare D1 الإنتاجيّة
> لمشروع **تفسير**، مع ضمان نسبة المحتوى إلى مصدر موثَّق، رفض النصوص بلا مرجع،
> ومنع تسرّب الملخّصات على أنّها نصوص أصليّة.

> **الحالة:** مسوَّدة عمليّة — جاهزة للمراجعة. أوّل دفعة استيراد ستكون عيّنة
> صغيرة من تفسير مختار (مثل تفسير السعدي أو ابن كثير أو الميسَّر) بعد التأكّد
> من حقوق النشر / كون المصدر في الملك العام.

## وثائق ذات صلة

- [`docs/d1-setup.md`](./d1-setup.md) — إعداد قاعدة D1 محليًا.
- [`docs/d1-smoke-test.md`](./d1-smoke-test.md) — فحص جاهزية D1.
- [`docs/quran-import-plan.md`](./quran-import-plan.md) — خطة استيراد القرآن الكامل (سابقة على هذه).
- [`docs/scientific-verification.md`](./scientific-verification.md) — منهجيّة المراجعة العلميّة.
- [`SECURITY.md`](../SECURITY.md) — متطلّبات الأمان والـ bind parameters.
- [`db/migrations/0001_initial_schema.sql`](../db/migrations/0001_initial_schema.sql) — مخطَّط الجداول.

---

## 1) المبادئ الأساسيّة (Hard Rules)

1. **لا نصّ بدون مصدر**: كل إدخال `text` لتفسير يجب أن يحمل `sourceName` و
   (`edition` أو `page` أو `volume` أو `sourceUrl`) — وإلا يُرفض الملف.
2. **لا تَخَلُّط بين الأصل والملخَّص**: حقل `sourceType` إلزامي ويميِّز:
   - `original-text` (نصّ المؤلِّف الأصلي حرفيًا)
   - `summary` (ملخَّص بأسلوب فريق المشروع)
   - `curated` (مختار من عدة مصادر — يجب توثيقها كلها)
   - `sample` (عيّنة عرض، لا تُستَخدم في الإنتاج)
   - `review-needed` (يحتاج مراجعة قبل النشر)
3. **حالة التحقق العلمي** (`verificationStatus`): إلزامي وأحد القيم:
   - `verified` (روجع وأقرّه مراجع علمي)
   - `partially-verified` (روجع جزئيًا)
   - `unverified` (لم يُراجَع — لا يعرضه الواجهة الإنتاجيّة افتراضيًا)
   - `flagged` (مُعلَّم بمشكلة — يُحجَب)
4. **حقوق النشر**: لا نستورد إلا تفاسير في الملك العام، أو بترخيص متوافق
   (مثل CC0/CC-BY)، أو بإذن صريح من الناشر.
5. **عدم إضافة تفسير إلى Git**: ملفات التفسير الكاملة لا تدخل المستودع. تُوضَع
   محليًا في `.imports/` (مُستَثناة في `.gitignore`).
6. **ربط الإدخال بآية موجودة**: كل إدخال له `(surah, ayah)` صحيحة قرآنيًا
   ضمن قيود `1..114` و `1..ayahCount[surah]`.
7. **لا أسرار**: لا API keys، لا database_id حقيقيّ، لا tokens في أيّ ملف.

---

## 2) صيغة ملف JSON المعتمدة (`Tafsir JSON`)

```jsonc
{
  // ===== Metadata على مستوى الكتاب =====
  "book": {
    "id":           "ibn-kathir",                              // معرّف فريد slug-style
    "title":        "تفسير القرآن العظيم",                     // عنوان الكتاب
    "shortTitle":   "تفسير ابن كثير",                          // اختياري
    "schools":      ["بالمأثور"],                              // ALLOWED_SCHOOLS فقط
    "century":      8,                                          // قرن الوفاة بالهجري
    "language":     "ar",                                       // ISO 639-1
    "popularity":   95,                                         // 0..100 (للترتيب)
    "license":      "Public Domain",                            // إلزامي
    "sourceUrl":    "https://shamela.ws/book/12345",            // HTTPS إلزامي
    "edition":      "تحقيق سامي السلامة - دار طيبة - ط 2",     // اختياري
    "isbn":         "978-XXXX-XXXX-XX",                          // اختياري
    "verificationStatus": "verified"
  },
  // ===== Metadata على مستوى المؤلِّف =====
  "author": {
    "id":         "ibn-kathir",
    "name":       "أبو الفداء إسماعيل ابن كثير الدمشقي",
    "deathYear":  774,                                          // hijri
    "birthYear":  701,                                          // hijri (اختياري)
    "schools":    ["بالمأثور"],
    "biography":  "محدّث ومفسّر ومؤرخ من علماء الشام في القرن الثامن.",
    "sourceUrl":  "https://example.org/biographies/ibn-kathir"
  },
  // ===== Metadata على مستوى الملف نفسه =====
  "meta": {
    "schemaVersion": "1.0",
    "exportedAt":    "2026-05-02T12:00:00Z",
    "exportedBy":    "tafseer-project / scripts/exporters/...",
    "checksum":      "sha256:..."                                // اختياري
  },
  // ===== الإدخالات الفعلية (الأهم) =====
  "entries": [
    {
      "id":                   "ibn-kathir-001-001",              // فريد ضمن الكتاب
      "surah":                1,                                  // 1..114
      "ayah":                 1,                                  // 1..ayahCount
      "text":                 "نصّ التفسير كاملاً ...",           // إلزامي - غير فارغ
      "sourceType":           "original-text",
      "verificationStatus":   "verified",
      "isOriginalText":       true,                                // مرادف لـ sourceType==='original-text'
      "sourceName":           "تفسير القرآن العظيم - ابن كثير",   // إلزامي مع original-text
      "edition":              "تحقيق سامي السلامة - دار طيبة - ط 2",
      "volume":               1,                                   // اختياري
      "page":                 117,                                 // اختياري
      "sourceUrl":            "https://shamela.ws/book/12345/...", // HTTPS فقط
      "reviewerNote":         "روجع بمقابلة ط دار طيبة",          // اختياري
      "isSample":             false                                 // افتراضيًا false في الإنتاج
    }
  ]
}
```

### قواعد إلزاميّة على الإدخالات:

| الحقل | إلزامي | القيود |
|---|---|---|
| `id` | نعم | فريد ضمن الكتاب — لا تكرار |
| `surah` | نعم | integer ∈ [1..114] |
| `ayah` | نعم | integer ∈ [1..ayahCount[surah]] |
| `text` | نعم | غير فارغ، لا يحوي `"undefined"` أو `"null"` كنصّ |
| `sourceType` | نعم | ∈ `original-text|summary|sample|curated|review-needed` |
| `verificationStatus` | نعم | ∈ `verified|partially-verified|unverified|flagged` |
| `sourceName` | إلزامي إذا `sourceType=original-text` | غير فارغ |
| `edition`/`page`/`volume` | يلزم واحد منها على الأقل إذا `sourceType=original-text` | غير فارغ |
| `sourceUrl` | اختياري؛ إلزامي في `--strict` | HTTPS فقط |
| `isOriginalText` | يجب أن يطابق `sourceType==='original-text'` | boolean |

### قواعد على مستوى الكتاب:

- `book.id` يتطابق مع كلّ `entries[*]` (لا يخلط بين كتب متعدّدة في ملف واحد).
- `book.license` غير فارغ — يجب توثيق الترخيص.
- `book.sourceUrl` HTTPS.
- `book.schools[]` ⊆ `{بالمأثور, بالرأي, فقهي, لغوي, بلاغي, معاصر, ميسر, موسوعي}`.

---

## 3) خطوات الاستيراد العمليّة

### الخطوة 1: التحضير والتنزيل

1. ضع ملف التفسير الكامل في `.imports/tafsir-<book-id>.full.json` محليًا.
2. **لا تُضِفه إلى Git**: تأكَّد أن `.gitignore` يستثني `.imports/` و `*.full.json`.
3. تأكَّد أن المصدر في الملك العام أو لديك إذن خطي بالاستيراد.

### الخطوة 2: التحقق قبل الاستيراد (Dry-run)

```bash
# تحقّق سريع — لا يستورد، فقط يطبع التقرير
node scripts/importers/validate-tafsir-json.mjs .imports/tafsir-ibn-kathir.full.json --dry-run

# تحقّق صارم — يفشل إن كان أيّ حقل من sourceUrl/license مفقودًا
node scripts/importers/validate-tafsir-json.mjs .imports/tafsir-ibn-kathir.full.json --strict --dry-run

# تقرير JSON قابل للقراءة آليًا (للـ CI أو dashboards)
node scripts/importers/validate-tafsir-json.mjs .imports/tafsir-ibn-kathir.full.json --strict --json
```

النواتج المتوقّعة في وضع النجاح:
- عدد الإدخالات المقبولة.
- عدد الإدخالات المرفوضة (يجب أن يكون 0 في `--strict`).
- عدد التحذيرات.
- توزيع الإدخالات حسب السورة.
- إحصاءات `sourceType` و `verificationStatus`.

### الخطوة 3: المراجعة العلميّة لعيّنة عشوائيّة

> هذه الخطوة **لا يقوم بها سكربت**. لا تستورد قبل إتمامها.

- اختر 30 إدخالًا عشوائيًا (مع تركيز على آيات الأحكام والعقيدة).
- قابل النصّ بالطبعة المعتمَدة المطبوعة أو PDF رسمي.
- إن وجدت أيّ خطأ:
  - علِّم الإدخال بـ `verificationStatus: "flagged"` ولا تستورده.
  - وثِّق الخطأ في `docs/scientific-verification.md`.
- لا تتقدَّم للخطوة 4 إلا بعد توقيع المراجع.

### الخطوة 4: توليد SQL للاستيراد (TODO — مستورد فعلي)

> **حالة هذه الخطوة:** سكربت `import-tafsir.mjs` لم يُكتَب بعد. هذه الخطة
> تحدّد عقده، وسيُكتب في مرحلة لاحقة بعد ترسيخ الـ validator.

العقد المخطَّط لـ `scripts/importers/import-tafsir.mjs`:

```bash
node scripts/importers/import-tafsir.mjs <file.json> \
  [--strict]               # يرفض أيّ إدخال بدون sourceName/sourceUrl
  [--allow-partial]        # يسمح بدخول جزء من الكتاب (مثلاً سور محدَّدة)
  [--book-id=<id>]         # يفرض book.id ولا يقبل غيره
  [--max-entries=N]        # حدّ أعلى للإدخالات (للاختبار)
  [--out=dist/import/tafsir-<id>.sql]
```

ينتج SQL بصيغة:

```sql
-- 1) Upsert للمؤلِّف
INSERT INTO authors (id, name, death_year, schools, biography, source_url)
  VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, ...;
-- 2) Upsert للكتاب
INSERT INTO tafsir_books (id, title, author_id, schools, century, popularity,
                          license, source_url, edition, verification_status)
  VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ...;
-- 3) Insert للإدخالات (مع تجنّب التكرار)
INSERT INTO tafsir_entries (id, book_id, author_id, surah_number, ayah_number,
                            text, source_type, verification_status,
                            is_original_text, source_name, edition, volume,
                            page, source_url, reviewer_note, is_sample)
  VALUES (?,...) ON CONFLICT(id) DO NOTHING;
```

**ضمانات إلزاميّة في المستورِد:**
- استخدام `.bind()` فقط — لا interpolation للنصوص داخل SQL.
- escape الكامل للنصوص العربيّة (`'` → `''`).
- TRANSACTION واحدة لكلّ ملف.
- إخراج تقرير `dist/import/tafsir-<id>.report.json` بعدد الـ inserts/updates.

### الخطوة 5: التطبيق على D1 المحلي أوّلًا

```bash
npx wrangler d1 execute tafseer-production --local \
  --file=dist/import/tafsir-ibn-kathir.sql

# فحص ما بعد التطبيق
npx wrangler d1 execute tafseer-production --local --command="
  SELECT COUNT(*) FROM tafsir_entries WHERE book_id='ibn-kathir';
  SELECT source_type, COUNT(*) FROM tafsir_entries WHERE book_id='ibn-kathir' GROUP BY source_type;
  SELECT verification_status, COUNT(*) FROM tafsir_entries WHERE book_id='ibn-kathir' GROUP BY verification_status;
"
```

### الخطوة 6: اختبار الـ API محليًا

- `GET /api/books/ibn-kathir` يجب أن يعيد metadata الكتاب.
- `GET /api/ayah/1/1` يجب أن يحوي تفسير ابن كثير ضمن `tafseers[]`.
- `GET /api/search?q=...&books=ibn-kathir` يعمل.
- شارة `mode: "d1"` في النتائج.

### الخطوة 7: التطبيق على الإنتاج

> فقط بعد نجاح كل ما سبق على المحلي ومراجعة الـ diff لـ SQL.

```bash
npx wrangler d1 execute tafseer-production \
  --file=dist/import/tafsir-ibn-kathir.sql

npx wrangler pages deploy dist --project-name tafseer
```

---

## 4) منع إدخال ملخَّص كأنه نصّ أصلي

الـ validator يطبِّق هذه الفحوص:

1. إذا `sourceType === 'original-text'` و `isOriginalText !== true` → **خطأ**.
2. إذا `isOriginalText === true` و `sourceType !== 'original-text'` → **خطأ**.
3. إذا `sourceType === 'original-text'` و(لا `sourceName` أو لا واحد من
   `edition/page/volume`) → **خطأ**.
4. إذا `sourceType === 'summary'` و طول النصّ > 5000 حرف → **تحذير** (الملخّصات
   عادة لا تكون بهذا الطول؛ قد يكون نصًّا أصليًا مُغَلَّفًا خطأً).
5. النص لا يحتوي حرفيًا الكلمات: `"undefined"`, `"null"`, `"NaN"` — يُرفض.
6. نسبة التشكيل (إذا متوفِّر) — مجرّد إحصاء، لا يُرفض.

---

## 5) منع التكرار وضمان السلامة

- `entries[*].id` فريد داخل الملف — تكرار = خطأ.
- زوج `(book.id, surah, ayah)` لا يتكرّر — تكرار = خطأ.
- على D1، الـ index الفريد على `(book_id, surah_number, ayah_number, id)` يحمي
  من إدخال مزدوج.

---

## 6) خطة المراجعة العلميّة لعيّنة عشوائيّة

> هذه ليست خطوة تقنيّة، لكن جزء من العقد قبل أيّ نشر.

1. اختر 30 آية عشوائيًا، بشرط:
   - 5 من سور قصيرة (الإخلاص، الناصر، الفلق…)
   - 10 من آيات الأحكام (الأنعام/المائدة/البقرة).
   - 10 من آيات العقيدة (آل عمران/الأنبياء/طه).
   - 5 من المتشابهات (يس/الفاتحة/الكهف).
2. قابل النصّ بالنسخة الورقيّة المعتمدة (طبعة دار طيبة لابن كثير، الرسالة
   للسعدي، …).
3. سجّل النتائج في `docs/scientific-verification.md` بتاريخ ووقّع المراجع.
4. إن تجاوز معدّل الأخطاء 1٪ — ارفض الكتاب كلّه وأعد التحقّق من المصدر.

---

## 7) العيّنات الموجودة في `fixtures/`

| الملف | الوصف | الاستعمال في CI |
|---|---|---|
| `fixtures/import-samples/tafsir-valid-sample.json` | 5 إدخالات صحيحة من تفسير ابن كثير (عينة Public Domain) | يجب أن ينجح في validate |
| `fixtures/import-samples/tafsir-invalid-sample.json` | 6 أخطاء متعمَّدة لاختبار رفض الـ validator | يجب أن يفشل في validate |

تُختبر العيّنات تلقائيًا في `tests/tafsir-validator.test.mjs`.

---

## 8) أوامر npm المتعلِّقة

```bash
# التحقّق من العيّنة الصالحة (لا يحتاج Cloudflare)
npm run validate:tafsir-sample

# التحقّق من ملف خارجي (دفعة كاملة محليًا)
node scripts/importers/validate-tafsir-json.mjs .imports/tafsir-ibn-kathir.full.json --strict --dry-run

# تقرير JSON
node scripts/importers/validate-tafsir-json.mjs <file> --json --strict
```

---

## 9) قائمة التحقّق قبل النشر (Pre-publish Checklist)

- [ ] التحقّق من حقوق النشر (Public Domain / إذن خطي).
- [ ] `validate-tafsir-json.mjs --strict` يمرّ على الملف الكامل.
- [ ] مراجعة عيّنة عشوائيّة (30 إدخالًا) من قِبل مراجع علمي.
- [ ] `import-tafsir.mjs` (عند توفّره) ولّد SQL بنجاح.
- [ ] `wrangler d1 execute --local` نجح والإحصاءات معقولة.
- [ ] اختبار API محليًا على عيّنة من الآيات.
- [ ] `npm test` يمرّ.
- [ ] تحديث `README.md` بعدد الكتب الجديدة.
- [ ] تحديث `docs/scientific-verification.md` بنتائج المراجعة.
- [ ] **لا** أسرار ولا database_id حقيقي ولا ملفات `.imports` في commit.

---

## 10) خارج النطاق (Out of Scope) لهذه الجولة

- استيراد تفسير كامل فعلي (ينتظر ملفًا موثوقًا خارج Git).
- بناء واجهة مستخدم لاختيار/تحميل ملفات التفسير من الـ Dashboard.
- ربط آلي بـ APIs خارجيّة (Tanzil، Tafsir.app، …) — يحتاج اتفاقية ترخيص أوّلًا.
- التحويل التلقائي من PDF إلى JSON — يحتاج OCR + مراجعة بشريّة.

---

## 11) ملاحظات للمطوّر القادم

- لا تَدمِج ملفات تفاسير متعدّدة في ملف JSON واحد. كلّ كتاب في ملف.
- لا تَخمِّن `id`؛ استَخدِم slug ثابتًا متّفقًا عليه (مثل `ibn-kathir`,
  `saadi`, `tabari`, `muyassar`).
- الـ validator صارم بشأن `sourceType==='original-text'` — هذا متعمَّد.
- إذا لم تعرف حالة الترخيص بشكل قاطع، **لا تستورد**. الأولويّة للأمانة العلميّة.
