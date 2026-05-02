# تفسير — Tafseer

[![CI](https://github.com/hkllmnnx-maker/tafseer/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hkllmnnx-maker/tafseer/actions/workflows/ci.yml)

تطبيق ويب متقدم للبحث في كتب تفسير القرآن الكريم، بواجهة عربية أصيلة (RTL) ونظام تصميم احترافي مبني على Cloudflare Pages + Hono.

> **حالة البيانات الحالية**: هذه نسخة تشغّل ببيانات seed داخل المستودع (114 سورة كاملة الفهرسة + ~295 آية + ~100 إدخال تفسير) وغالب نصوص التفاسير صياغات مختصرة (summary/sample) لا نقل حرفي. للتفاصيل انظر `/methodology` و `docs/scientific-verification.md` و `docs/roadmap.md`.

---

## 📊 جدول حالة المشروع (Project Status)

> **آخر تحديث**: 2 مايو 2026 (v1.7 — Beta-to-Real-Data Hardening)

| المحور | الحالة | التفاصيل |
|--------|--------|----------|
| **البنية الأساسية** | ✅ مكتملة | Hono + Cloudflare Pages + RTL + JSX |
| **بيانات seed** | ✅ مكتملة | 114 سورة، 295 آية، 12 كتابًا، 100 تفسير |
| **بيانات D1** | ✅ جاهزة للتفعيل | المخطّط + المايجريشن + Provider مكتمل، نقطة `--d1` للتشغيل المحلي |
| **DataProvider موحَّد** | ✅ مكتمل | جميع المسارات الحرجة عبر `getDataProvider(env)`، seed/D1 شفّاف |
| **بحث D1 (مستقل)** | ✅ مكتمل | JOINs + relevance + filters داخل D1، بدون اعتماد seed، FTS5 اختياري |
| **محرّك البحث** | ✅ seed + D1 | بحث متقدّم + autocomplete + suggest API + mode flag في الردود |
| **واجهة المستخدم** | ✅ مكتملة | بحث، آية، قراءة متسلسلة، مقارنة، كتب، مؤلفون، فئات، لوحة |
| **PWA** | ✅ v4 | Service Worker + Manifest + Offline + API fallback |
| **CSP صارم** | ✅ مكتمل | `script-src 'self' 'sha256-...'` بلا `unsafe-inline` |
| **Permissions-Policy** | ✅ مكتمل | إغلاق camera/mic/geo/payment/usb |
| **HSTS / COOP / CORP** | ✅ مكتمل | كلها مفعَّلة |
| **حقن SQL** | ✅ محصَّن | جميع استعلامات D1 عبر `prepare().bind()` فقط، لا concatenation |
| **اختبارات الوحدات** | ✅ 50/50 ناجحة | `node:test` + Mock D1 + Quran validator + normalize + seed export |
| **CI (GitHub Actions)** | ✅ يعمل | verify-data + validate-samples + export-seed + tests + build |
| **مستورد Quran JSON** | ✅ مكتمل | `validate-quran-json.mjs` + 16 اختبارًا + عينات صالحة/خاطئة |
| **FTS5 Migration** | ✅ منفصل (اختياري) | `0002_optional_fts5.sql` لا يُطبَّق تلقائيًا |
| **التحقّق العلمي** | 🟡 إطار جاهز | `sourceType` + `verificationStatus` على كل إدخال؛ المحتوى لا يزال غالبًا `summary` |
| **التوثيق** | ✅ شامل | 8 ملفات في `/docs` + README + CONTRIBUTING + CHANGELOG + SECURITY |
| **النشر** | 🟡 محلّيًا فقط | جاهز للنشر بـ `npm run deploy` بعد ضبط Cloudflare API token |

**الرموز:** ✅ مكتمل · 🟡 جاهز/جزئي · ⏳ مخطّط · ❌ غير مدعوم.

---

## 1) نظرة عامة على المشروع
- **الاسم**: تفسير (Tafseer)
- **الهدف**: تمكين الباحثين وطلاب العلم من البحث الدقيق في كتب التفسير، ومقارنة أقوال المفسرين، واستكشاف معاني القرآن بأدوات حديثة وقراءة متسلسلة لكل سورة مع تفاسيرها.
- **المنصة**: Cloudflare Pages + Hono (SSR على الحافة)
- **اللغة**: TypeScript + JSX (Hono JSX)
- **التصميم**: نظام تصميم مخصّص بالكامل (CSS Variables + RTL) دون Bootstrap.
- **GitHub**: https://github.com/hkllmnnx-maker/tafseer

---

## 2) الميزات المُنجَزة حاليًا

### 2.1 صفحات وواجهة المستخدم
- **الصفحة الرئيسية** الفاخرة: Hero، شريط بحث ذكي مع autocomplete، إحصاءات حية، ميزات، كتب مشهورة، عمليات بحث شائعة، شريط "آخر ما تصفّحته" (من السجل المحلي).
- **بحث متقدم** (`/search`): بحث نصي + فلترة بسورة/نطاق آيات/كتب/مؤلفين/مدارس/قرون، تطابق تام/غامض، ترتيب بالصلة/التاريخ/الكتاب/الترتيب القرآني، pagination.
- **عرض الآية** (`/ayah/:surah/:ayah`): الآية مع كل تفاسيرها جنبًا إلى جنب، تمييز كلمات البحث، أزرار نسخ/مشاركة/فتح، طيّ تلقائي للتفاسير الطويلة، توسيع/طي الكل، مفضّلة، تكبير/تصغير الخط.
- **🆕 صفحة القراءة المتسلسلة** (`/read/:n`): سورة كاملة (آيات + تفاسير مدمجة) في صفحة واحدة مع:
  - **شريط أدوات لاصق** (Sticky Toolbar): تكبير الخط، إخفاء/إظهار كل التفاسير (محفوظ في localStorage)، رابط لقائمة الآيات.
  - **فهرس داخلي (TOC)** بشرائح للآيات + تمييز تلقائي للآية الحالية أثناء التمرير عبر `IntersectionObserver`.
  - **التنقل بالأسهم**: ⬅ سهم اليسار = الآية التالية، ➡ سهم اليمين = السابقة (متوافق مع RTL).
  - زر "العودة للأعلى" مصغّر بجانب كل آية، تنقل بين السور (السابق/التالي).
- **الكتب والمؤلفون** (`/books`, `/authors` + التفاصيل): بحث، فرز، عرض كامل.
- **المقارنة** (`/compare`): اختيار آية وعرض تفاسير 2–5 كتب جنبًا إلى جنب.
- **الموضوعات** (`/categories`, `/categories/:id`).
- **السور** (`/surahs`, `/surahs/:n`) مع زر CTA رئيسي للقراءة المتسلسلة.
- **عن التطبيق** (`/about`).

### 2.2 ميزات تفاعلية متقدمة
- **🌙 وضع ليلي/نهاري** مع حفظ التفضيل في localStorage.
- **📑 المفضّلة** (`/bookmarks`) — حفظ الآيات محليًا (localStorage)، صفحة عرض، شارة عدد، إضافة/حذف من أي مكان.
- **🕒 سجل التصفح** (`/history`) — تتبع تلقائي لآخر الآيات، صفحة عرض، شريط "آخر ما تصفّحته" في الرئيسية.
- **🔮 اقتراحات ذكية** — autocomplete في كل حقول البحث (يعتمد `/api/suggest`).
- **📊 لوحة إحصاءات** (`/dashboard`) — رسوم بيانية لتغطية الكتب، المؤلفين، المدارس، القرون، أكثر السور تغطية، نسبة التغطية الإجمالية.
- **🔠 تكبير الخط** بثلاث مستويات (محفوظ).
- **📋 نسخ/مشاركة** الآية والتفسير (Web Share API + clipboard fallback).
- **PWA**: manifest + service worker + أيقونة التطبيق + تثبيت على الجوال.
- **SEO**: Open Graph، sitemap.xml ديناميكي، robots.txt، عناوين عربية ووصف مخصّص لكل صفحة.

### 2.3 🆕 تحسينات الأداء (Cache Layer)
- **Hono middleware** للـ Cache-Control الذكي:
  - `/static/*` → `max-age=31536000, immutable` (سنة كاملة)
  - `/api/*` → `s-maxage=300, stale-while-revalidate=3600`
  - HTML pages → `s-maxage=120, stale-while-revalidate=600`
  - `/sw.js` → `must-revalidate` (لا يُخزَّن أبدًا)
- **Cloudflare Pages `_headers`** للتخزين على CDN حتى عند تخطي Worker.
- **`_routes.json`** يستثني `/static/*` و `/sw.js` من Worker لتقليل الاستدعاءات.

---

## 3) خريطة المسارات (URIs)

### 3.1 صفحات HTML
| الصفحة | المسار | المعاملات |
|---|---|---|
| الرئيسية | `/` | — |
| البحث المتقدم | `/search` | `q, surah, ayahFrom, ayahTo, bookIds[], authorIds[], schools[], centuryFrom, centuryTo, exactMatch, fuzzy, searchIn, sort, page` |
| عرض آية | `/ayah/:surah/:ayah` | `q` (لتمييز الكلمات) |
| **قراءة متسلسلة 🆕** | `/read/:n` | — (سورة كاملة بكل تفاسيرها) |
| الكتب | `/books` | `q, school, sort` |
| تفاصيل كتاب | `/books/:id` | — |
| المؤلفون | `/authors` | `q, sort` |
| تفاصيل مؤلف | `/authors/:id` | — |
| المقارنة | `/compare` | `surah, ayah, bookIds[]` |
| الموضوعات | `/categories` | — |
| موضوع | `/categories/:id` | — |
| السور | `/surahs` | `q, type` |
| سورة | `/surahs/:n` | — |
| المفضّلة | `/bookmarks` | — |
| سجل التصفح | `/history` | — |
| لوحة الإحصاءات | `/dashboard` | — |
| عن التطبيق | `/about` | — |

### 3.2 واجهة برمجية (JSON API)

> **ملاحظة هندسية**: جميع المسارات الحرجة (stats, surahs, books, authors, categories, ayah, search, suggest) تمرّ عبر `getDataProvider(env)` وتُرجِع `mode: "seed" | "d1"` لتشخيص العميل. مسارات `/api/export/*` معزولة عن DataProvider بقصد، وهي **seed-only** (للتدقيق العلمي والمساهمة).

#### واجهة القراءة الموحَّدة (DataProvider)
| المسار | الوصف | المصدر |
|---|---|---|
| `GET /api/stats` | إحصاءات عامة (عدد كتب، مؤلفين، سور، آيات، تفاسير) | DataProvider |
| `GET /api/stats/detailed` | إحصاءات تفصيلية (لكل كتاب/مؤلف/مدرسة/قرن) | DataProvider (تجميعات D1 native) |
| `GET /api/suggest?q=&limit=` | اقتراحات autocomplete | DataProvider |
| `GET /api/search?q=&...` | البحث (نفس فلاتر `/search` + relevance + pagination) | DataProvider (D1 JOINs مستقلة) |
| `GET /api/surahs` / `GET /api/surahs/:n` | السور | DataProvider |
| `GET /api/books` / `GET /api/books/:id` | الكتب | DataProvider |
| `GET /api/authors` / `GET /api/authors/:id` | المؤلفون | DataProvider |
| `GET /api/categories` | الموضوعات | DataProvider |
| `GET /api/ayah/:surah/:ayah` | آية وتفاسيرها مع رسائل خطأ مفصّلة (404 لسورة/آية غير موجودة) | DataProvider |

#### نقاط تصدير seed (Seed-only export — موسومة)
كل ردّ يحتوي على `meta.source = "seed"` ورأس `X-Tafseer-Data-Source: seed`. الغرض: التدقيق العلمي وتسهيل المساهمات الخارجية.

| المسار | الوصف |
|---|---|
| `GET /api/export/all` | تصدير شامل JSON (سور + كتب + مؤلفين + فئات + آيات + تفاسير + إحصاءات) |
| `GET /api/export/books` | تصدير الكتب |
| `GET /api/export/authors` | تصدير المؤلفين |
| `GET /api/export/surahs` | تصدير السور |
| `GET /api/export/ayahs` | تصدير الآيات |
| `GET /api/export/tafseers` | تصدير التفاسير |
| `GET /api/export/categories` | تصدير الموضوعات |

#### أدوات التحقّق (offline scripts)
| الأمر | الوصف |
|---|---|
| `npm run verify:data` | فحص اتساق بيانات seed (foreign keys، حدود الآيات، whitelist) |
| `npm run validate:samples` | تحقّق من عينات استيراد التفاسير (dry-run) |
| `npm run validate:quran-sample` | تحقّق من عينة JSON قرآنية صغيرة |
| `npm run validate:quran -- <file> [--full] [--strict] [--json]` | مدقّق مستورد القرآن: 114 سورة، حدود الآيات، تكرار، نص فارغ، 6236 آية |
| `npm run import:quran -- <file> [--full] [--strict] [--allow-partial] [--json] [--filename=NAME]` | **مستورد القرآن الكامل**: يولّد `dist/import/ayahs-full.sql` (INSERT OR REPLACE) + `quran-import-report.json` مع SHA-256 وقواعد تحقّق صارمة. لا يلتزم ببيانات قرآنية كاملة في git. |
| `npm run import:quran:sample` | تشغيل المستورد على عيّنة `fixtures/import-samples/quran-valid-sample.json` (`--allow-partial`) للتحقّق من السلسلة كاملة |
| `npm run export:seed-sql` | توليد `dist/import/seed-data.sql` و `seed-data.json` لاستيراد D1 |
| `npm run d1:smoke` | فحص جاهزية D1 محلّيًا دون أسرار: يتحقّق من ملفات seed، migrations، wrangler binding، ويحاول `SELECT 1` على D1 محلي |
| `npm run db:migrate:local` / `db:migrate:prod` | تطبيق المايجريشن على D1 (يشمل `0003_ayah_sources.sql`) |

### 3.3 ملفات نظامية
- `/manifest.json` — PWA manifest
- `/sitemap.xml` — خريطة الموقع الديناميكية (تشمل كل آية وكتاب ومؤلف)
- `/robots.txt` — توجيهات الزواحف
- `/sw.js` — Service Worker
- `/static/*` — الأصول الثابتة (CSS، JS، أيقونات)
- `/_headers` — قواعد Cache على Cloudflare Pages

---

## 4) بنية البيانات (Data Models)

| الملف | المحتوى | الحجم الحالي |
|---|---|---|
| `src/data/surahs.ts` | السور | 114 سورة |
| `src/data/ayahs.ts` | الآيات (نص عربي مع تشكيل) | **295 آية** (Juz Amma كامل + آيات مفتاحية) |
| `src/data/books.ts` | كتب التفسير | 16 كتاب |
| `src/data/authors.ts` | المؤلفون | 16 مؤلفًا |
| `src/data/tafseers.ts` | نصوص التفسير | **100 إدخال** |
| `src/data/categories.ts` | الموضوعات | + ربط بالكتب |

**حقول `TafseerEntry`**: `id, bookId, surah, ayah, text, volume?, page?, source?, isSample?`.

> البيانات حاليًا في ملفات بذرة TypeScript. الواجهة جاهزة للترقية إلى Cloudflare D1 عبر تعريف Bindings فقط، أو لمحرك بحث خارجي (Meilisearch/Typesense) مستقبلًا.

---

## 5) محرّك البحث (`src/lib/`)
- **`normalize.ts`** — تطبيع للعربية: إزالة التشكيل، توحيد الهمزات (أ/إ/آ → ا)، ة/ه، ي/ى، طبيع المسافات.
- **`search.ts`**:
  - بحث tokenized مع scoring قائم على عدد التطابقات + شعبية الكتاب.
  - تطابق تام (`exactMatch`) أو غامض (`fuzzy`) أو افتراضي.
  - فلاتر: سورة، نطاق آيات، كتب، مؤلفون، مدارس، قرون.
  - ترتيب: relevance / date / book / author.
  - Pagination + snippet ذكي بسياق محيطي.
  - `getStats()` و `getDetailedStats()` للوحات.
  - `suggest()` لاقتراحات autocomplete (سور، كتب، مؤلفون، مواضيع شائعة، آيات).

---

## 6) دليل الاستخدام السريع
1. افتح الصفحة الرئيسية: `/`.
2. اكتب في شريط البحث (مثل "الرحمن"، "الصلاة"، "التوحيد") أو اضغط اقتراحًا شائعًا.
3. لتفعيل الفلاتر الدقيقة (سورة، نطاق، كتب، مدارس، قرن) اذهب إلى `/search`.
4. من بطاقة نتيجة → اضغط رقم الآية للذهاب إلى `/ayah/:surah/:ayah`.
5. **🆕 لقراءة سورة كاملة** اذهب إلى `/surahs/:n` ثم اضغط "قراءة متسلسلة"، أو مباشرة `/read/:n`.
6. في صفحة القراءة: استخدم الأسهم ⬅ ➡ للتنقل بين الآيات، أو أزرار "إخفاء التفاسير" / "حجم الخط".
7. اضغط "مقارنة" لاختيار 2–5 كتب وعرضها جنبًا إلى جنب.
8. تصفّح: `/books` / `/authors` / `/categories` / `/surahs` / `/dashboard`.
9. احفظ الآيات في `/bookmarks`، تابع سجلّك في `/history`.
10. زر "🌙" أعلى الصفحة لتبديل الوضع الليلي/النهاري.

---

## 7) الأمان
- `secureHeaders` (CSP صارم، Referrer-Policy، X-Content-Type-Options، HSTS، COOP، CORP) في كل الطلبات.
- CORS مقيّد على `/api/*` بقراءة فقط (`GET/HEAD/OPTIONS`، `credentials: false`).
- Validation على كل المعاملات (whitelisting للـ enums، تحجيم الاستعلامات، `parseIntSafe`).
- **D1 Provider**: جميع استعلامات SQL عبر `prepare().bind()` فقط — لا concatenation
  لقيم المستخدم. ORDER BY و searchIn من قوائم بيضاء حصرًا. LIKE patterns مع
  `ESCAPE '\\'` لتهريب `%`/`_`/`\`. HARD_LIMIT = 500 صف لكل بحث.
- منع XSS عبر JSX escaping تلقائي + CSP صارم (`script-src 'self' 'sha256-...'` بدون `unsafe-inline`).
- لا تُكشف رسائل الأخطاء الداخلية (`onError` يعرض صفحة عامة + `/api/*` تُعيد JSON موحّدًا).
- ملفات السرّيات في `.env`/`.dev.vars` ضمن `.gitignore`.
- لا توجد مسارات admin، ولا نقاط كتابة علنية. `database_id` في `wrangler.jsonc` placeholder افتراضًا.
- المحتوى الديني: لا تُضاف نصوص قرآن/تفسير دون مصدر موثَّق وعلامة `sourceUrl`. راجع `SECURITY.md` §10.1.

## 8) الأداء و SEO
- **SSR كامل** على الحافة (Cloudflare Workers) — TTFB منخفض جدًا.
- **Cache layer ثلاثي**: Worker middleware + `_headers` + `_routes.json`.
- **Service Worker** للـ offline + cache للأصول الثابتة.
- **Smooth scroll**، **scroll-margin** للـ anchors، **IntersectionObserver** للـ TOC.
- `meta description` + `og:*` + sitemap.xml ديناميكي يشمل كل الصفحات والآيات.
- خطوط `system-ui` عربية أصيلة دون تحميل ثقيل.
- حجم Bundle الحالي: **~269 KB** (`dist/_worker.js`).

---

## 9) بنية الملفات
```
webapp/
├─ src/
│  ├─ index.tsx                 # نقطة الدخول، routes، middleware (CORS, Cache, CSP)
│  ├─ renderer.tsx              # HTML shell + meta + theme bootstrap
│  ├─ data/
│  │  ├─ surahs.ts              # 114 سورة
│  │  ├─ ayahs.ts               # 295 آية
│  │  ├─ books.ts               # 16 كتاب تفسير
│  │  ├─ authors.ts             # 16 مؤلفًا
│  │  ├─ tafseers.ts            # 100 إدخال تفسيري
│  │  └─ categories.ts          # الموضوعات
│  ├─ lib/
│  │  ├─ normalize.ts           # تطبيع العربية
│  │  └─ search.ts              # محرك البحث + الإحصاءات + suggest
│  └─ views/
│     ├─ icons.tsx              # أيقونات SVG inline
│     ├─ components/layout.tsx  # Header, Footer, Breadcrumbs, Toast
│     └─ pages/                 # home, search, ayah, read 🆕, books,
│                               # authors, compare, categories, surahs,
│                               # bookmarks, history, dashboard, about
├─ public/
│  ├─ static/
│  │  ├─ style.css              # نظام التصميم الكامل (RTL، dark mode، read page)
│  │  ├─ app.js                 # تفاعلية كاملة (theme، bookmarks، history، read 🆕)
│  │  └─ app-icon.png           # أيقونة التطبيق
│  ├─ sw.js                     # Service Worker
│  └─ _headers                  # 🆕 Cloudflare Pages cache rules
├─ ecosystem.config.cjs         # PM2 config (wrangler pages dev :3000)
├─ wrangler.jsonc               # Cloudflare config
├─ vite.config.ts               # Vite + @hono/vite-build
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 10) التشغيل المحلي
```bash
cd /home/user/webapp
npm install                      # (مُنفّذ مسبقًا)
npm run build                    # بناء dist/_worker.js
pm2 start ecosystem.config.cjs   # تشغيل wrangler pages dev على :3000
curl http://localhost:3000       # اختبار سريع
pm2 logs tafseer --nostream      # سجلات بدون block
```

**أوامر مفيدة:**
```bash
pm2 restart tafseer              # إعادة تشغيل (بعد تغيير الكود)
pm2 delete tafseer               # إيقاف وإزالة
fuser -k 3000/tcp                # تنظيف المنفذ يدويًا
npm run deploy                   # نشر إلى Cloudflare Pages
```

---

## 11) النشر
- **GitHub**: https://github.com/hkllmnnx-maker/tafseer
- **Cloudflare Pages**: جاهز للنشر بـ `npm run deploy` بعد ضبط مفتاح Cloudflare.
- **الحالة**: ✅ يعمل محليًا — جميع المسارات والواجهات البرمجية تستجيب 200.

---

## 12) البنية العلمية والتحقق (Scientific Verification)

> **إفصاح مهم**: البيانات الحالية **عيّنة جزئية** (100 إدخال تفسيري على 295 آية)
> وغالبيتها **ملخّصات مكتوبة بأسلوب الفريق**، وليست نصوصًا أصلية حرفية من كتب التفسير.
> راجع `/methodology` للتفاصيل الكاملة.

### 12.1 حقول `TafseerEntry` العلمية
| الحقل | القيم المسموحة | الغرض |
|---|---|---|
| `sourceType` | `original-text` / `summary` / `sample` / `under-review` | نوع المحتوى |
| `verificationStatus` | `verified` / `partially-verified` / `unverified` / `disputed` | درجة التحقّق |
| `sourceName` | اسم الكتاب الأصلي | الإسناد |
| `isOriginalText` | boolean | هل النص حرفي؟ |
| `reviewerNote` | string اختياري | ملاحظة المراجع |

### 12.2 شارات التحقّق في الواجهة
- شارة **نوع المصدر** (لون مختلف لكل نوع: ذهبي للأصلي، أصفر للسامبل، رمادي للملخّص).
- شارة **حالة التحقّق** (أخضر/أصفر/أحمر) مع تحذير علمي بارز للنصوص غير المحقّقة.
- **بانر إفصاح** على كل صفحة آية وبحث، يربط بـ `/methodology`.

### 12.3 سكربتات التحقّق والاستيراد

```bash
npm run verify:data        # فحص شامل لسلامة البيانات (سور/آيات/كتب/تفاسير)
npm run validate:import    # validate any JSON file: node scripts/importers/validate-import.mjs <file> [--dry-run]
npm run validate:samples   # تشغيل سريع على fixtures/import-samples/valid-sample.json
```

`scripts/importers/validate-import.mjs` يفرض:
- حقول إلزامية (`id`, `bookId`, `surah`, `ayah`, `text`, `sourceType`, `verificationStatus`).
- نطاق سور (1..114) ومطابقة آية مع عدد آيات السورة.
- whitelist لـ `sourceType` و `verificationStatus`.
- منع IDs مكرّرة، حدّ أدنى لطول النص (5 أحرف).
- تقرير ملوّن بالعربية، وضع `--dry-run` افتراضيًا (لا تعديل لقاعدة البيانات).

### 12.4 Cloudflare D1 — هجرة المخطّط

ملف الهجرة الأول: **`db/migrations/0001_initial_schema.sql`** (9.3 كيلوبايت).

الجداول المُعرَّفة:
| الجدول | الغرض |
|---|---|
| `surahs` | السور (PK: number, UNIQUE: name, CHECK: number 1..114) |
| `ayahs` | الآيات (PK مركّب surah+ayah، FK→surahs، CHECK: ayah ≥ 1) |
| `authors` | المؤلفون (PK، CHECK: deathYear بين 0..2100) |
| `tafsir_books` | الكتب (PK، FK→authors، فهارس على author/school) |
| `tafsir_entries` | إدخالات التفسير (PK، FK→books, ayahs، CHECK على sourceType/verificationStatus، فهرس مركّب على surah+ayah) |
| `categories` | الموضوعات (PK، UNIQUE: slug) |
| `book_categories` | M:N (book ↔ category) |
| `import_jobs` | مهام الاستيراد (status, totals, started/finished_at) |
| `audit_logs` | سجلّ التدقيق (actor, action, target, payload JSON) |

كذلك جدول FTS5 افتراضي `tafsir_entries_fts` (افتراضي معلَّق حتى تشغيل D1) للبحث الكامل.

**التشغيل (عند الجاهزية):**
```bash
wrangler d1 create tafseer-production       # ينشئ DB ويعطيك database_id
# ضع database_id في wrangler.jsonc تحت d1_databases
npm run db:migrate:local                    # تطبيق الهجرة محليًا
npm run db:migrate:prod                     # تطبيق الهجرة على الإنتاج
```

---

## 13) ما لم يُنفَّذ بعد (Roadmap)
- ✅ تشغيل D1 محلّيًا (يعمل: `mode=d1` على جميع نقاط `/api/*`، seed مُحمَّل عبر `dist/import/seed-data.sql`).
- استيراد كامل لـ 6236 آية إلى D1 الإنتاج (المستورد + المايجريشن + التقارير جاهزة في `scripts/importers/import-quran.mjs` — يُنتظر فقط ملف JSON موثوق خارج المستودع).
- لوحة إدارة محمية بـ Cloudflare Access (CRUD، استيراد JSON/CSV/SQLite).
- مزامنة المفضّلة وسجل التصفح عبر حساب مستخدم (Auth).
- توسيع البيانات لتشمل 30+ كتابًا تفسيريًّا.
- محرك بحث خارجي (Meilisearch/Typesense) للأداء على ملايين السجلات.
- دعم الصوتيات (تلاوات + قراءة آلية للتفاسير).
- ترجمة الواجهة (إنجليزية/تركية/أوردو).

### 13.x مستورد القرآن الكامل (Beta — جاهز للتشغيل)

```bash
# 1) ضع ملف JSON موثوق خارج المستودع (لا يُلتزم في git)
mkdir -p .imports
curl -fL https://trusted-source/quran.json -o .imports/quran-full.json

# 2) دقِّق الملف بـ validator أولاً
npm run validate:quran -- .imports/quran-full.json --full --strict

# 3) ولِّد ملف SQL آمنًا + تقرير JSON (لا يلمس الشبكة)
node scripts/importers/import-quran.mjs .imports/quran-full.json \
  --full --strict --filename=ayahs-full.sql

# 4) طبِّق المايجريشن (تشمل 0003_ayah_sources.sql)
npm run db:migrate:prod

# 5) نفِّذ ملف SQL على D1 الإنتاج
npx wrangler d1 execute tafseer-production --file=dist/import/ayahs-full.sql

# 6) تحقّق
curl https://<your-pages>/api/stats          # ayahsCount: 6236, mode: d1
curl https://<your-pages>/api/ayah/2/255     # آية الكرسي
```

**الأعلام:** `--full` (يُلزم 6236)، `--strict` (يُلزم HTTPS sourceUrl)، `--allow-partial`
(للعيّنات/التطوير)، `--json` (تقرير stdout للCI)، `--filename=NAME` (اسم SQL ناتج).
المخرجات: `dist/import/ayahs-full.sql` + `dist/import/quran-import-report.json` (مع SHA-256
للمدخل). تفاصيل كاملة في `docs/quran-import-plan.md`.

---

## 13) سجل التحديثات

### v1.5 — 1 مايو 2026
- ✅ **التحقّق العلمي**: حقول `sourceType`, `verificationStatus`, `sourceName`, `isOriginalText`, `reviewerNote` على كل تفسير + قيم افتراضية محافِظة للإدخالات القديمة.
- ✅ **API محسَّن**: `/api/ayah/:s/:a` يعيد 404 صحيح (`surah_not_found`, `ayah_number_invalid`, `ayah_text_unavailable`)، و`/api/search` يدعم `sourceTypes[]` + `verificationStatuses[]` عبر `sanitizeFilters`.
- ✅ **واجهة التحقّق**: شارات SourceType/Verification، تحذير بارز للنصوص غير المحقّقة، بانر إفصاح علمي على صفحات الآية والبحث، نسخ مع المصدر الكامل.
- ✅ **D1 schema**: `db/migrations/0001_initial_schema.sql` (9 جداول + قيود + فهارس + FTS5).
- ✅ **بنية الاستيراد**: `scripts/importers/validate-import.mjs` (dry-run، رسائل عربية، whitelist، duplicate detection)، `fixtures/import-samples/{valid,invalid}-sample.json`.
- ✅ **التحقّق التلقائي**: `scripts/verify-data.mjs` + `npm run verify:data`، فحص شامل بدون أخطاء.
- ✅ **لوحة إحصاءات علمية**: نسبة النصوص الأصلية/الملخّصات/العيّنات، قيد المراجعة، التحقّق الكامل، نسبة التغطية.
- ✅ **صفحة قراءة محسَّنة**: شريط تقدّم تغطية، شارة اكتمال، تنبيه عيّنة جزئية.
- ✅ **SECURITY.md** شامل (12 قسمًا: secrets، vuln disclosure، CSP، CORS، LocalStorage، import restrictions، PII).
- ✅ **sitemap محسَّن**: يضم `/methodology`، يقتصر على الآيات الموجودة في العيّنة.

### v1.4 — 1 مايو 2026
- ✅ **توسيع الآيات** من ~50 إلى **295 آية** (Juz Amma كامل + آيات مفتاحية من سور كبرى).
- ✅ **توسيع التفاسير** من 60 إلى **100 إدخال** لتغطية الآيات الجديدة.
- ✅ **🆕 صفحة القراءة المتسلسلة** `/read/:n` بأدوات قراءة لاصقة (toolbar)، TOC تفاعلي، تنقل بالأسهم، إخفاء/إظهار التفاسير، تنقل بين السور.
- ✅ **🆕 طبقة Cache ذكية**: Hono middleware + `_headers` + smooth-scroll global.
- ✅ تحديث README الشامل.

### v1.3 — سابقًا
- لوحة الإحصاءات `/dashboard` + `/api/export/*`.
- اقتراحات ذكية `/api/suggest`.
- سجل التصفح `/history`.
- المفضّلة `/bookmarks`.

### v1.2 — سابقًا
- توثيق README شامل (architecture، URIs، security).

### v1.1 — سابقًا
- إصلاح: استبدال `require` runtime بـ static imports.

### v1.0
- إطلاق أولي.

---

## 14) التوثيق المتقدّم

| المستند | الوصف |
|---------|-------|
| [`docs/roadmap.md`](docs/roadmap.md) | خريطة الطريق ومراحل المشروع |
| [`docs/database.md`](docs/database.md) | نموذج البيانات (seed + D1) |
| [`docs/d1-setup.md`](docs/d1-setup.md) | إعداد قاعدة بيانات Cloudflare D1 |
| [`docs/importing-data.md`](docs/importing-data.md) | استيراد بيانات التفاسير |
| [`docs/scientific-verification.md`](docs/scientific-verification.md) | منهجية التحقق العلمي |
| [`docs/security.md`](docs/security.md) | نموذج الأمان وCSP |
| [`docs/testing.md`](docs/testing.md) | دليل الاختبارات (وحدات + CI) |
| [`docs/final-report.md`](docs/final-report.md) | تقرير المراحل المنجزة |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | دليل المساهمة |
| [`CHANGELOG.md`](CHANGELOG.md) | سجل التغييرات |
| [`SECURITY.md`](SECURITY.md) | سياسة الأمان والإفصاح |

---

## 15) آخر تحديث
**2 مايو 2026 (v1.6)** — اكتمال المرحلة الأخيرة: PWA v4 مع API fallback ذكي، CSP صارم (إزالة `'unsafe-inline'` من `script-src` واستبداله بـ SHA-256 hash)، D1 Provider مع تبديل تلقائي، 18 اختبار وحدة ناجح، CI محسّن، توثيق شامل (8 ملفات في `/docs`)، وجدول حالة المشروع.

### v1.5 — 1 مايو 2026
- اكتمال المراحل 11→13: تحسينات الأمان (CSP صارم، Permissions-Policy، HSTS)، SEO/PWA متقدّم (sitemap غني، JSON-LD، canonical URLs، service worker مُحسّن)، والتوثيق المهني الكامل (roadmap, contributing, changelog).
