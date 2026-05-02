# دليل استيراد البيانات — منصة تفسير

هذا الدليل يصف كيفية استيراد بيانات تفسير القرآن الكريم إلى قاعدة بيانات D1، بما في ذلك التفاسير، والآيات، والكتب، والمؤلفين، مع التحقق العلمي والتقني الصارم.

---

## نظرة عامة

تعتمد منصة "تفسير" على بيانات نصّية متعددة المصادر، وتفرض على كل ملف استيراد:

1. التحقق من البنية (Schema validation).
2. التحقق من القيم المسموحة (Whitelists) لـ `sourceType` و `verificationStatus` و `schools`.
3. التحقق من المراجع (مثل وجود الكتاب/المؤلف).
4. عدم تجاوز حدود السور والآيات (114 سورة كحدّ أقصى، عدد آيات كل سورة معروف).
5. عدم وجود مُعرّفات (IDs) مكررة.
6. الحدّ الأدنى لطول النص (5 أحرف).

---

## المسارات والملفات

```
fixtures/import-samples/
├── valid-sample.json              ← نموذج تفاسير صحيح (قديم)
├── valid-tafseers.sample.json     ← نموذج تفاسير صحيح
├── valid-ayahs.sample.json        ← نموذج آيات صحيح
├── valid-books.sample.json        ← نموذج كتب صحيح
├── valid-authors.sample.json      ← نموذج مؤلفين صحيح
├── invalid-sample.json            ← نموذج تفاسير غير صحيح
└── invalid-tafseers.sample.json   ← نموذج تفاسير غير صحيح (موسّع)

scripts/importers/
└── validate-import.mjs            ← مدقّق الاستيراد متعدّد الأنواع
```

---

## أنواع الاستيراد المدعومة

يكتشف المدقّق نوع الملف تلقائيًا بناءً على الحقول الموجودة في أول عنصر:

| النوع       | الحقول المميّزة                                      |
|-------------|------------------------------------------------------|
| `tafseers`  | `bookId`, `surah`, `ayah`, `text`, `sourceType`      |
| `ayahs`     | `surah`, `number`, `text` (بدون `bookId`)            |
| `books`     | `id`, `title`, `authorId`, `schools`                 |
| `authors`   | `id`, `name`, `century` (بدون `bookId`)              |

يمكن إجبار النوع باستخدام `--type=<name>`.

---

## الاستخدام

### تشغيل أساسي (Dry-run افتراضي)

```bash
npm run validate:import -- fixtures/import-samples/valid-tafseers.sample.json --dry-run
```

### تشغيل العيّنات الموحّدة

```bash
npm run validate:samples
```

### تحديد نوع البيانات يدويًا

```bash
node scripts/importers/validate-import.mjs my-data.json --type=ayahs --dry-run
```

### وضع verbose للتفاصيل الكاملة

```bash
node scripts/importers/validate-import.mjs file.json --dry-run --verbose
```

---

## المخططات (Schemas)

### `tafseers`

```jsonc
{
  "id": "imp-saadi-1-1",                 // مُعرّف فريد
  "bookId": "saadi",                      // يجب أن يطابق كتابًا موجودًا
  "surah": 1,                             // 1..114
  "ayah": 1,                              // ضمن عدد آيات السورة
  "text": "نصّ التفسير...",                // ≥ 5 أحرف
  "sourceType": "summary",                // original-text|summary|sample|review-needed|curated
  "verificationStatus": "partially-verified", // verified|partially-verified|unverified|flagged
  "sourceName": "تيسير الكريم الرحمن",
  "edition": "مؤسسة الرسالة، 2002",
  "volume": 1,
  "page": 39,
  "sourceUrl": "https://shamela.ws/...",
  "reviewerNote": "بحاجة لمراجعة لغوية",
  "isOriginalText": false
}
```

### `ayahs`

```jsonc
{
  "surah": 2,
  "number": 1,
  "text": "الم",
  "juz": 1,
  "page": 2
}
```

### `books`

```jsonc
{
  "id": "tabari",
  "title": "تفسير الطبري",
  "fullTitle": "جامع البيان عن تأويل آي القرآن",
  "authorId": "tabari",
  "schools": ["بالمأثور", "موسوعي"],
  "volumes": 24,
  "popularity": 10,
  "featured": true
}
```

### `authors`

```jsonc
{
  "id": "tabari",
  "name": "الطبري",
  "fullName": "محمد بن جرير بن يزيد الطبري",
  "deathYear": 310,
  "century": 4,
  "origin": "طبرستان",
  "school": "مستقل"
}
```

---

## القيم المسموحة (Whitelists)

### `sourceType`
- `original-text` — نصّ أصلي حرفي من المصدر.
- `summary` — تلخيص بأمانة من المصدر.
- `sample` — مثال أو نموذج تجريبي.
- `review-needed` — يحتاج إلى مراجعة علمية.
- `curated` — مُختار/مُحرَّر بإشراف لجنة.

### `verificationStatus`
- `verified` — موثَّق ومُراجَع.
- `partially-verified` — مُراجَع جزئيًا.
- `unverified` — غير مُراجَع.
- `flagged` — مُعلَّم لمشكلة.

### `schools` (المدارس التفسيرية)
بالمأثور، بالرأي، فقهي، لغوي، بلاغي، معاصر، ميسر، موسوعي.

---

## معالجة الأخطاء

عند فشل التحقق، يقوم المدقّق بـ:

1. **رفض السطر** (لا يُدخل في القاعدة).
2. **إضافته إلى `rejection_log`** في جدول `import_jobs`.
3. **إيقاف الاستيراد** إذا كانت نسبة الرفض > 25% (في الوضع غير dry-run).
4. **تسجيل الإجراء** في `audit_logs` بالعامل `imported_by` والوقت.

---

## أفضل الممارسات

- ابدأ دومًا بـ **dry-run** قبل أي استيراد فعلي.
- تأكَّد من أن `sourceUrl` يشير إلى مصدر علمي معروف (شاملة، إسلام ويب، الدرر السنية، إلخ).
- عيّن `verificationStatus = unverified` للبيانات الجديدة، ولا ترفعها إلى `verified` إلا بعد المراجعة العلمية.
- فضّل `original-text` عند توفّر نسخة محقَّقة موثّقة.
- اربط كل تفسير بـ `edition` و `volume` و `page` لإمكانية التتبّع.

---

## بعد الاستيراد

1. شغِّل `npm run verify:data` للتأكُّد من سلامة المراجع المتقاطعة.
2. شغِّل `npm run build` للتأكد من عدم انكسار الأنواع TypeScript.
3. تحقَّق من واجهة `/dashboard` لرصد التغطية الجديدة.

---

## الأمان

- لا يُنفَّذ الاستيراد عبر واجهة عامة — فقط عبر CLI أو واجهة محمية بـ Cloudflare Access.
- جميع الاستيرادات تُسجَّل في `import_jobs` و `audit_logs`.
- لا تُستورد روابط أو محتوى يحتوي على JavaScript أو HTML خام (يُنظَّف تلقائيًا).
