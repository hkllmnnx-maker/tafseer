# سجل التغييرات — Changelog

جميع التغييرات الملحوظة في هذا المشروع موثّقة هنا.
الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/ar/1.1.0/)
ويلتزم المشروع بـ [Semantic Versioning](https://semver.org/lang/ar/).

---

## [Unreleased]

### Added
- لا شيء بعد.

---

## [0.16.0] — 2026-05-05 (v1.10 — Production Deployment Toolkit)

### Added
- **`scripts/deploy/setup-production.sh`** (~12 KB): سكريبت نشر تلقائي شامل من 10 خطوات:
  1. التحقق من توكن Cloudflare وصلاحياته (Pages, D1, Account access).
  2. إنشاء قاعدة D1 الإنتاجية (`tafseer-production`) إن لم تكن موجودة، مع تحديث `wrangler.jsonc` تلقائياً بـ `database_id`.
  3. تطبيق ترحيلات `db/migrations/` على الإنتاج.
  4. رفع `seed-data.sql` (الكتب/المؤلفون/العيّنات الكلاسيكية).
  5. رفع `ayahs-full.sql` (القرآن الكامل — 6,236 آية).
  6. رفع `tafsir-real.sql` (التفسير الميسر — 6,236 إدخال).
  7. التحقق من سلامة البيانات في الإنتاج (`verify-quran-d1` + `verify-tafsir-d1`).
  8. بناء المشروع (`npm run build`).
  9. إنشاء مشروع Cloudflare Pages إن لم يكن موجوداً.
  10. النشر النهائي (`wrangler pages deploy`).
- **`scripts/deploy/fetch-quran.sh`**: تنزيل القرآن من AlQuran Cloud وتحويله للصيغة الموحَّدة بأمر واحد.
- **`scripts/deploy/fetch-tafsir.sh`**: تنزيل التفسير الميسر من AlQuran Cloud وتحويله للصيغة الموحَّدة بأمر واحد.
- **`DEPLOYMENT.md`** (~6.5 KB): دليل نشر مفصَّل يشمل:
  - ملخّص حالة النشر الحالية (محلي 100% جاهز / إنتاج معلَّق على التوكن).
  - التحقق التفصيلي من سبب فشل التوكن الحالي (`9109 Unauthorized` / `10000 Authentication error`).
  - قائمة الصلاحيات المطلوبة لإنشاء توكن صالح (Pages:Edit, D1:Edit, Workers Scripts:Edit, ...).
  - النشر اليدوي خطوة بخطوة (6 مراحل) كبديل للسكريبت.
  - أوامر اختبار ما بعد النشر.

### Changed
- `docs/data-status-report.md`: ترقية إلى v1.10 + إضافة §7.1 (المهام المنجزة) + §7.2 (المهمة المعلَّقة على المستخدم) + §10 (سجلّ تحقق عملي كامل من 14 خطوة).

### Verified
- **162/162 اختبار وحدة ناجح** (لا تراجع).
- البيانات المحلية في D1 سليمة 100%: `verify-quran-d1 → complete` و `verify-tafsir-d1 → 6236/6236 verified`.
- كل مسارات التطبيق ترجع HTTP 200: `/`, `/read/:n`, `/dashboard`, `/api/stats`, `/api/quran/coverage`, `/api/ayah/:s/:a`, `/api/search`, `/robots.txt`, `/sitemap.xml`.
- المعاينة العامة في Sandbox تعمل وترجع `mode:d1, ayahsCount:6236, tafseersCount:6333`.

### Blocked (External Action Required)
- **النشر الإنتاجي على Cloudflare Pages** معلَّق لأن التوكن المُعطى صالح كـ User API Token
  لكنه لا يملك صلاحيات Account-level على الحساب `7ed903da...`. الإصلاح يتطلب
  إنشاء توكن جديد بالصلاحيات المُوضَّحة في `DEPLOYMENT.md §3` ثم تشغيل
  `bash scripts/deploy/setup-production.sh` (تشغيل واحد يكتمل النشر تلقائيًا).

---

## [0.15.0] — 2026-05-05 (v1.9 — Production-Ready Data Platform)

### Added
- استيراد القرآن الكامل (6,236 آية / 114 سورة) إلى D1 من Quran Uthmani / Tanzil عبر AlQuran Cloud.
- استيراد تفسير الميسر الكامل (6,236 إدخال موثَّق) من مجمع الملك فهد لطباعة المصحف.
- `scripts/importers/verify-tafsir-d1.mjs`: مدقّق سلامة بيانات التفسير في D1.
- دعم المؤلِّفين المؤسسيين (`isInstitution: true`) في `import-tafsir.mjs` (لاستيعاب ناشرين كمجمع الملك فهد بدلاً من أشخاص لهم سنة وفاة).

### Changed
- `docs/data-status-report.md`: تقرير حالة البيانات الكامل (~7.5 KB).

---

## [0.14.0] — 2026-05-02 (v1.8 — Tafsir Importer + D1 Verifier)

### Added
- **مدقّق التفاسير الجديد** `scripts/importers/validate-tafsir-json.mjs` (~480 سطر) مع أعلام `--strict`/`--full`/`--json`/`--dry-run`.
- **27 اختبار وحدة** جديد في `tests/tafsir-validator.test.mjs` تغطّي كل قاعدة (HTTPS sourceUrl، license مطلوب، مدارس معتمدة، تطابق sourceType/isOriginalText، نطاق سور/آيات، رفض NaN/undefined/null/فارغ، اكتشاف التكرار، JSON mode، ملفات مفقودة/JSON غير صالح).
- **عيّنات تفسير**: `fixtures/import-samples/tafsir-valid-sample.json` (يجتاز `--strict`) و `tafsir-invalid-sample.json` (13 خطأ متوقَّع).
- **خطّة استيراد التفاسير**: `docs/tafsir-import-plan.md` تشمل المخطّط، الإجراء، الكتب الأولوية، خطّة المراجعة، حالات الاختبار، الاعتبارات الأمنية (~13.9 KB).
- **سكربت `scripts/importers/verify-quran-d1.mjs`**: يفحص D1 بعد الاستيراد (counts/checksums/duplicates) + 8 اختبارات وحدة.
- **DataProvider methods**: `getTafseersForSurah`، `getReadSurahPayload`، `getQuranCoverageSummary` (تُلغي N+1 على `/read`) + 9 اختبارات.
- **API**: `/api/quran/coverage` (إحصاءات تغطية القرآن في seed/D1).
- **UI**: بطاقة تغطية القرآن البصرية على Dashboard.
- **CI**: خطوتان `validate:tafsir-sample` و `verify:quran-d1:dry`.
- **npm scripts**: `validate:tafsir`، `validate:tafsir-sample`، `verify:quran-d1:dry`.

### Changed
- توسيع `tafseer/data-provider.ts` بثلاث methods جديدة + تحسين `/ayah` و `/read` للاعتماد عليها.
- `README.md`: قسم v1.8 + تحديث جدول الحالة (139/139 tests).
- `SECURITY.md`: قسم تفاصيل مدقّق التفاسير + تحديث 10.2 لـ verify-quran-d1.
- `.github/workflows/ci.yml`: خطّ أنابيب أوسع.

### Tests
- **Total: 139/139 ✅** (ارتفعت من 95/95 في v1.7).

---

## [0.13.0] — 2026-05-02

### Added
- `docs/roadmap.md`: خريطة طريق احترافية تحتوي 13 مرحلة منجزة + خطط Q3/Q4 2026.
- `CONTRIBUTING.md`: دليل مساهمة شامل (Bug Fix / Feature / Data Import).
- `CHANGELOG.md`: سجل تغييرات منظّم وفق Keep a Changelog.
- `docs/database.md`: نموذج البيانات الكامل (seed + D1).

### Changed
- `README.md`: إضافة روابط إلى التوثيق الجديد.

---

## [0.12.0] — 2026-05-02

### Added
- **SEO**: sitemap.xml غني (مع `lastmod`, `changefreq`, `priority`)، JSON-LD structured data.
- **Canonical URLs** لكل صفحة عامة، `noindex` للصفحات الخاصة (المفضّلة، السجل).
- **PWA**: service worker مُحسّن مع cache strategies (cache-first للستاتيك، network-first للـ HTML).
- **Manifest**: categories, lang, dir, theme color متوافق مع iOS/Android.

### Fixed
- Service worker كان يخفق في تحديث الكاش بعد إصدار جديد.

---

## [0.11.0] — 2026-05-02

### Added
- **Strict CSP**: `default-src 'self'`، `script-src 'self'`، إزالة `unsafe-inline` و`unsafe-eval`.
- **Permissions-Policy**: حظر camera/microphone/geolocation/payment/usb.
- **HSTS**: `max-age=63072000; includeSubDomains; preload`.
- **COOP/CORP/CORS**: تشديد إعدادات الأصل المتقاطع.
- معالج أخطاء آمن لا يكشف stack traces.
- `docs/security.md`: توثيق نموذج التهديدات والإجراءات.

---

## [0.10.0] — Earlier

### Added
- Dashboard: مقاييس آيات بتفسير/بدون تفسير، توزيع المصادر والتحقق.
- صفحة الرئيسية: شريط original/summary/sample.

---

## [0.9.0] — Earlier

### Added
- بحث: اقتراحات حالة فارغة، روابط reset/fuzzy.
- صفحة الآية: شريط معلومات + فهرس سريع.
- صفحة القراءة: فلاتر (الكل/الموجزة/المُحققة).

---

## [0.8.0] — Earlier

### Added
- إحصاءات علمية: توزيع المصادر، حالة التحقق، أعلى الكتب/السور.
- `docs/importing-data.md`: إجراءات استيراد البيانات.

---

## [0.7.0] — Earlier

### Added
- **Importers**: validators لـ tafseers/ayahs/books/authors.
- Sample fixtures في `fixtures/import-samples/*`.

---

## [0.6.0] — Earlier

### Added
- **Data Access Layer** (DAL): `src/data-access/{types,seed-provider,index}.ts`.
- جاهز للتبديل بين seed و D1.

---

## [0.5.0] — Earlier

### Added
- D1 schema split: FTS5 إلى migration اختيارية `0002_fts5.sql`.
- `docs/d1-setup.md`: دليل إعداد D1.

---

## [0.4.0] — Earlier

### Added
- **GitHub Actions CI**: `.github/workflows/ci.yml` يبني المشروع على كل push/PR.
- شارة CI في README.

---

## [0.3.0] — Earlier

### Added
- صفحة القراءة المتسلسلة `/read/:n` مع شريط أدوات لاصق و TOC.
- التنقل بأسهم لوحة المفاتيح (RTL-aware).

---

## [0.2.0] — Earlier

### Added
- نظام المفضّلة + سجل التصفح (localStorage).
- لوحة الإحصاءات `/dashboard`.
- وضع ليلي/نهاري.

---

## [0.1.0] — Initial

### Added
- البنية الأساسية: Hono + Cloudflare Pages + Vite + RTL.
- 114 سورة + ~295 آية + ~100 تفسير seed.
- صفحات: home, search, ayah, books, authors, compare, categories, surahs, about.
- API: `/api/stats`, `/api/suggest`, `/api/search`, `/api/export/*`.

---

## نموذج إصدار جديد

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Deprecated
- ...

### Removed
- ...

### Fixed
- ...

### Security
- ...
```
