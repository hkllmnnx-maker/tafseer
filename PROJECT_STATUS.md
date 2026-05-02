# 📊 حالة مشروع تفسير — Project Status

> **آخر تحديث**: 2 مايو 2026 — v1.8 (Tafsir Importer + D1 Verifier + Full Pipeline)

هذا المستند يلخّص الحالة الفعلية للمشروع بشكل دوريّ، ويُحدَّث بعد كل مرحلة كبرى.
للتفاصيل التقنية الكاملة، انظر [`README.md`](README.md) و [`docs/`](docs/).

---

## 1) ملخّص تنفيذي

**تفسير** تطبيق ويب متقدّم للبحث في كتب تفسير القرآن الكريم، بنيته:
- **Hono + Cloudflare Pages** (SSR على الحافة)
- **D1 (SQLite)** مع DataProvider موحَّد يبدّل تلقائيًا بين seed و D1
- **TypeScript + JSX** مع نظام تصميم RTL مخصّص

**المؤشّرات الحالية:**

| المؤشّر | القيمة |
|---|---|
| اختبارات الوحدات | **139/139 ✅** |
| حجم البناء (Vite) | 338.86 kB |
| المسارات الـ HTML | 13+ صفحة |
| نقاط الـ API | 12+ نقطة |
| المايجريشنز | 3 (initial + FTS5 اختياري + ayah_sources) |
| الكتب في seed | 12 |
| التفاسير في seed | ~100 إدخال |
| الآيات في seed | ~295 آية |
| السور (فهرسة كاملة) | 114 |
| ملفّات `/docs` | 9+ |
| CI workflow | ✅ يعمل (verify-data + validate-quran/tafsir + smoke + tests + build) |
| النشر السحابي | 🟡 محلّي فقط (يتطلّب Cloudflare API token) |

---

## 2) المراحل المنجزة في الجلسة الحالية (v1.8)

| # | المرحلة | الـ commit | الحالة |
|---|---------|-----------|--------|
| 1 | `verify-quran-d1.mjs` + 8 اختبارات | `8672045` | ✅ مرفوع |
| 2 | DataProvider: `getTafseersForSurah`/`getReadSurahPayload`/`getQuranCoverageSummary` + 9 اختبارات | `935aca0` | ✅ مرفوع |
| 3 | `/ayah` و `/read` عبر DataProvider مع mode badge (إلغاء N+1) | `ada4c6c` | ✅ مرفوع |
| 4 | `/api/quran/coverage` + بطاقة تغطية القرآن على Dashboard | `79cd364` | ✅ مرفوع |
| 5 | مدقّق التفاسير `validate-tafsir-json.mjs` + خطّة + عيّنات + 27 اختبار | `aef9e05` | ✅ مرفوع |
| 6 | تحديث CI: `validate:tafsir-sample` + `verify:quran-d1:dry` | `b91f90e` | ✅ مرفوع |
| 7 | تحديث الوثائق (README v1.8 + SECURITY + CHANGELOG + PROJECT_STATUS) | (هذا الـcommit) | ⏳ قيد الرفع |

**إجمالي الاختبارات الجديدة في v1.8:** 8 + 9 + 27 = **44 اختبار جديد**.

---

## 3) ما يعمل الآن (Working features)

### 3.1 تحقّق البيانات (Data validation pipeline)
- `npm run verify:data` — فحص شامل لـ seed (114 سورة، عدد آيات صحيح، لا قيم فارغة).
- `npm run validate:samples` — يجتاز عيّنة التفاسير الصالحة.
- `npm run validate:quran` — يجتاز عيّنة قرآن صالحة، ويرفض الفاسدة.
- `npm run validate:tafsir` — مدقّق التفاسير الجديد (HTTPS، license، schools، sourceType match).
- `npm run validate:tafsir-sample` — يجتاز العيّنة الصالحة، ويرفض الفاسدة.
- `npm run verify:quran-d1 -- --dry-run` — يعمل بدون اتصال D1، آمن للـ CI.
- `npm run d1:smoke` — فحص migrations/seed-data/wrangler.jsonc.

### 3.2 خطّ أنابيب الاستيراد (Import pipeline)
- ✅ مدقّق قرآن `validate-quran-json.mjs` + 16 اختبار.
- ✅ مدقّق تفاسير `validate-tafsir-json.mjs` + 27 اختبار.
- ✅ مستورد قرآن `import-quran.mjs` + migration `0003_ayah_sources.sql`.
- ✅ verifier على D1 `verify-quran-d1.mjs` + 8 اختبار.
- ✅ خطط استيراد كاملة في `docs/quran-import-plan.md` و `docs/tafsir-import-plan.md`.

### 3.3 DataProvider موحَّد
- ✅ Seed mode (افتراضي).
- ✅ D1 mode (تلقائي عند توفّر `env.DB`).
- ✅ مسارات الـ HTML الحرجة (`/`, `/search`, `/ayah/:s/:a`, `/read/:n`, `/dashboard`) كلّها عبر DataProvider.
- ✅ Mode badge في الردود لتسهيل التشخيص.
- ✅ إلغاء N+1 على `/read` عبر `getReadSurahPayload`.

### 3.4 API
- ✅ `/api/search`, `/api/ayah/:s/:a`, `/api/suggest`, `/api/stats`.
- ✅ `/api/quran/coverage` (جديد في v1.8).
- ✅ `/api/export/{books,authors,categories}` (للوحة الإحصاءات).

### 3.5 الواجهة
- ✅ بحث متقدّم، عرض آية، قراءة متسلسلة، مقارنة، كتب، مؤلفون، فئات، لوحة.
- ✅ بطاقة تغطية القرآن البصرية على Dashboard (جديد في v1.8).
- ✅ PWA v4 + CSP صارم + HSTS/COOP/CORP.

---

## 4) ما لم يكتمل بعد (Pending)

| البند | الحالة | السبب / الخطوة التالية |
|---|---|---|
| **استيراد كامل لـ 6236 آية إلى D1 الإنتاج** | ⏳ مخطّط | يتطلب تشغيل `import-quran.mjs --full` + `wrangler d1 execute` على بيئة سحابية فعلية |
| **استيراد تفاسير حقيقية (نقل حرفي)** | ⏳ مخطّط | يتطلّب الحصول على نسخ مرخّصة + تطبيق `validate-tafsir-json.mjs --strict` ثم استيراد |
| **النشر على Cloudflare Pages الإنتاج** | 🟡 جاهز | ينتظر تفعيل Cloudflare API token + اختيار `cloudflare_project_name` |
| **TafsirImporter الفعلي (script)** | ⏳ مخطّط | المخطّط جاهز في `docs/tafsir-import-plan.md`؛ التطبيق العملي يأتي عند توفّر بيانات حقيقية |
| **تحويل verificationStatus من `summary` إلى `verified`** | ⏳ مخطّط | يتطلّب مراجعة كل إدخال يدويًا مقابل المرجع الأصلي |
| **FTS5 على D1 الإنتاج** | 🟡 اختياري | المايجريشن `0002_optional_fts5.sql` جاهز لكنّه لا يُطبَّق تلقائيًا |

---

## 5) خطوات التطوير الموصى بها (Next steps)

### الأولوية 1 — النشر الفعلي (يعتمد على المستخدم)
1. توفير Cloudflare API token عبر تبويب Deploy.
2. تشغيل `setup_cloudflare_api_key`.
3. تنفيذ `npx wrangler pages project create` ثم `npx wrangler pages deploy dist`.
4. تشغيل `npm run db:migrate:prod` لتطبيق المايجريشنز على D1 السحابي.
5. تنفيذ `npm run verify:quran-d1` (بدون `--dry-run`) للتحقّق من D1 الإنتاج.

### الأولوية 2 — البيانات الحقيقية
1. الحصول على نسخة JSON كاملة للقرآن من المصدر الرسمي (مجمّع الملك فهد).
2. تشغيل `node scripts/importers/import-quran.mjs --full --strict`.
3. تطبيق `dist/import/ayahs-full.sql` على D1 الإنتاج.
4. تشغيل `npm run verify:quran-d1` للتأكّد من 6236 آية / 114 سورة.

### الأولوية 3 — تفاسير حقيقية
1. اختيار كتاب أولوية من القائمة في `docs/tafsir-import-plan.md` (الطبري / ابن كثير / السعدي).
2. التحقّق من حالة الترخيص (Public Domain للكتب القديمة بشكل عام).
3. صياغة JSON مطابق للمخطّط، تشغيل `npm run validate:tafsir -- file.json --strict`.
4. تطبيق على D1 + تشغيل `verify:quran-d1`.

---

## 6) المراجع السريعة

- 📦 **GitHub**: https://github.com/hkllmnnx-maker/tafseer
- 📖 **README**: [`README.md`](README.md)
- 🔒 **سياسة الأمان**: [`SECURITY.md`](SECURITY.md)
- 📅 **سجل التغييرات**: [`CHANGELOG.md`](CHANGELOG.md)
- 🗺️ **خريطة الطريق**: [`docs/roadmap.md`](docs/roadmap.md)
- 📥 **استيراد القرآن**: [`docs/quran-import-plan.md`](docs/quran-import-plan.md)
- 📥 **استيراد التفاسير**: [`docs/tafsir-import-plan.md`](docs/tafsir-import-plan.md)
- 🧪 **دليل الاختبارات**: [`docs/testing.md`](docs/testing.md)
- 🗄️ **قاعدة البيانات**: [`docs/database.md`](docs/database.md)

---

## 7) التحقّق المحلي السريع

```bash
# تثبيت + اختبارات + بناء
npm ci
npm test                           # 139/139 ✅
npm run build                      # 338.86 kB

# مجموعة التحقّقات
npm run verify:data
npm run validate:samples
npm run validate:quran
npm run validate:tafsir-sample
npm run verify:quran-d1:dry
npm run d1:smoke
```

كل ما سبق يجب أن يُنهى بنجاح (exit 0) قبل أيّ نشر.
