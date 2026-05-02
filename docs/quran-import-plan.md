# خطة استيراد القرآن الكامل (Full Quran Import Plan)

> آخر تحديث: 2026-05-02
>
> هذه الوثيقة تصف الخطوات اللازمة لاستيراد المصحف الكامل (6236 آية، 114 سورة)
> من مصدر موثوق إلى قاعدة بيانات Cloudflare D1 الإنتاجيّة لمشروع `tafseer`،
> مع ضمان دقّة النص، الاتّساق العلمي، وعدم الإضرار بالبيانات الحالية.

---

## 1) الحالة الحالية

| الجانب | الحالة |
|---|---|
| عدد الآيات في seed | 295 آية (عيّنة لأغراض التطوير) |
| عدد السور في seed | 114 (الأسماء كاملة بدون نصوص) |
| المُدقِّق (validator) | `scripts/importers/validate-quran-json.mjs` (يدعم `--full`, `--strict`, `--json`) |
| العيّنات في `fixtures/` | `quran-valid-sample.json` (5 آيات صالحة) و `quran-invalid-sample.json` (9 أخطاء متعمَّدة) |
| CI | يفحص العيّنات في كلّ push (الصالحة يجب أن تنجح، الفاسدة يجب أن تفشل) |
| D1 binding | معطّل افتراضيًا (`REPLACE_WITH_REAL_D1_ID`) — يُفعَّل بعد إنشاء قاعدة الإنتاج |

---

## 2) صيغة الملف المعتمدة (`Quran JSON`)

```jsonc
{
  "source":      "مصحف المدينة - مجمع الملك فهد لطباعة المصحف الشريف",
  "sourceUrl":   "https://qurancomplex.gov.sa/",       // HTTPS إلزامي في strict mode
  "license":     "Public Domain / Royal decree",         // اختياري
  "edition":     "رواية حفص عن عاصم",                  // اختياري
  "ayahs": [
    {
      "surah": 1,                                        // 1..114 (integer صارم)
      "ayah":  1,                                        // 1..ayahCount[surah-1]
      "text":  "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      "juz":   1,                                        // 1..30 (اختياري)
      "page":  1,                                        // 1..604 (اختياري — مصحف المدينة 604ص)
      "source":    "...",                                // اختياري إن كان عاما على المستوى الأعلى
      "sourceUrl": "https://..."                          // اختياري — HTTPS فقط
    }
  ]
}
```

**ملاحظات صارمة:**
- لا تكرار للزوج `(surah, ayah)`.
- لا أرقام عشريّة، لا `NaN`/`undefined`/`null` في الحقول الرقميّة أو النصيّة.
- النص **يجب** أن يكون مهيَّأً للبحث: مع التشكيل الكامل ولكن بلا أحرف خفيّة (zero-width).
- البسملة في أوّل كل سورة (ما عدا التوبة) تأتي كآية مستقلّة في رواية حفص للسورة الفاتحة فقط — غيرها تكون قبل الآية 1 ولا تُحسب آية. **القرار:** نتبع ترقيم مصحف المدينة الرسمي.

---

## 3) معايير اختيار المصدر

| المعيار | الوصف |
|---|---|
| الموثوقيّة | جهة دينيّة/علميّة معروفة (مجمع الملك فهد، Tanzil.net، Quran.com). |
| الترخيص | مجاني للاستعمال غير التجاري (Public Domain / CC) أو إذن صريح. |
| الترقيم | يطابق ترقيم مصحف المدينة (ترقيم رواية حفص). |
| التشكيل | كامل (Tashkeel) لضمان دقّة العرض والقراءة. |
| التحقّق | يمكن مطابقة التجزئة (juz) والصفحة (page) من المصحف الورقي. |
| الاتّساق | عدد الآيات لكل سورة يطابق `SURAH_AYAH_COUNTS` في المُدقِّق. |
| HTTPS | الرابط الأصلي للمصدر يجب أن يكون `https://` (يُرفض `http://` في strict). |

**مصادر مرشَّحة (مرتَّبة):**
1. **مجمع الملك فهد** — `https://qurancomplex.gov.sa/` (الأكثر موثوقية رسميًا).
2. **Tanzil.net** — `https://tanzil.net/download/` (متوفر بصيغة JSON/XML/Plain).
3. **Quran.com API** — `https://api.quran.com/api/v4/quran/verses/uthmani` (حيّ، JSON).
4. **مكتبة QuranicCorpus** — للمراجعة التقابليّة فقط.

> **ملاحظة:** يُفضَّل الجمع بين مصدرين (مثلاً Tanzil + Quran.com) ومقارنة الـ
> `SHA-256` لكل آية قبل الاعتماد، لرصد أي اختلافات في التشكيل.

---

## 4) خطوات الاستيراد (Step-by-step)

```bash
# 0) تأكَّد من البيئة جاهزة
npm ci
npm run verify:data
npm test

# 1) نزِّل ملف JSON من المصدر إلى مسار خارج المستودع (لا نلتزم به في git)
mkdir -p .imports
curl -fL https://example-trusted-source/quran.json -o .imports/quran-full.json
sha256sum .imports/quran-full.json   # احتفظ بالـ hash للسجلّ

# 2) دقِّق الملف بنيويًا (partial mode أولاً)
node scripts/importers/validate-quran-json.mjs .imports/quran-full.json

# 3) دقِّق في full mode (يجب أن يحوي 6236 آية بالضبط)
node scripts/importers/validate-quran-json.mjs .imports/quran-full.json --full

# 4) دقِّق في strict mode (sourceUrl إلزامي + HTTPS)
node scripts/importers/validate-quran-json.mjs .imports/quran-full.json --full --strict

# 5) أنشئ تقرير JSON لتغطية كل سورة
node scripts/importers/validate-quran-json.mjs .imports/quran-full.json --full --json \
  > .imports/quran-validation-report.json

# 6) أنشئ ملف SQL آمنًا (INSERT OR REPLACE) من JSON المُدقَّق
#    المستورد يُطبّق نفس قواعد التحقّق + يحفظ source_name/source_url/imported_from
#    على كل آية، ويُولّد تقريرًا JSON يحوي SHA-256 للمدخل.
node scripts/importers/import-quran.mjs .imports/quran-full.json --full --strict \
  --filename=ayahs-full.sql
# سيُكتب: dist/import/ayahs-full.sql + dist/import/quran-import-report.json

# 7) طبِّق migrations على D1 الإنتاج (تشمل 0003_ayah_sources.sql)
npm run db:migrate:prod

# 8) نفِّذ ملف SQL الناتج على D1 الإنتاج
npx wrangler d1 execute tafseer-production --file=dist/import/ayahs-full.sql

# 9) تحقّق من العدد الإجمالي بعد الاستيراد
npx wrangler d1 execute tafseer-production --command="SELECT COUNT(*) FROM ayahs"
# المتوقَّع: 6236

# 10) شغِّل التطبيق وتحقّق:
curl https://tafseer.pages.dev/api/ayah/2/255   # آية الكرسي
curl https://tafseer.pages.dev/api/stats        # ayahsCount: 6236
```

---

## 5) السكربت `scripts/importers/import-quran.mjs` (مُنفَّذ ✅)

`scripts/importers/import-quran.mjs` — يحوّل ملف JSON المُدقَّق إلى `INSERT OR REPLACE` آمن
ويُخرج تقرير JSON يصف العمليّة:

```bash
# الاستخدام الأساسي (مع تحقّق صارم):
node scripts/importers/import-quran.mjs <input.json> [flags]

# الأعلام المتوفّرة:
#   --full           يُلزم وجود 6236 آية بالضبط (للقرآن كاملاً)
#   --strict         يُلزم وجود source + sourceUrl (HTTPS)
#   --allow-partial  يسمح باستيراد عيّنة جزئية (للتطوير فقط)
#   --json           إخراج تقرير JSON على stdout (للCI)
#   --filename=NAME  اسم ملف SQL الناتج (افتراضي: ayahs-full.sql)

# أمثلة:
node scripts/importers/import-quran.mjs .imports/quran-full.json --full --strict
node scripts/importers/import-quran.mjs fixtures/import-samples/quran-valid-sample.json \
  --allow-partial --strict --filename=ayahs-sample.sql

# عبر npm:
npm run import:quran -- <input.json> [flags]
npm run import:quran:sample      # = ينفّذ على العيّنة مع --allow-partial
```

**المخرجات:**
- `dist/import/ayahs-full.sql` (أو ما يحدّده `--filename`): ملف SQL يحوي
  `PRAGMA foreign_keys = ON; BEGIN; INSERT OR REPLACE INTO ayahs (...); COMMIT;`
  مع هروب الاقتباسات بصيغة SQLite (`''`) ولا يحوي `undefined`/`NaN`.
- `dist/import/quran-import-report.json`: تقرير يحوي
  `{ ok, sha256, counts, options, surahCoverage[], generatedAt }` للسجلّ والتدقيق.

**الضمانات الأمنيّة:**
- التحقّق نفسه المُستخدَم في `validate-quran-json.mjs` (لا تكرار، لا نطاقات خاطئة، لا
  نصوص فارغة، لا `undefined`/`NaN`، `sourceUrl` HTTPS فقط في `--strict`).
- `INSERT OR REPLACE` آمن عند إعادة التشغيل (idempotent).
- الحقول الجديدة (`source_name`, `source_url`, `imported_from`) من migration `0003`.
- لا اتّصال بشبكة، لا تنفيذ على D1 — يولِّد ملف SQL فقط لينفِّذه `wrangler d1 execute`.

---

## 6) قائمة التحقّق النهائيّة (Pre-flight Checklist)

- [ ] المصدر موثوق (مجمع الملك فهد / Tanzil / Quran.com).
- [ ] الترخيص يسمح بالاستعمال (Public Domain / إذن صريح).
- [ ] الملف يُجتاز validator في `--full --strict --json` بدون أخطاء.
- [ ] عدد الآيات الكلّي = 6236 بالضبط.
- [ ] لا تكرار للزوج `(surah, ayah)`.
- [ ] كل سورة عدد آياتها يطابق `SURAH_AYAH_COUNTS`.
- [ ] لا `undefined` / `NaN` / `null` حرفي في النصوص.
- [ ] كل النصوص بترميز UTF-8 صحيح.
- [ ] `sourceUrl` يبدأ بـ `https://` (top-level + per-ayah إن وُجد).
- [ ] `juz` (إن وُجد) في النطاق `1..30` و `page` في `1..700`.
- [ ] التشكيل (Tashkeel) كامل بدون أحرف ZWJ/ZWNJ غير ضروريّة.
- [ ] مقارنة عيّنة (10 آيات عشوائيّة) مع المصحف الورقي يدويًا.
- [ ] حفظ `sha256sum` الملف الأصلي للسجلّ.
- [ ] تطبيق migrations على D1 قبل تنفيذ الاستيراد.
- [ ] تشغيل smoke test بعد الاستيراد (`SELECT COUNT(*) FROM ayahs == 6236`).
- [ ] فحص `/api/stats` يُعيد `ayahsCount: 6236` و `mode: "d1"`.
- [ ] فحص يدوي لـ `/api/ayah/2/255` (آية الكرسي) و `/api/ayah/114/6` (آخر آية في القرآن).
- [ ] backup للـ D1 (export) قبل الاستيراد.

---

## 7) خطّة التراجع (Rollback)

في حال اكتشاف خلل بعد الاستيراد:

```bash
# 1) حافظ على نسخة احتياطيّة قبل الاستيراد
npx wrangler d1 export tafseer-production --output=.imports/backup-before-import.sql

# 2) إن حصل خلل: استرجع من النسخة الاحتياطيّة
DROP TABLE ayahs;
npx wrangler d1 execute tafseer-production --file=.imports/backup-before-import.sql
```

---

## 8) الأعمال المتبقّية (Next steps)

- [x] كتابة `scripts/importers/import-quran.mjs` (المُولِّد SQL). ✅ منجَز
- [x] إضافة `npm run import:quran` للتنفيذ النهائي. ✅ منجَز
- [x] إضافة `npm run import:quran:sample` لتشغيل العيّنة. ✅ منجَز
- [x] migration `0003_ayah_sources.sql` لإضافة `source_name`, `source_url`, `imported_from`. ✅ منجَز
- [x] tests/quran-importer.test.mjs (12 subtests). ✅ منجَز
- [x] CI step يشغّل الاستيراد على العيّنة ويرفض الفاسدة. ✅ منجَز
- [ ] إضافة `npm run validate:quran-full` (يستلزم ملفًا كاملاً 6236 خارج المستودع).
- [ ] استيراد الفعلي على D1 staging (يتطلّب ملف JSON كامل + أسرار Cloudflare).
- [ ] توثيق نتائج الاستيراد في `docs/final-report.md` بعد التنفيذ.

---

## 9) المصادر

- [مصحف المدينة الرقمي](https://qurancomplex.gov.sa/)
- [Tanzil.net Quran Text Downloads](https://tanzil.net/download/)
- [Quran.com API v4](https://api-docs.quran.com/)
- [QuranicCorpus.com](https://corpus.quran.com/)
- ملف validator: [`scripts/importers/validate-quran-json.mjs`](../scripts/importers/validate-quran-json.mjs)
- العيّنات: [`fixtures/import-samples/quran-*.json`](../fixtures/import-samples/)

---

> **تحذير:** لا تلتزم ملف القرآن الكامل في git المستودع — حجمه قد يصل لـ 4–8 MB
> ويجب أن يبقى في `.imports/` (مضافة إلى `.gitignore`). فقط ملف `seed-data.sql`
> النهائيّ يُلتزم في `dist/import/` بعد البناء.
 Quran Text Downloads](https://tanzil.net/download/)
- [Quran.com API v4](https://api-docs.quran.com/)
- [QuranicCorpus.com](https://corpus.quran.com/)
- ملف validator: [`scripts/importers/validate-quran-json.mjs`](../scripts/importers/validate-quran-json.mjs)
- العيّنات: [`fixtures/import-samples/quran-*.json`](../fixtures/import-samples/)

---

> **تحذير:** لا تلتزم ملف القرآن الكامل في git المستودع — حجمه قد يصل لـ 4–8 MB
> ويجب أن يبقى في `.imports/` (مضافة إلى `.gitignore`). فقط ملف `seed-data.sql`
> النهائيّ يُلتزم في `dist/import/` بعد البناء.
