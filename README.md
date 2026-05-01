# تفسير — Tafseer

تطبيق ويب متقدم للبحث في كتب تفسير القرآن الكريم، بواجهة عربية أصيلة (RTL) ونظام تصميم احترافي مبني على Cloudflare Pages + Hono.

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
| المسار | الوصف |
|---|---|
| `GET /api/stats` | إحصاءات عامة (عدد كتب، مؤلفين، سور، آيات، تفاسير) |
| `GET /api/stats/detailed` | إحصاءات تفصيلية (لكل كتاب/مؤلف/مدرسة/قرن) |
| `GET /api/suggest?q=` | اقتراحات autocomplete |
| `GET /api/search?q=&...` | البحث (نفس فلاتر `/search`) |
| `GET /api/surahs` / `GET /api/surahs/:n` | السور |
| `GET /api/books` / `GET /api/books/:id` | الكتب |
| `GET /api/authors` / `GET /api/authors/:id` | المؤلفون |
| `GET /api/categories` | الموضوعات |
| `GET /api/ayah/:surah/:ayah` | آية وتفاسيرها |
| `GET /api/export/all` | تصدير شامل JSON |
| `GET /api/export/books` | تصدير الكتب |
| `GET /api/export/authors` | تصدير المؤلفين |
| `GET /api/export/surahs` | تصدير السور |
| `GET /api/export/ayahs` | تصدير الآيات |
| `GET /api/export/tafseers` | تصدير التفاسير |
| `GET /api/export/categories` | تصدير الموضوعات |

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
- `secureHeaders` (CSP صارم، Referrer-Policy، X-Content-Type-Options) في كل الطلبات.
- CORS مقيّد على `/api/*` بقراءة فقط.
- Validation على كل المعاملات (whitelisting للـ enums، تحجيم الاستعلامات، `parseIntSafe`).
- لا قاعدة بيانات SQL مكشوفة → لا حقن SQL ممكن في النسخة الحالية.
- منع XSS عبر JSX escaping تلقائي + CSP صارم.
- لا تُكشف رسائل الأخطاء الداخلية (`onError` يعرض صفحة عامة).
- ملفات السرّيات في `.env`/`.dev.vars` ضمن `.gitignore`.

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

## 12) ما لم يُنفَّذ بعد (Roadmap)
- ربط Cloudflare D1 وإنشاء migrations (الجداول جاهزة بنيويًا).
- لوحة إدارة (CRUD للكتب والمؤلفين، استيراد JSON/CSV/SQLite).
- مزامنة المفضّلة وسجل التصفح عبر حساب مستخدم (Auth).
- توسيع البيانات لتشمل القرآن كاملاً (~6236 آية، أكثر من 12 كتاب تفسير).
- محرك بحث خارجي (Meilisearch/Typesense) للأداء على ملايين السجلات.
- دعم الصوتيات (تلاوات + قراءة آلية للتفاسير).
- ترجمة الواجهة (إنجليزية/تركية/أوردو).

---

## 13) سجل التحديثات

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

## 14) آخر تحديث
**1 مايو 2026** — اكتمال المراحل 1→5 من خارطة الطريق: توسيع البيانات، صفحة قراءة متسلسلة، تحسينات أداء، توثيق شامل. جميع المسارات (HTML + API) تستجيب HTTP 200.
