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

## ملاحظات أمان

- لا تضع `database_id` حقيقي في commit إذا كان مشروعك حساسًا.
- لا تضف admin routes تكتب على D1 من الإنترنت.
- استعمل `prepared statements` (`.bind()`) دائمًا — راجع `src/lib/data/d1-provider.ts`.
- لا تستعمل string interpolation للمدخلات — مسموح فقط لأسماء أعمدة
  ثابتة من قائمة بيضاء.
- لا تدخل بيانات قرآن أو تفسير من مصادر غير موثوقة. راجع
  `docs/scientific-verification.md` و `docs/importing-data.md`.
