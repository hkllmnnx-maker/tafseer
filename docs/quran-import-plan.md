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

# 6) ادمج النصوص في seed-data.sql (سيتطلّب سكربت import-quran.mjs مستقبلًا)
#    الفكرة: تحويل ayahs[] إلى INSERT OR REPLACE INTO ayahs (...)
#    حاليًا: يدويًا أو عبر سكربت يُكتب لاحقًا.

# 7) طبِّق migrations على D1 الإنتاج
npm run db:migrate:prod

# 8) نفِّذ ملف SQL الناتج على D1 الإنتاج
npx wrangler d1 execute tafseer-production --file=.imports/ayahs-only.sql

# 9) تحقّق من العدد الإجمالي بعد الاستيراد
npx wrangler d1 execute tafseer-production --command="SELECT COUNT(*) FROM ayahs"
# المتوقَّع: 6236

# 10) شغِّل التطبيق وتحقّق:
curl https://tafseer.pages.dev/api/ayah/2/255   # آية الكرسي
curl https://tafseer.pages.dev/api/stats        # ayahsCount: 6236
```

---

## 5) السكربت المُقترَح (لم يُكتب بعد)

`scripts/importers/import-quran.mjs` — يحوّل ملف JSON المُدقَّق إلى `INSERT OR REPLACE` آمن:

```js
// pseudo-code
const valid = await validate(jsonFile, { full: true, strict: true })
if (!valid.ok) process.exit(1)

const sql = []
sql.push('PRAGMA foreign_keys = ON;')
sql.push('BEGIN;')
for (const a of valid.ayahs) {
  // .bind() غير متاح هنا (نحن نُولّد SQL ملف) — لذا هربنا النص يدويًا
  const text = a.text.replace(/'/g, "''")     // SQLite single-quote escape
  const src  = (a.source || valid.topSource || '').replace(/'/g, "''")
  const url  = (a.sourceUrl || valid.topSourceUrl || '').replace(/'/g, "''")
  sql.push(`INSERT OR REPLACE INTO ayahs (surah_number, ayah_number, text, juz, page, source_name, source_url) VALUES (${a.surah}, ${a.ayah}, '${text}', ${a.juz ?? 'NULL'}, ${a.page ?? 'NULL'}, '${src}', '${url}');`)
}
sql.push('COMMIT;')
fs.writeFileSync('dist/import/ayahs-only.sql', sql.join('\n'))
```

**لاحظ:** هذا السكربت يولِّد ملف SQL فقط (لا يتّصل بـ D1). المسؤول عن التنفيذ هو `wrangler d1 execute --file=...`.

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

- [ ] كتابة `scripts/importers/import-quran.mjs` (المُولِّد SQL).
- [ ] إضافة `npm run validate:quran-full` للسكربت.
- [ ] إضافة `npm run import:quran` للتنفيذ النهائي.
- [ ] إضافة test يُولّد ملف JSON كامل وهميّ ويُختبر validator في `--full`.
- [ ] إضافة CI step اختياري للاستيراد إلى D1 staging (يتطلّب أسرارًا).
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
