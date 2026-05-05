# تقرير حالة البيانات — مشروع تفسير

> تاريخ التقرير: 2026-05-05
> الإصدار: v1.9 (Production-Ready Data Platform)
> الحالة العامة: ✅ القرآن كامل، ✅ تفسير حقيقي مُستورَد ومُتحقَّق

---

## 1) ملخّص تنفيذي

| البند | القيمة | الحالة |
|---|---:|:---:|
| عدد الآيات في D1 | **6,236** / 6,236 | ✅ مكتمل |
| عدد السور المغطّاة | **114** / 114 | ✅ مكتمل |
| نسبة تغطية القرآن | **100%** | ✅ |
| عدد إدخالات تفسير حقيقي (الميسر) | **6,236** | ✅ |
| عدد إدخالات التفسير الإجمالي في D1 | **6,333** (6,236 ميسر + 97 عيّنة كلاسيكية) | ✅ |
| نسبة التفاسير الموثَّقة (verified) | **98.5%** | ✅ |
| `isComplete` في `/api/quran/coverage` | `true` | ✅ |
| `hasSourceMetadata` | `true` | ✅ |
| وضع البيانات (mode) | `d1` | ✅ |

---

## 2) استيراد القرآن الكامل

### المصدر

- **اسم المصدر**: AlQuran Cloud API — Quran Uthmani (Tanzil)
- **URL**: <https://api.alquran.cloud/v1/quran/quran-uthmani>
- **الإصدار**: `quran-uthmani` (مأخوذ من نص Tanzil القياسي)
- **الترخيص**: متاح للاستخدام مع نسبة المصدر (Tanzil + AlQuran Cloud)

### الملفات

| الملف | الحجم | ملاحظات |
|---|---:|---|
| `.imports/quran-uthmani.json` | 4.5 MB | المصدر الخام كما نُزّل من API |
| `.imports/quran-full.json` | 2.4 MB | الصيغة الموحَّدة للمشروع |
| `dist/import/ayahs-full.sql` | 3.4 MB | SQL جاهز لـ D1 (6,236 INSERT OR REPLACE) |
| `dist/import/quran-import-report.json` | 1.1 KB | تقرير الاستيراد + SHA-256 |

### السلامة

- **SHA-256** للملف المصدر: `acc42a3efe032184aa3e38af2e6e40675a45441cf375efcf9c05a91dcfa357b1`
- **التحقق الصارم (`--strict --full`)**: نجح بـ 0 أخطاء و 0 تحذيرات.
- **التغطية**: 114 سورة كاملة، 0 جزئية، 0 فارغة.
- **المصدر في D1**: كل آية تحوي `source_name`, `source_url`, `edition`, `imported_from`, `imported_at` (نسبة 100%).

> ⚠️ ملف `.imports/quran-full.json` و `dist/import/ayahs-full.sql` **غير مرفوعَين** لـ Git (محميان عبر `.gitignore`). يُعاد توليدهما بـ `npm run import:quran`.

---

## 3) استيراد التفسير الحقيقي (Tafsir al-Muyassar)

### المصدر

- **اسم الكتاب**: التفسير الميسر
- **المؤلف/الناشر**: مجمع الملك فهد لطباعة المصحف الشريف
- **URL**: <https://qurancomplex.gov.sa/> (المصدر الرسمي)
- **الإصدار الرقمي**: عبر AlQuran Cloud / Tanzil — `ar.muyassar`
- **API**: <https://api.alquran.cloud/v1/quran/ar.muyassar>
- **الترخيص**: متاح للاستخدام والنشر مع نسبة المصدر
- **اللغة**: العربية
- **النوع**: تفسير ميسَّر — نصّ أصلي (`original-text`)

### الملفات

| الملف | الحجم | ملاحظات |
|---|---:|---|
| `.imports/tafsir-muyassar-raw.json` | 7.7 MB | المصدر الخام من API |
| `.imports/tafsir-real.json` | 6.3 MB | الصيغة الموحَّدة (book/author/meta/entries) |
| `dist/import/tafsir-real.sql` | 7.7 MB | SQL جاهز لـ D1 (6,236 INSERT OR REPLACE) |
| `dist/import/tafsir-import-report.json` | 1.4 KB | تقرير الاستيراد + SHA-256 |

### السلامة

- **SHA-256** للملف الموحَّد: `a1c53c481e84869401d2f5a9cb473f924a0cec6c7967161918674a77d0b77700`
- **التحقق الصارم (`--strict`)**: نجح بـ 0 أخطاء و 0 تحذيرات.
- **التوزيع**:
  - `sourceType=original-text`: 6,236 (100%)
  - `verificationStatus=verified`: 6,236 (100%)
  - السور المغطّاة: 114/114
- **بدون ميتاداتا ناقصة**: 0 إدخال أصلي بدون `source_name` أو `source_url`.

> ⚠️ ملف `.imports/tafsir-real.json` و `dist/import/tafsir-real.sql` **غير مرفوعَين** لـ Git. يُعاد توليدهما بـ `npm run import:tafsir`.

---

## 4) تأكيد قاعدة البيانات (D1 — `tafseer-production`)

### استعلامات تحقق منفَّذة محليًا

```sql
-- إجمالي الآيات
SELECT COUNT(*) FROM ayahs;          -- 6236

-- إجمالي السور المغطّاة
SELECT COUNT(DISTINCT surah_number) FROM ayahs;  -- 114

-- إجمالي التفاسير
SELECT COUNT(*) FROM tafsir_entries; -- 6333

-- التفاسير من الميسر
SELECT COUNT(*) FROM tafsir_entries WHERE book_id='muyassar';  -- 6236

-- السور التي يغطّيها الميسر
SELECT COUNT(DISTINCT surah_number) FROM tafsir_entries
 WHERE book_id='muyassar';  -- 114
```

### تقرير `verify-quran-d1.mjs --strict`

```
✓ totalAyahs    = 6236  (متوقَّع 6236)
✓ surahsCovered = 114   (متوقَّع 114)
✓ duplicates    = 0
✓ emptyText     = 0
✓ source columns = 5 / 5 (source_name, source_url, edition, imported_from, imported_at)
✓ source coverage = 100% (6236/6236)
✓ reference ayahs = 7/7  (1:1, 2:255, 18:10, 36:1, 67:1, 112:1, 114:6)
✓ strict mode   = PASS
```

### تقرير `verify-tafsir-d1.mjs --strict`

```
✓ book exists           : muyassar — التفسير الميسر
✓ author exists         : king-fahd-complex — مجمع الملك فهد لطباعة المصحف الشريف
✓ entries count         : 6236
✓ surahs covered        : 114
✓ empty text            : 0
✓ invalid source_type   : 0
✓ invalid verif. status : 0
✓ original-text without source metadata : 0
✓ distribution          : 6236 original-text · 6236 verified
```

---

## 5) نقاط النهاية (API) المتأثرة

| المسار | السلوك بعد التحديث |
|---|---|
| `GET /api/quran/coverage` | يعيد `{ayahsCount:6236, surahsCovered:114, isComplete:true, hasSourceMetadata:true, coveragePercent:100, mode:'d1'}` |
| `GET /api/stats` | `booksCount=13, authorsCount=13, ayahsCount=6236, tafseersCount=6333, mode='d1'` |
| `GET /api/ayah/1/1` | يعيد البسملة من D1 + تفسير الميسر مع `sourceName`, `sourceType=original-text`, `verificationStatus=verified` |
| `GET /api/ayah/2/255` | آية الكرسي كاملة من D1 |
| `GET /api/ayah/114/6` | آخر آية + تفسير الميسر |
| `GET /api/search?q=...` | بحث على القرآن الكامل + 6,236 تفسير حقيقي |
| `GET /dashboard` | شارة "وضع البيانات: D1 (متّصل)" + شارة "✓ مكتمل" + بطاقة تغطية القرآن 100% |
| `GET /read/:n` | عرض القرآن الكامل + التفاسير الموثَّقة فقط (إن فُعِّل الفلتر) |

---

## 6) خطوات إعادة التوليد (Reproducibility)

```bash
# 1) جلب القرآن الكامل (لا يلتزم بـ Git — يُحفظ محليًا فقط)
mkdir -p .imports
curl -sSL https://api.alquran.cloud/v1/quran/quran-uthmani \
  -o .imports/quran-uthmani.json
node .imports/convert-quran.mjs           # → .imports/quran-full.json

# 2) جلب تفسير الميسر
curl -sSL https://api.alquran.cloud/v1/quran/ar.muyassar \
  -o .imports/tafsir-muyassar-raw.json
node .imports/convert-tafsir-muyassar.mjs # → .imports/tafsir-real.json

# 3) التحقق
node scripts/importers/validate-quran-json.mjs .imports/quran-full.json --full --strict
node scripts/importers/validate-tafsir-json.mjs .imports/tafsir-real.json --strict

# 4) توليد SQL
node scripts/importers/import-quran.mjs .imports/quran-full.json --full --strict
node scripts/importers/import-tafsir.mjs .imports/tafsir-real.json --strict --filename tafsir-real.sql

# 5) تطبيق المهاجرات والاستيراد محليًا
npm run db:migrate:local
npx wrangler d1 execute tafseer-production --local --file=dist/import/seed-data.sql
npx wrangler d1 execute tafseer-production --local --file=dist/import/ayahs-full.sql
npx wrangler d1 execute tafseer-production --local --file=dist/import/tafsir-real.sql

# 6) التحقق النهائي
npm run verify:quran-d1 -- --local --strict
npm run verify:tafsir-d1 -- --local --strict
```

> للإنتاج: استبدل `--local` بدون شيء (يستخدم Cloudflare D1 الفعلي).

---

## 7) مهام قيد الإكمال / مستقبلية

- [ ] استيراد كتب تفسير إضافية حقيقية (ابن كثير، الطبري، السعدي) من مصادر مفتوحة (Shamela / King Saud University).
- [ ] تشغيل مهاجرة 0002 (FTS5) في الإنتاج لتسريع البحث على 6,236 آية + 6,333 تفسير.
- [ ] إنشاء قاعدة D1 الإنتاجية الفعلية (الحالي: ID placeholder في `wrangler.jsonc`).
- [ ] CI: تشغيل `import:quran:sample` + `import:tafsir:sample` فقط في GitHub Actions (الملفات الكاملة لا تدخل CI).
- [ ] إضافة تفسير ميسَّر باللغات الأخرى (إن توفّرت تراخيصها).
- [ ] ترقية شارة الـ UI لإظهار اسم كتاب التفسير الافتراضي عند العرض.

---

## 8) ملاحظات الأمان (مختصر — راجع `SECURITY.md` للتفاصيل)

1. **لا أسرار في Git**: جميع التوكنات (`ghp_...`, `cfut_...`) لم تُكتب في أي ملف.
2. **`.gitignore`** يحمي:
   - `.imports/` (الملفات الخام الكبيرة)
   - `*.full.json`, `*.tafsir-full.json`, `*.tafsir-real.json`
   - `dist/import/ayahs-full.sql`, `dist/import/tafsir-real.sql`
   - `.env`, `.env.production`, `.dev.vars`
   - `*.token`, `*.secret`, `cf-token.txt`, `github-token.txt`
3. **معرّفات قواعد البيانات** في `wrangler.jsonc` تُترك كـ placeholder
   `00000000-0000-0000-0000-000000000000` ويُحقن المعرّف الفعلي عبر إعدادات
   Cloudflare Pages (Environment Variables) لا في Git.
4. **هروب SQL يدوي صارم** في كل المستوردات: لا قيم `undefined`/`NaN`/`null`
   كنصوص، تكرار `'`، إزالة `\r` والأحرف غير المرئية، استخدام
   `INSERT OR REPLACE` فقط (idempotent).
5. **لا مسارات إدارية**: التطبيق قراءة فقط (`GET` فقط). أي تعديل يتم
   عبر سكربتات محلية + `wrangler d1 execute` (يتطلب CF Token محلي).
6. **CSP صارم** + COOP/CORP + HSTS + nosniff + frame-ancestors none.
7. **CORS** للقراءة فقط (`origin: '*'`, `credentials: false`).

---

## 9) المصادر والمراجع

- AlQuran Cloud API: <https://alquran.cloud/api>
- مشروع Tanzil (مصدر النص الأصلي): <https://tanzil.net/>
- مجمع الملك فهد لطباعة المصحف الشريف: <https://qurancomplex.gov.sa/>
- خطة استيراد القرآن: [`docs/quran-import-plan.md`](./quran-import-plan.md)
- خطة استيراد التفسير: [`docs/tafsir-import-plan.md`](./tafsir-import-plan.md)
- مرجع الأمان: [`SECURITY.md`](../SECURITY.md)

---

*هذا التقرير يُحدَّث مع كل عملية استيراد جديدة. آخر تحديث: 2026-05-05.*
