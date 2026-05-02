# دليل الاختبار — منصّة تفسير

> آخر تحديث: 2026-05-02 (Beta متقدّمة)

هذا الملف يصف منظومة الاختبارات الحاليّة في المشروع، طريقة تشغيلها محلّيًا
وفي CI، وما الذي يُختَبر فعلًا (وما الذي لا يُختبَر بعد).

---

## 1. أنواع الفحوصات الموجودة

| الفحص | الأداة | الأمر | ماذا يضمن |
|------|------|------|---------|
| تحقّق سلامة بيانات seed | Node script | `npm run verify:data` | لا تكرارات، لا روابط مكسورة، تماسك مرجعي بين السور/الكتب/التفاسير. |
| تدقيق ملفات الاستيراد | Node script | `npm run validate:samples` | كل سجل في fixtures/import-samples يطابق المخطّط ويملك مصدرًا موثّقًا. |
| تصدير seed إلى SQL/JSON | Node script | `npm run export:seed-sql` | يولّد `dist/import/seed-data.sql` و `.json` بدون `undefined / NaN`. |
| فحص ناتج التصدير | Node script | `npm run export:seed-check` | تأكيد إحصائي على الأعداد المتوقّعة لكل جدول. |
| اختبارات الوحدات | `node --test` | `npm test` | 18 اختبارًا تغطّي helpers رئيسية. |
| البناء | Vite SSR | `npm run build` | لا أخطاء TypeScript، حجم bundle مقبول. |

---

## 2. اختبارات الوحدات (`tests/`)

تستخدم `node:test` المضمَّن (لا `vitest` لتفادي تبعيات ثقيلة). جميع الاختبارات
تشتغل على Node ≥ 20.

```
tests/
├── normalize.test.mjs      # 6 اختبارات لتطبيع العربية (همزات، تشكيل، ة/ه، ى/ي).
├── seed-export.test.mjs    # 5 اختبارات للتأكّد أنّ SQL الناتج نظيف ومتسق.
└── data-providers.test.mjs # 7 اختبارات لتماسك بيانات seed (IDs، sourceType، verificationStatus).
```

### تشغيل اختبار واحد فقط

```bash
node --test tests/normalize.test.mjs
node --test tests/seed-export.test.mjs --test-name-pattern='generates clean SQL'
```

### كتابة اختبار جديد

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeArabic } from '../src/lib/normalize.js' // أو النسخة المبنيّة

test('وصف الحالة بوضوح', () => {
  assert.equal(normalizeArabic('بسم'), 'بسم')
})
```

> ⚠️ ملاحظة: `tests/` تستورد ملفات `.mjs` من `scripts/`. لا تستورد مباشرةً
> ملفات `.ts` تحت `src/` (يحتاج compile أوّلًا) — اختبار TS-direct سيكون
> مرحلة قادمة (vitest بـ `vite-node`).

---

## 3. ما الذي يُختبَر حقًّا؟

### مغطّى ✅

- **تطبيع العربي** — كل تحويلات الهمزات والتاء المربوطة والياء المقصورة.
- **سلامة seed** — لا تفسير يشير إلى آية/سورة/كتاب غير موجود.
- **توافق sourceType مع isOriginalText** — تفسيرات `original-text` لها `isOriginalText: true` ومصدر معلَن.
- **اتّساق export** — أعداد الجداول الناتجة تطابق الأعداد المتوقّعة.
- **لا undefined/NaN في SQL** — اختبار صريح يكسر إن انفلت أيّ منهما.

### غير مغطّى بعد ⚠️

- مسارات HTTP (لا اختبارات end-to-end للـ API بعد). تُختبَر يدويًا و عبر `curl` أثناء التطوير.
- D1 provider (يتطلّب بيئة D1 محلّية مع miniflare).
- صفحات JSX (لا snapshot tests). تُتحقَّق عبر فحص يدوي + Playwright عند النشر.
- محرك البحث الكامل (يُختبَر يدويًا في `/search`).

هذه الفجوات موثّقة في [`docs/roadmap.md`](roadmap.md).

---

## 4. التشغيل في CI

`.github/workflows/ci.yml` يشغّل في كل push/PR على `main`:

```yaml
1. npm ci
2. npm run verify:data          # يفشل إن وُجد عيب في seed
3. npm run validate:samples     # يفشل إن رُفض أيّ ملف عيّنة
4. npm run export:seed-sql      # يولّد dist/import/*
5. تأكّد: dist/import/seed-data.sql لا يحتوي 'undefined'
6. npm test                     # 18 اختبارًا
7. npm run build                # SSR build
8. تأكّد: dist/_worker.js و dist/import/*.{sql,json} موجودة
```

أيّ خطوة تفشل ⇒ يُمنع merge.

---

## 5. الفحص اليدوي قبل النشر

قبل أيّ deploy إلى Cloudflare Pages، يجب فتح هذه المسارات في المتصفّح
والتأكّد من أنّ:
- لا أخطاء `console`
- لا انتهاكات CSP
- المحتوى يظهر بالعربيّة الصحيحة

| المسار | يجب أن يظهر |
|-------|------|
| `/` | الصفحة الرئيسية مع شريط البحث وروابط الأقسام. |
| `/search?q=الله` | نتائج بحث + فلاتر. |
| `/search?q=الله&sourceTypes=summary` | نتائج فقط من `summary`. |
| `/ayah/1/1` | الفاتحة آية 1، عدّة تفاسير، أزرار «نسخ كل التفاسير» و«الموثّقة فقط». |
| `/ayah/999/999` | صفحة 404 ودودة. |
| `/read/1` | عرض السورة كاملةً (بقدر ما هو متاح). |
| `/surahs` و `/surahs/1` | قائمة السور وصفحة سورة. |
| `/books`, `/authors`, `/categories` | فهارس كاملة. |
| `/compare` | مقارنة بين كتابين على آية واحدة. |
| `/dashboard` | إحصائيّات + شارة «وضع Seed/D1». |
| `/methodology` | منهجيّة التوثيق. |
| `/bookmarks`, `/history` | يعرضان «لا توجد بيانات» إن لم يُضف شيء. |
| `/api/stats` | JSON يحتوي `mode: "seed"` أو `"d1"`. |
| `/api/stats/detailed` | JSON تفصيلي. |
| `/api/ayah/1/1` | كائن بـ `surah`, `ayah`, `tafseers[]`, `coverage`. |
| `/api/ayah/999/999` | `{ ok: false, error: 'not_found' }` بـ HTTP 404. |
| `/api/search?q=الله&sourceTypes=summary` | `{ ok: true, data: { results, totals } }`. |
| `/sitemap.xml` | XML صالح. |
| `/robots.txt` | يسمح بالـ crawl ويُشير إلى sitemap. |
| `/manifest.json` | JSON صالح. |

---

## 6. التحقّق من ترويسات الأمان

```bash
curl -sI http://localhost:3000 | grep -iE 'content-security-policy|strict-transport|permissions-policy|x-frame|referrer'
```

يجب أن تحتوي على:
- `Content-Security-Policy: ... script-src 'self' 'sha256-XDgF...';` (بلا `'unsafe-inline'` على scripts)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Permissions-Policy: camera=(), microphone=(), ...`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 7. خطّة التطوير القادمة للاختبارات

- [ ] إضافة `vitest` + `vite-node` لاختبار ملفات TS مباشرةً (D1Provider، search.ts).
- [ ] اختبارات HTTP عبر `app.fetch()` لـ Hono (لا حاجة لخادم حقيقي).
- [ ] اختبار D1 provider مع `miniflare` في وضع memory.
- [ ] snapshot tests لصفحات JSX المهمة (home, search, ayah).
- [ ] دمج Playwright في CI لاختبار smoke على المسارات الـ 20+ أعلاه.
- [ ] قياس تغطية (coverage) ≥ 70% على helpers.
