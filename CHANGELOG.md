# سجل التغييرات — Changelog

جميع التغييرات الملحوظة في هذا المشروع موثّقة هنا.
الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/ar/1.1.0/)
ويلتزم المشروع بـ [Semantic Versioning](https://semver.org/lang/ar/).

---

## [Unreleased]

### Added
- لا شيء بعد.

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
