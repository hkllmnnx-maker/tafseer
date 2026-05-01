# تفسير — Tafseer

تطبيق ويب متقدم للبحث في كتب تفسير القرآن الكريم، بواجهة عربية أصيلة (RTL) ونظام تصميم احترافي.

## نظرة عامة على المشروع
- **الاسم**: تفسير (Tafseer)
- **الهدف**: تمكين الباحثين وطلاب العلم من البحث الدقيق في كتب التفسير، ومقارنة أقوال المفسرين، واستكشاف معاني القرآن بأدوات حديثة.
- **المنصة**: Cloudflare Pages + Hono (SSR على الحافة)
- **اللغة**: TypeScript + JSX (Hono JSX)
- **التصميم**: نظام تصميم مخصّص بالكامل (CSS Variables + RTL) دون Bootstrap.

## الميزات الحالية
- صفحة رئيسية فاخرة (Hero، شريط بحث ذكي، إحصاءات، ميزات، كتب مشهورة، عمليات بحث شائعة).
- صفحة بحث متقدّم: بحث نصي، بحث داخل سورة/آية معيّنة أو نطاق آيات، فلترة بالكتب والمؤلفين والمدارس التفسيرية والقرون، تطابق تام/غامض، ترتيب بالصلة/الكتاب/الترتيب القرآني.
- صفحة عرض الآية مع مقارنة جانبية بين عدة كتب وتمييز كلمات البحث.
- صفحات الكتب والمؤلفين مع البحث والفرز وعرض التفاصيل.
- صفحة المقارنة: اختيار آية وعرض تفاسير 2–5 كتب جنبًا إلى جنب.
- صفحة الموضوعات (التوحيد، الصلاة …) مع تنبيه أن النتائج فهرسة وليست فتوى.
- صفحات الفهارس: السور، السور التفصيلية مع الآيات.
- صفحة "عن التطبيق".
- وضع ليلي/نهاري، breadcrumbs، skeletons، empty states، صفحة ٤٠٤، error boundaries.
- PWA: manifest + service worker (offline cache) + أيقونة التطبيق.
- SEO: Open Graph، sitemap.xml، robots.txt، عناوين عربية ووصف مخصّص لكل صفحة.

## بنية الواجهة (URIs)
| الصفحة | المسار | المعاملات |
|---|---|---|
| الرئيسية | `/` | — |
| البحث المتقدم | `/search` | `q, surah, ayahFrom, ayahTo, bookIds[], authorIds[], schools[], centuryFrom, centuryTo, exactMatch, fuzzy, searchIn, sort, page` |
| عرض آية وتفاسيرها | `/ayah/:surah/:ayah` | `q` (اختياري لتمييز الكلمات) |
| الكتب | `/books` | `q, school, sort` |
| تفاصيل كتاب | `/books/:id` | — |
| المؤلفون | `/authors` | `q, sort` |
| تفاصيل مؤلف | `/authors/:id` | — |
| المقارنة | `/compare` | `surah, ayah, bookIds[]` |
| الموضوعات | `/categories` | — |
| موضوع | `/categories/:id` | — |
| السور | `/surahs` | `q, type` |
| سورة | `/surahs/:n` | — |
| عن التطبيق | `/about` | — |

### واجهة برمجية (JSON API)
- `GET /api/stats` — إحصاءات عامة.
- `GET /api/surahs` — قائمة السور.
- `GET /api/surahs/:n` — تفاصيل سورة.
- `GET /api/books` — قائمة الكتب.
- `GET /api/books/:id` — تفاصيل كتاب.
- `GET /api/authors` / `GET /api/authors/:id`.
- `GET /api/categories` — الموضوعات.
- `GET /api/ayah/:surah/:ayah` — الآية وتفاسيرها.
- `GET /api/search?q=...&...` — البحث (نفس فلاتر الواجهة).

### مسارات إضافية
- `/manifest.json`, `/sitemap.xml`, `/robots.txt`, `/static/*`.

## بنية البيانات (Data Models)
- **surahs**: السور (114 سورة) — الاسم، الترتيب، عدد الآيات، النوع (مكية/مدنية)، النزول.
- **ayahs**: عينة من الآيات (بالنص العربي مع التشكيل) مرتبطة بالسورة.
- **tafsir_books**: كتب التفسير — العنوان، المؤلف، المدرسة (سلفي/أشعري/معتزلي/شيعي/علمي/أدبي)، القرن، عدد الأجزاء، اللغة الأصلية.
- **authors**: المؤلفون — الاسم، السنة، الكنية، المدرسة، نبذة.
- **tafsir_entries**: نصوص التفسير — مرتبطة بـ (surah, ayah, bookId, authorId)، مع حقول المصدر والجزء.
- **categories** + **book_categories**: الموضوعات وربطها بالكتب.

> البيانات حاليًا في ملفات بذرة TypeScript (`src/data/*.ts`). الواجهة جاهزة للترقية إلى Cloudflare D1 عبر تعريف Bindings فقط، أو لمحرك بحث خارجي (Meilisearch/Typesense) مستقبلًا.

## محرّك البحث
- Normalizer للعربية (تشكيل، همزات، ة/ه، ي/ى) في `src/lib/normalize.ts`.
- بحث ذكي مع scoring بسيط، تطابق تام/غامض، جذور تقريبية، تمييز الكلمات في النتائج.
- pagination، إعداد per-page، debounce على الواجهة.

## دليل الاستخدام السريع
1. افتح الصفحة الرئيسية: `/`.
2. اكتب كلمة في شريط البحث (مثل: «الرحمن»، «الصلاة»، «التوحيد») أو اضغط على أحد الاقتراحات الشائعة.
3. استخدم صفحة `/search` لتفعيل الفلاتر المتقدّمة (سورة، نطاق آيات، كتب، مدارس، قرن).
4. من بطاقة نتيجة، اضغط على عنوان الآية للذهاب إلى `/ayah/:surah/:ayah` ومشاهدة كل التفاسير.
5. اضغط «مقارنة» لاختيار 2–5 كتب وعرضها جنبًا إلى جنب.
6. تصفّح فهرس الكتب `/books`، أو المؤلفين `/authors`، أو الموضوعات `/categories`.
7. زر «🌙» أعلى الصفحة لتبديل الوضع الليلي/النهاري.

## الأمان
- `secureHeaders` (CSP صارم، Referrer-Policy) في كل الطلبات.
- CORS مقيّد على `/api/*` بقراءة فقط.
- Validation على كل المعاملات (whitelisting للـ enums، تحجيم الاستعلامات، `parseIntSafe`).
- لا توجد قاعدة بيانات SQL مكشوفة → لا حقن SQL ممكن في النسخة الحالية.
- منع XSS عبر JSX escaping تلقائي + CSP.
- لا يتم كشف رسائل الأخطاء الداخلية للمستخدم (`onError` يعرض صفحة عامة).
- ملفات السرّيات في `.env`/`.dev.vars` ضمن `.gitignore`.

## الأداء و SEO
- SSR كامل على الحافة (Cloudflare Workers).
- Service Worker للـ offline + cache للأصول الثابتة.
- `meta description`، `og:*`، sitemap.xml ديناميكي يشمل كل الصفحات والآيات.
- خطوط `system-ui` عربية أصيلة دون تحميل ثقيل.

## بنية الملفات
```
src/
  index.tsx                # نقطة الدخول و routes
  renderer.tsx             # HTML shell + meta + theme
  data/                    # surahs, ayahs, books, authors, categories, tafseers
  lib/
    normalize.ts           # تطبيع العربية
    search.ts              # محرك البحث + الإحصاءات
  views/
    icons.tsx              # أيقونات SVG
    components/layout.tsx  # Header, Footer, Breadcrumbs, Toast
    pages/                 # home, search, ayah, books, authors, compare,
                           # categories, surahs, about
public/
  static/
    style.css              # نظام التصميم الكامل (RTL، dark mode)
    app.js                 # تفاعلية (theme toggle، mobile drawer، ...)
    app-icon.png           # أيقونة التطبيق
  sw.js                    # Service Worker
```

## التشغيل المحلي
```bash
cd /home/user/webapp
npm install                     # (مُنفّذ مسبقًا)
npm run build                   # بناء dist/_worker.js
pm2 start ecosystem.config.cjs  # تشغيل خادم wrangler pages dev على :3000
curl http://localhost:3000      # اختبار سريع
pm2 logs tafseer --nostream     # سجلات
```

## النشر
- **GitHub**: https://github.com/hkllmnnx-maker/tafseer
- **Cloudflare Pages**: جاهز للنشر بـ `npm run deploy` بعد ضبط مفتاح Cloudflare.
- **الحالة**: ✅ يعمل محليًا — جميع المسارات والواجهات البرمجية تستجيب 200.

## ما لم يُنفَّذ بعد (Roadmap)
- ربط Cloudflare D1 وإنشاء migrations (الجداول جاهزة بنيويًا).
- لوحة إدارة (CRUD للكتب والمؤلفين، استيراد JSON/CSV/SQLite).
- إضافة مفضّلة (bookmarks) و users / auth.
- توسيع البيانات لتشمل القرآن كاملاً (114 سورة، ~6236 آية، أكثر من 12 كتاب تفسير).
- محرك بحث خارجي (Meilisearch/Typesense) للأداء على ملايين السجلات.

## آخر تحديث
1 مايو 2026 — إصلاح كامل للـ build، اختبار جميع المسارات، رفع إلى GitHub.
