import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { renderer } from './renderer'

import { Header, Footer } from './views/components/layout'
import { HomePage } from './views/pages/home'
import { SearchPage } from './views/pages/search'
import { AyahPage } from './views/pages/ayah'
import { BooksPage, BookDetailPage } from './views/pages/books'
import { AuthorsPage, AuthorDetailPage } from './views/pages/authors'
import { ComparePage } from './views/pages/compare'
import { CategoriesPage, CategoryDetailPage } from './views/pages/categories'
import { SurahsPage, SurahDetailPage } from './views/pages/surahs'
import { ReadPage } from './views/pages/read'
import { AboutPage } from './views/pages/about'
import { BookmarksPage } from './views/pages/bookmarks'
import { HistoryPage } from './views/pages/history'
import { DashboardPage } from './views/pages/dashboard'
import { MethodologyPage } from './views/pages/methodology'

import {
  search, suggest, getStats, getDetailedStats, sanitizeFilters,
  MAX_QUERY_LENGTH, type SearchFilters,
} from './lib/search'
import { getDataProvider } from './lib/data'
import { SURAHS, getSurahByNumber } from './data/surahs'
import { BOOKS } from './data/books'
import { AUTHORS } from './data/authors'
import { CATEGORIES } from './data/categories'
import { TAFSEERS, getTafseersByAyah } from './data/tafseers'
import { AYAHS, getAyah } from './data/ayahs'
import type { TafseerSchool } from './data/books'
import type { SourceType, VerificationStatus } from './lib/scientific'
import {
  ayahExistsInQuran, ayahHasText, ayahHasTafseer,
  getSurahCoverage, getOverallCoverage, getAllSurahCoverages,
} from './lib/coverage'

const app = new Hono()

// ============== Security headers ==============
// CSP أضيق + Permissions-Policy + COOP/CORP + HSTS + nosniff + DENY frames.
//
// ملاحظة عن 'unsafe-inline':
//   - styleSrc: ما زال مستخدمًا لأن JSX يحقن style="..." في عدة بطاقات (شارات، فلاتر).
//     خطة الإزالة موثّقة في docs/security.md.
//   - scriptSrc: أُزيلت 'unsafe-inline' وحلّ محلّها hash مخصّص (SHA-256) لسكربت
//     تهيئة الثيم في src/renderer.tsx. أيّ تعديل على نصّ ذلك السكربت يستدعي
//     إعادة حساب الـ hash (انظر docs/security.md → "كيفية تحديث CSP hash").
//     سكربت JSON-LD (type="application/ld+json") هو بيانات وليس قابلًا للتنفيذ
//     ولا يخضع لقيود scriptSrc في المتصفّحات الحديثة.
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: [
        "'self'",
        // hash لسكربت inline يهيّئ الثيم قبل أوّل رسم لمنع وميض الوضع الداكن.
        // إذا غُيِّر محتوى ذلك السكربت يجب إعادة حساب الـ hash.
        "'sha256-XDgFU4l0pZIkpiMebd0KPkXydQsyFJhP/U4A/laXaxU='",
      ],
      scriptSrcAttr: ["'none'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      accelerometer: [],
      gyroscope: [],
      magnetometer: [],
      midi: [],
      fullscreen: ['self'],
    },
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
  }),
)

// ============== CORS ==============
// API للقراءة فقط: يبقى عامًا (origin: '*') لأن المحتوى عام (تفاسير، آيات، إحصاءات)،
// ولا توجد بيانات حساسة للمستخدم تُرجَع. credentials: false ليمنع المتصفّح
// من إرسال الكوكيز/الترويسات الخاصة. allowMethods مقصور على الآمنة فقط.
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
  exposeHeaders: ['Cache-Control'],
  credentials: false,
  maxAge: 600,
}))

// ============== Cache headers (performance) ==============
// 1) الأصول الثابتة: تخزين طويل (سنة، immutable)
app.use('/static/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'public, max-age=31536000, immutable')
})

// 2) Service worker: لا يُخزَّن (يجب التحقق دائمًا)
app.use('/sw.js', async (c, next) => {
  await next()
  c.header('Cache-Control', 'public, max-age=0, must-revalidate')
})

// 3) API: تخزين قصير على CDN + stale-while-revalidate
app.use('/api/*', async (c, next) => {
  await next()
  if (!c.res.headers.get('Cache-Control')) {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  }
})

// 4) صفحات HTML: تخزين قصير على CDN فقط
app.use('*', async (c, next) => {
  await next()
  const ct = c.res.headers.get('Content-Type') || ''
  if (ct.includes('text/html') && !c.res.headers.get('Cache-Control')) {
    c.header('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=600')
  }
})

// Renderer
app.use(renderer as any)

// ============== Helper to parse arrays from query ==============
function parseArrayParam(c: any, key: string): string[] {
  const all = c.req.queries(key) as string[] | undefined
  if (all && all.length) return all
  const single = c.req.query(key)
  return single ? [single] : []
}

// ============== Pages ==============
// مساعد لبناء canonical URL مطلق من المسار
function canonicalUrl(c: any, path: string): string {
  const u = new URL(path, c.req.url)
  return u.toString()
}

app.get('/', c => c.render(<HomePage />, {
  title: 'الرئيسية',
  description: 'منصّة تفسير: ابحث في كتب تفسير القرآن الكريم بمنهجية علميّة، تصفّح السور والآيات، وراجع المصادر بشفافية كاملة.',
  canonical: canonicalUrl(c, '/'),
} as any))

app.get('/search', async c => {
  const filters = sanitizeFilters({
    q: c.req.query('q'),
    surah: c.req.query('surah') as any,
    ayahFrom: c.req.query('ayahFrom') as any,
    ayahTo: c.req.query('ayahTo') as any,
    bookIds: parseArrayParam(c, 'bookIds'),
    authorIds: parseArrayParam(c, 'authorIds'),
    schools: parseArrayParam(c, 'schools') as TafseerSchool[],
    sourceTypes: parseArrayParam(c, 'sourceTypes') as SourceType[],
    verificationStatuses: parseArrayParam(c, 'verificationStatuses') as VerificationStatus[],
    centuryFrom: c.req.query('centuryFrom') as any,
    centuryTo: c.req.query('centuryTo') as any,
    exactMatch: c.req.query('exactMatch') === '1',
    fuzzy: c.req.query('fuzzy') === '1',
    searchIn: c.req.query('searchIn') as any,
    sort: c.req.query('sort') as any,
    page: c.req.query('page') as any,
    perPage: 10,
  })
  // نستخدم DataProvider حتى يأتي البحث من D1 إن كان مفعّلًا، وإلا
  // يقع تلقائيًا على seed. تظهر شارة results.mode على واجهة البحث.
  const data = getDataProvider(c.env as any)
  const results = await data.search(filters)
  return c.render(
    <SearchPage filters={filters} results={results} />,
    {
      title: filters.q ? `البحث عن: ${filters.q}` : 'البحث المتقدم',
      description: filters.q
        ? `نتائج البحث عن «${filters.q}» في كتب تفسير القرآن الكريم.`
        : 'بحث متقدّم في كتب التفسير: فلاتر بالسورة، الكتاب، المؤلف، نوع المصدر، وحالة التحقّق.',
      canonical: canonicalUrl(c, filters.q ? `/search?q=${encodeURIComponent(filters.q)}` : '/search'),
    } as any,
  )
})

app.get('/ayah/:surah/:ayah', async c => {
  const surah = parseIntSafe(c.req.param('surah')) || 0
  const ayah = parseIntSafe(c.req.param('ayah')) || 0
  const q = (c.req.query('q') || '').slice(0, MAX_QUERY_LENGTH)

  // ----- DataProvider: D1 if env.DB present, else seed (fallbacks built-in) -----
  const data = getDataProvider(c.env as any)
  const [surahData, ayahData, tafseers] = await Promise.all([
    Promise.resolve(data.getSurahByNumber(surah)),
    Promise.resolve(data.getAyah(surah, ayah)),
    Promise.resolve(data.getTafseersByAyah(surah, ayah)),
  ])

  // Phase: Quran coverage - return 404 for verses that don't exist in the Qur'an at all
  if (!surahData || !ayahExistsInQuran(surah, ayah)) {
    c.status(404)
    return c.render(
      <AyahPage
        surah={surah} ayah={ayah} q={q} notFound={true}
        surahData={surahData} ayahData={ayahData} tafseers={tafseers}
        dataMode={data.name}
      />,
      { title: 'آية غير موجودة' } as any,
    )
  }

  return c.render(
    <AyahPage
      surah={surah} ayah={ayah} q={q}
      surahData={surahData} ayahData={ayahData} tafseers={tafseers}
      dataMode={data.name}
    />,
    {
      title: `سورة ${surahData.name} - آية ${ayah}`,
      description: `تفسير الآية ${ayah} من سورة ${surahData.name} من عدة كتب تفسير معتمدة، مع توضيح حالة التحقّق ومصدر كل نص.`,
      canonical: canonicalUrl(c, `/ayah/${surah}/${ayah}`),
      ogType: 'article',
    } as any,
  )
})

app.get('/books', async c => {
  const q = c.req.query('q') || ''
  const school = c.req.query('school') || ''
  const sort = c.req.query('sort') || 'popular'
  // DataProvider: D1 إن توفّر env.DB، وإلا seed
  const data = getDataProvider(c.env as any)
  const [books, authors] = await Promise.all([data.listBooks(), data.listAuthors()])
  return c.render(
    <BooksPage q={q} school={school} sort={sort} books={books} authors={authors} dataMode={data.name} />,
    {
      title: 'كتب التفسير',
      description: 'فهرس كتب تفسير القرآن الكريم المتوفّرة في المنصّة، مرتّبة بحسب المدرسة التفسيرية والشهرة.',
      canonical: canonicalUrl(c, '/books'),
    } as any,
  )
})
app.get('/books/:id', c => {
  const id = c.req.param('id')
  const book = BOOKS.find(b => b.id === id)
  if (!book) c.status(404)
  return c.render(
    <BookDetailPage bookId={id} />,
    {
      title: book ? book.title : 'كتاب غير موجود',
      description: book ? `معلومات كتاب «${book.title}» وفهرس التفاسير المتوفّرة منه في المنصّة.` : undefined,
      canonical: canonicalUrl(c, `/books/${id}`),
      ogType: 'book',
    } as any,
  )
})

app.get('/authors', async c => {
  const q = c.req.query('q') || ''
  const sort = c.req.query('sort') || 'oldest'
  const data = getDataProvider(c.env as any)
  const [authors, books] = await Promise.all([data.listAuthors(), data.listBooks()])
  return c.render(
    <AuthorsPage q={q} sort={sort} authors={authors} books={books} dataMode={data.name} />,
    {
      title: 'المؤلفون',
      description: 'مؤلّفو كتب التفسير المتوفّرة في المنصّة: تواريخهم ومدارسهم وأعمالهم.',
      canonical: canonicalUrl(c, '/authors'),
    } as any,
  )
})
app.get('/authors/:id', c => {
  const id = c.req.param('id')
  const a = AUTHORS.find(x => x.id === id)
  if (!a) c.status(404)
  return c.render(<AuthorDetailPage authorId={id} />, {
    title: a ? a.name : 'مؤلف غير موجود',
    description: a ? `سيرة موجزة للمؤلّف ${a.name} وكتبه التفسيريّة المتوفّرة.` : undefined,
    canonical: canonicalUrl(c, `/authors/${id}`),
    ogType: 'profile',
  } as any)
})

app.get('/compare', c => {
  const surah = parseIntSafe(c.req.query('surah'))
  const ayah = parseIntSafe(c.req.query('ayah'))
  const bookIds = parseArrayParam(c, 'bookIds')
  return c.render(
    <ComparePage surah={surah} ayah={ayah} bookIds={bookIds} />,
    {
      title: 'المقارنة بين التفاسير',
      description: 'قارن بين تفاسير الآية الواحدة من عدّة كتب جنبًا إلى جنب.',
      canonical: canonicalUrl(c, '/compare'),
    } as any,
  )
})

app.get('/categories', c => c.render(<CategoriesPage />, {
  title: 'البحث الموضوعي',
  description: 'تصفّح آيات القرآن الكريم وتفاسيرها مرتّبة حسب الموضوعات الكبرى.',
  canonical: canonicalUrl(c, '/categories'),
} as any))
app.get('/categories/:id', c => {
  const id = c.req.param('id')
  const cat = CATEGORIES.find(x => x.id === id)
  if (!cat) c.status(404)
  return c.render(<CategoryDetailPage id={id} />, {
    title: cat ? cat.name : 'موضوع غير موجود',
    description: cat ? `الآيات المتعلّقة بموضوع «${cat.name}» وتفاسيرها.` : undefined,
    canonical: canonicalUrl(c, `/categories/${id}`),
  } as any)
})

app.get('/surahs', async c => {
  const q = c.req.query('q') || ''
  const type = c.req.query('type') || ''
  const data = getDataProvider(c.env as any)
  const surahs = await data.listSurahs()
  return c.render(
    <SurahsPage q={q} type={type} surahs={surahs} dataMode={data.name} />,
    {
      title: 'سور القرآن',
      description: 'فهرس سور القرآن الكريم الـ 114 مع نوعها (مكية/مدنية) وعدد آياتها وترتيب نزولها.',
      canonical: canonicalUrl(c, '/surahs'),
    } as any,
  )
})
app.get('/surahs/:n', c => {
  const n = parseIntSafe(c.req.param('n')) || 0
  const s = getSurahByNumber(n)
  if (!s) c.status(404)
  return c.render(
    <SurahDetailPage surahNumber={n} />,
    {
      title: s ? `سورة ${s.name}` : 'سورة غير موجودة',
      description: s ? `تفاصيل سورة ${s.name}: عدد الآيات، نوع السورة، ترتيب النزول، والآيات المتوفّرة في العينة.` : undefined,
      canonical: canonicalUrl(c, `/surahs/${n}`),
    } as any,
  )
})

// قراءة متسلسلة لسورة كاملة (آيات + تفاسير مدمجة)
app.get('/read/:n', async c => {
  const n = parseIntSafe(c.req.param('n')) || 0
  const filterParam = c.req.query('filter')
  const filter = (filterParam === 'summaries' || filterParam === 'verified') ? filterParam : 'all'

  // ----- DataProvider: 3 parallel queries via getReadSurahPayload (no N+1) -----
  const data = getDataProvider(c.env as any)
  const payload = await Promise.resolve(
    data.getReadSurahPayload
      ? data.getReadSurahPayload(n)
      : { surah: data.getSurahByNumber(n), ayahs: [], tafseersByAyah: {}, mode: data.name }
  )
  const s = payload.surah

  return c.render(
    <ReadPage
      surahNumber={n}
      filter={filter as any}
      surah={payload.surah}
      ayahs={payload.ayahs}
      tafseersByAyah={payload.tafseersByAyah}
      dataMode={data.name}
    />,
    {
      title: s ? `قراءة سورة ${s.name}` : 'قراءة',
      description: s ? `قراءة متسلسلة لسورة ${s.name} مع التفاسير المدمجة لكل آية.` : undefined,
      canonical: canonicalUrl(c, `/read/${n}`),
      ogType: 'article',
    } as any,
  )
})

app.get('/about', c => c.render(<AboutPage />, {
  title: 'عن التطبيق',
  description: 'تعرّف على منصّة تفسير: الأهداف، الفريق، والتقنيات المستخدمة.',
  canonical: canonicalUrl(c, '/about'),
} as any))
app.get('/methodology', c => c.render(
  <MethodologyPage />,
  {
    title: 'منهجية التوثيق العلمي',
    description: 'كيف نوثّق نصوص التفسير ونميّز بين النصوص الأصلية والملخّصات والعيّنات.',
    canonical: canonicalUrl(c, '/methodology'),
  } as any,
))

// صفحات تخزّن محتواها محليًا في المتصفّح فقط — لا قيمة لفهرستها في محرّكات البحث
app.get('/bookmarks', c => c.render(
  <BookmarksPage />,
  {
    title: 'المفضلة',
    description: 'الآيات التي حفظتها للمراجعة لاحقًا. تُخزَّن محليًا في متصفّحك فقط.',
    canonical: canonicalUrl(c, '/bookmarks'),
    noindex: true,
  } as any,
))

app.get('/history', c => c.render(
  <HistoryPage />,
  {
    title: 'سجل التصفح',
    description: 'آخر الآيات التي تصفّحتها مؤخرًا. يُخزَّن محليًا في متصفّحك فقط.',
    canonical: canonicalUrl(c, '/history'),
    noindex: true,
  } as any,
))

app.get('/dashboard', async c => {
  // مُحدَّث: نمرّر إحصاءات DataProvider الفعلية (seed أو D1) للصفحة
  // بدل إعادة حسابها من seed داخل الواجهة. الشارة في Dashboard تعرض
  // وضع البيانات الفعلي بناءً على data.name.
  // كذلك نمرّر ملخّص تغطية القرآن (ayahs/surahs/isComplete/percent) لعرضه
  // في بطاقة مستقلّة وربط API /api/quran/coverage.
  const data = getDataProvider(c.env as any)
  const [stats, coverage] = await Promise.all([
    data.getStatsDetailed(),
    Promise.resolve(
      data.getQuranCoverageSummary
        ? data.getQuranCoverageSummary()
        : undefined,
    ),
  ])
  return c.render(
    <DashboardPage dataMode={data.name} stats={stats} coverage={coverage as any} />,
    {
      title: 'لوحة الإحصاءات',
      description: 'نظرة شاملة على محتوى التطبيق: الكتب، المؤلفون، المدارس التفسيرية، توزيع القرون، والسور الأكثر تغطية.',
      canonical: canonicalUrl(c, '/dashboard'),
    } as any,
  )
})

// ============== JSON API ==============
// نستعمل طبقة DataProvider (seed أو D1) لجلب الإحصاءات.
// عند عدم تفعيل D1 binding يبقى السلوك متطابقًا (seed mode).
app.get('/api/stats', async c => {
  const data = getDataProvider(c.env as any)
  const stats = await data.getStatsBasic()
  return c.json({ ok: true, data: stats, mode: data.name })
})
app.get('/api/stats/detailed', async c => {
  const data = getDataProvider(c.env as any)
  const stats = await data.getStatsDetailed()
  return c.json({ ok: true, data: stats, mode: data.name })
})

// ملخّص تغطية القرآن — عدد الآيات/السور، اكتمال، نسبة، ومصدر البيانات.
// يستخدم DataProvider.getQuranCoverageSummary() (seed أو D1).
app.get('/api/quran/coverage', async c => {
  const data = getDataProvider(c.env as any)
  const summary = data.getQuranCoverageSummary
    ? await data.getQuranCoverageSummary()
    : {
        ayahsCount: 0, expectedAyahs: 6236, surahsCovered: 0,
        isComplete: false, coveragePercent: 0, mode: data.name,
      }
  return c.json({ ok: true, data: summary, mode: data.name })
})

// ============== JSON Export Endpoints (SEED-only by design) ==============
// هذه النقاط تُصدِّر بيانات seed الموجودة في src/data/* كما هي. هي ليست
// واجهة قراءة عامّة (استخدم /api/surahs, /api/books ... لذلك). الغرض منها
// هو التحقّق العلمي وتدقيق المصدر وتسهيل المساهمات الخارجية. لذلك:
//   - لا تمرّ عبر DataProvider
//   - تتضمّن عَلَمًا meta.source = 'seed' في جسم الجواب
//   - تضع X-Tafseer-Data-Source: seed كرأس استجابة
function jsonExport(c: any, filename: string, payload: any) {
  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="${filename}"`)
  c.header('Cache-Control', 'no-store')
  c.header('X-Tafseer-Data-Source', 'seed')
  return c.body(JSON.stringify(payload, null, 2))
}
const SEED_META = () => ({
  source: 'seed' as const,
  exportedAt: new Date().toISOString(),
  notice:
    'بيانات seed داخل المستودع — للتدقيق العلمي والمساهمة فقط، ليست بديلًا عن واجهة /api/* في وضع D1.',
})
app.get('/api/export/all', c => jsonExport(c, 'tafseer-all.json', {
  meta: SEED_META(),
  surahs: SURAHS,
  books: BOOKS,
  authors: AUTHORS,
  categories: CATEGORIES,
  ayahs: AYAHS,
  tafseers: TAFSEERS,
  stats: getStats(),
}))
app.get('/api/export/books',      c => jsonExport(c, 'tafseer-books.json',      { meta: SEED_META(), data: BOOKS }))
app.get('/api/export/authors',    c => jsonExport(c, 'tafseer-authors.json',    { meta: SEED_META(), data: AUTHORS }))
app.get('/api/export/surahs',     c => jsonExport(c, 'tafseer-surahs.json',     { meta: SEED_META(), data: SURAHS }))
app.get('/api/export/ayahs',      c => jsonExport(c, 'tafseer-ayahs.json',      { meta: SEED_META(), data: AYAHS }))
app.get('/api/export/tafseers',   c => jsonExport(c, 'tafseer-tafseers.json',   { meta: SEED_META(), data: TAFSEERS }))
app.get('/api/export/categories', c => jsonExport(c, 'tafseer-categories.json', { meta: SEED_META(), data: CATEGORIES }))
app.get('/api/surahs', async c => {
  const data = getDataProvider(c.env as any)
  const list = await data.listSurahs()
  return c.json({ ok: true, data: list, mode: data.name })
})
app.get('/api/surahs/:n', async c => {
  const n = parseIntSafe(c.req.param('n')) || 0
  const data = getDataProvider(c.env as any)
  const s = await data.getSurahByNumber(n)
  if (!s) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json({ ok: true, data: s, mode: data.name })
})
app.get('/api/books', async c => {
  const data = getDataProvider(c.env as any)
  const list = await data.listBooks()
  return c.json({ ok: true, data: list, mode: data.name })
})
app.get('/api/books/:id', async c => {
  const data = getDataProvider(c.env as any)
  const b = await data.getBookById(c.req.param('id'))
  if (!b) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json({ ok: true, data: b, mode: data.name })
})
app.get('/api/authors', async c => {
  const data = getDataProvider(c.env as any)
  const list = await data.listAuthors()
  return c.json({ ok: true, data: list, mode: data.name })
})
app.get('/api/authors/:id', async c => {
  const data = getDataProvider(c.env as any)
  const a = await data.getAuthorById(c.req.param('id'))
  if (!a) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json({ ok: true, data: a, mode: data.name })
})
app.get('/api/categories', async c => {
  const data = getDataProvider(c.env as any)
  const list = await data.listCategories()
  return c.json({ ok: true, data: list, mode: data.name })
})
app.get('/api/ayah/:surah/:ayah', async c => {
  const surah = parseIntSafe(c.req.param('surah')) || 0
  const ayah = parseIntSafe(c.req.param('ayah')) || 0
  const data = getDataProvider(c.env as any)
  const surahData = await data.getSurahByNumber(surah)

  // 1) السورة غير موجودة في القرآن أصلاً
  if (!surahData) {
    return c.json({
      ok: false,
      error: 'surah_not_found',
      message: `السورة رقم ${surah} غير موجودة في القرآن. القرآن الكريم يحتوي على 114 سورة فقط.`,
      params: { surah, ayah },
      mode: data.name,
    }, 404)
  }

  // 2) رقم الآية غير صحيح قرآنيًا في هذه السورة
  if (!ayahExistsInQuran(surah, ayah)) {
    return c.json({
      ok: false,
      error: 'ayah_number_invalid',
      message: `سورة ${surahData.name} تحتوي على ${surahData.ayahCount} آية فقط، والآية رقم ${ayah} غير موجودة فيها.`,
      params: { surah, ayah },
      surah: { number: surahData.number, name: surahData.name, ayahCount: surahData.ayahCount },
      mode: data.name,
    }, 404)
  }

  // 3) الآية صحيحة قرآنيًا لكن نصها غير متوفر في العينة الحالية
  const a = await data.getAyah(surah, ayah)
  const tafseers = await data.getTafseersByAyah(surah, ayah)
  if (!a) {
    const cov = getSurahCoverage(surah)
    return c.json({
      ok: false,
      error: 'ayah_text_unavailable',
      message: `الآية ${ayah} من سورة ${surahData.name} موجودة في القرآن، لكن نصها غير متوفر في العينة الحالية للتطبيق.`,
      params: { surah, ayah },
      surah: { number: surahData.number, name: surahData.name, ayahCount: surahData.ayahCount },
      coverage: cov ? {
        availableAyahs: cov.availableAyahs,
        totalAyahs: cov.totalAyahs,
        ayahCoveragePercent: cov.ayahCoveragePercent,
        completeness: cov.completeness,
      } : undefined,
      tafseersCount: tafseers.length,
      tafseers: tafseers.length ? tafseers : undefined,
      mode: data.name,
    }, 404)
  }

  // 4) كل شيء متوفر
  return c.json({
    ok: true,
    data: {
      ayah: a,
      tafseers,
      surah: { number: surahData.number, name: surahData.name, ayahCount: surahData.ayahCount, type: surahData.type },
      tafseersCount: tafseers.length,
    },
    mode: data.name,
  })
})

app.get('/api/suggest', async c => {
  const q = c.req.query('q') || ''
  if (q.length > 80) return c.json({ ok: false, error: 'query_too_long' }, 400)
  const limit = Math.min(20, Math.max(1, parseIntSafe(c.req.query('limit')) || 10))
  const data = getDataProvider(c.env as any)
  const items = await data.suggest(q, limit)
  c.header('Cache-Control', 'public, max-age=60')
  return c.json({ ok: true, data: { q, items }, mode: data.name })
})

app.get('/api/search', async c => {
  const rawQ = c.req.query('q') || ''
  if (rawQ.length > MAX_QUERY_LENGTH) {
    return c.json({
      ok: false,
      error: 'query_too_long',
      message: `يجب أن يكون طول البحث أقل من ${MAX_QUERY_LENGTH} حرفًا.`,
      maxLength: MAX_QUERY_LENGTH,
    }, 400)
  }
  // Use the same sanitizer the page route uses, so behaviour is identical
  // and all filters (including sourceTypes / verificationStatuses) are honoured.
  const filters = sanitizeFilters({
    q: rawQ,
    surah: c.req.query('surah') as any,
    ayahFrom: c.req.query('ayahFrom') as any,
    ayahTo: c.req.query('ayahTo') as any,
    bookIds: parseArrayParam(c, 'bookIds'),
    authorIds: parseArrayParam(c, 'authorIds'),
    schools: parseArrayParam(c, 'schools') as TafseerSchool[],
    sourceTypes: parseArrayParam(c, 'sourceTypes') as SourceType[],
    verificationStatuses: parseArrayParam(c, 'verificationStatuses') as VerificationStatus[],
    centuryFrom: c.req.query('centuryFrom') as any,
    centuryTo: c.req.query('centuryTo') as any,
    exactMatch: c.req.query('exactMatch') === '1',
    fuzzy: c.req.query('fuzzy') === '1',
    searchIn: c.req.query('searchIn') as any,
    sort: c.req.query('sort') as any,
    page: c.req.query('page') as any,
    perPage: c.req.query('perPage') as any,
  })
  // Route through DataProvider: D1 path is fully self-sufficient (joins, relevance);
  // seed path falls back to in-memory engine. Mode is exposed for client diagnostics.
  const data = getDataProvider(c.env as any)
  const results = await data.search(filters)
  return c.json({ ok: true, data: results, filters, mode: data.name })
})

// ============== PWA Manifest ==============
app.get('/manifest.json', c => {
  return c.json({
    name: 'تفسير — البحث العلمي في كتب تفسير القرآن الكريم',
    short_name: 'تفسير',
    description:
      'منصّة ويب علميّة للبحث المتقدّم في كتب تفسير القرآن الكريم، مع التزام بالمنهجية العلميّة وشفافية المصادر.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fdfcf8',
    theme_color: '#0f5c3e',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      { src: '/static/app-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/static/app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/static/app-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' },
    ],
    categories: ['education', 'books', 'reference', 'religion'],
    shortcuts: [
      { name: 'البحث', short_name: 'بحث',  url: '/search' },
      { name: 'لوحة الإحصاءات', short_name: 'إحصاءات', url: '/dashboard' },
      { name: 'المنهجية العلمية', short_name: 'منهجية', url: '/methodology' },
      { name: 'سور القرآن', short_name: 'السور', url: '/surahs' },
    ],
  })
})

// robots.txt + sitemap
app.get('/robots.txt', c => {
  const sitemapUrl = new URL('/sitemap.xml', c.req.url).toString()
  return c.text(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',          // API ليست محتوى للزحف
      'Disallow: /bookmarks',     // محلية للمستخدم
      'Disallow: /history',       // محلية للمستخدم
      '',
      `Sitemap: ${sitemapUrl}`,
      '',
    ].join('\n'),
  )
})

app.get('/sitemap.xml', c => {
  const base = new URL('/', c.req.url).toString().replace(/\/$/, '')
  // نُدرج فقط الآيات الموجودة في العينة (لا نزعم تغطية القرآن كاملاً).
  // كذلك نضمّن صفحة /methodology و /read/:n للسور المغطّاة.
  const surahsWithAyahs = new Set(AYAHS.map(a => a.surah))
  const today = new Date().toISOString().slice(0, 10)

  type Entry = { loc: string; priority: number; changefreq: string }
  const entries: Entry[] = [
    { loc: '/',            priority: 1.0, changefreq: 'weekly'  },
    { loc: '/search',      priority: 0.9, changefreq: 'daily'   },
    { loc: '/methodology', priority: 0.9, changefreq: 'monthly' },
    { loc: '/dashboard',   priority: 0.8, changefreq: 'weekly'  },
    { loc: '/books',       priority: 0.8, changefreq: 'weekly'  },
    { loc: '/authors',     priority: 0.7, changefreq: 'weekly'  },
    { loc: '/categories',  priority: 0.7, changefreq: 'weekly'  },
    { loc: '/surahs',      priority: 0.8, changefreq: 'weekly'  },
    { loc: '/compare',     priority: 0.6, changefreq: 'monthly' },
    { loc: '/about',       priority: 0.5, changefreq: 'monthly' },

    ...BOOKS.map(b      => ({ loc: `/books/${b.id}`,        priority: 0.7, changefreq: 'monthly' })),
    ...AUTHORS.map(a    => ({ loc: `/authors/${a.id}`,      priority: 0.6, changefreq: 'monthly' })),
    ...CATEGORIES.map(c2 => ({ loc: `/categories/${c2.id}`, priority: 0.6, changefreq: 'monthly' })),
    ...SURAHS.map(s     => ({ loc: `/surahs/${s.number}`,   priority: 0.6, changefreq: 'monthly' })),
    ...Array.from(surahsWithAyahs).sort((a, b) => a - b).map(n => ({
      loc: `/read/${n}`, priority: 0.7, changefreq: 'monthly',
    })),
    ...AYAHS.map(a => ({
      loc: `/ayah/${a.surah}/${a.number}`, priority: 0.6, changefreq: 'monthly',
    })),
  ]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(e =>
      `  <url>` +
      `<loc>${base}${e.loc}</loc>` +
      `<lastmod>${today}</lastmod>` +
      `<changefreq>${e.changefreq}</changefreq>` +
      `<priority>${e.priority.toFixed(1)}</priority>` +
      `</url>`,
    ).join('\n') +
    `\n</urlset>`
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' })
})

// 404
app.notFound(c => {
  c.status(404)
  return c.render(
    <>
      <Header />
      <main class="container" style="padding:5rem 0;text-align:center">
        <h1 style="font-size:5rem;margin-bottom:.5rem">٤٠٤</h1>
        <p class="text-tertiary mb-6">الصفحة المطلوبة غير موجودة</p>
        <a href="/" class="btn btn-primary">العودة للرئيسية</a>
      </main>
      <Footer />
    </>,
    { title: 'صفحة غير موجودة' } as any,
  )
})

// ============== Error handler ==============
// لا نكشف رسائل الخطأ أو stack traces للمستخدم النهائي.
// نُسجّل تفاصيل الخطأ في console (ستظهر في Cloudflare logs) ونعيد رسالة عامّة.
// لمسارات /api/* نعيد JSON موحّدًا بدون تفاصيل.
app.onError((err, c) => {
  // سجلّ داخلي فقط - لن يصل للمستخدم
  try {
    console.error('App error:', err && (err as Error).message ? (err as Error).message : 'unknown', {
      path: c.req.path,
      method: c.req.method,
    })
  } catch { /* تجاهل أخطاء التسجيل */ }

  // لمسارات API: JSON موحّد بدون stack/تفاصيل
  if (c.req.path.startsWith('/api/')) {
    return c.json({ ok: false, error: 'internal_error', message: 'حدث خطأ غير متوقع.' }, 500)
  }

  // للصفحات: واجهة ودودة بدون أي تفاصيل تقنية
  return c.render(
    <>
      <Header />
      <main class="container" style="padding:5rem 0;text-align:center">
        <h1>حدث خطأ غير متوقع</h1>
        <p class="text-tertiary mb-4">نعتذر، يرجى المحاولة مرة أخرى لاحقًا.</p>
        <a href="/" class="btn btn-primary">العودة للرئيسية</a>
      </main>
      <Footer />
    </>,
    { title: 'خطأ' } as any,
  )
})

function parseIntSafe(s: string | undefined | null): number | undefined {
  if (!s) return undefined
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export default app
