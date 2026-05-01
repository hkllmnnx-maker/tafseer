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
import { AboutPage } from './views/pages/about'
import { BookmarksPage } from './views/pages/bookmarks'
import { HistoryPage } from './views/pages/history'
import { DashboardPage } from './views/pages/dashboard'

import { search, suggest, getStats, getDetailedStats, type SearchFilters } from './lib/search'
import { SURAHS, getSurahByNumber } from './data/surahs'
import { BOOKS } from './data/books'
import { AUTHORS } from './data/authors'
import { CATEGORIES } from './data/categories'
import { TAFSEERS, getTafseersByAyah } from './data/tafseers'
import { AYAHS, getAyah } from './data/ayahs'
import type { TafseerSchool } from './data/books'

const app = new Hono()

// Security headers
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
  }),
)

// CORS for API
app.use('/api/*', cors({ origin: '*', allowMethods: ['GET'] }))

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
app.get('/', c => c.render(<HomePage />, { title: 'الرئيسية' } as any))

app.get('/search', c => {
  const q = c.req.query('q') || ''
  const surah = parseIntSafe(c.req.query('surah'))
  const ayahFrom = parseIntSafe(c.req.query('ayahFrom'))
  const ayahTo = parseIntSafe(c.req.query('ayahTo'))
  const bookIds = parseArrayParam(c, 'bookIds')
  const authorIds = parseArrayParam(c, 'authorIds')
  const schools = parseArrayParam(c, 'schools') as TafseerSchool[]
  const centuryFrom = parseIntSafe(c.req.query('centuryFrom'))
  const centuryTo = parseIntSafe(c.req.query('centuryTo'))
  const exactMatch = c.req.query('exactMatch') === '1'
  const fuzzy = c.req.query('fuzzy') === '1'
  const searchIn = (c.req.query('searchIn') || 'all') as 'all' | 'tafseer' | 'ayah'
  const sort = (c.req.query('sort') || 'relevance') as any
  const page = parseIntSafe(c.req.query('page')) || 1

  const filters: SearchFilters = {
    q, surah, ayahFrom, ayahTo, bookIds, authorIds, schools,
    centuryFrom, centuryTo, exactMatch, fuzzy, searchIn, sort, page,
    perPage: 10,
  }
  const results = search(filters)
  return c.render(
    <SearchPage filters={filters} results={results} />,
    { title: q ? `البحث عن: ${q}` : 'البحث المتقدم' } as any,
  )
})

app.get('/ayah/:surah/:ayah', c => {
  const surah = parseIntSafe(c.req.param('surah')) || 0
  const ayah = parseIntSafe(c.req.param('ayah')) || 0
  const q = c.req.query('q') || ''
  const surahData = getSurahByNumber(surah)
  return c.render(
    <AyahPage surah={surah} ayah={ayah} q={q} />,
    {
      title: surahData ? `سورة ${surahData.name} - آية ${ayah}` : 'الآية',
      description: surahData ? `تفسير الآية ${ayah} من سورة ${surahData.name} من عدة كتب تفسير.` : undefined,
    } as any,
  )
})

app.get('/books', c => {
  const q = c.req.query('q') || ''
  const school = c.req.query('school') || ''
  const sort = c.req.query('sort') || 'popular'
  return c.render(<BooksPage q={q} school={school} sort={sort} />, { title: 'كتب التفسير' } as any)
})
app.get('/books/:id', c => {
  const id = c.req.param('id')
  const book = BOOKS.find(b => b.id === id)
  return c.render(
    <BookDetailPage bookId={id} />,
    { title: book ? book.title : 'كتاب' } as any,
  )
})

app.get('/authors', c => {
  const q = c.req.query('q') || ''
  const sort = c.req.query('sort') || 'oldest'
  return c.render(<AuthorsPage q={q} sort={sort} />, { title: 'المؤلفون' } as any)
})
app.get('/authors/:id', c => {
  const id = c.req.param('id')
  const a = AUTHORS.find(x => x.id === id)
  return c.render(<AuthorDetailPage authorId={id} />, { title: a ? a.name : 'مؤلف' } as any)
})

app.get('/compare', c => {
  const surah = parseIntSafe(c.req.query('surah'))
  const ayah = parseIntSafe(c.req.query('ayah'))
  const bookIds = parseArrayParam(c, 'bookIds')
  return c.render(
    <ComparePage surah={surah} ayah={ayah} bookIds={bookIds} />,
    { title: 'المقارنة بين التفاسير' } as any,
  )
})

app.get('/categories', c => c.render(<CategoriesPage />, { title: 'البحث الموضوعي' } as any))
app.get('/categories/:id', c => {
  const id = c.req.param('id')
  const cat = CATEGORIES.find(x => x.id === id)
  return c.render(<CategoryDetailPage id={id} />, { title: cat ? cat.name : 'موضوع' } as any)
})

app.get('/surahs', c => {
  const q = c.req.query('q') || ''
  const type = c.req.query('type') || ''
  return c.render(<SurahsPage q={q} type={type} />, { title: 'سور القرآن' } as any)
})
app.get('/surahs/:n', c => {
  const n = parseIntSafe(c.req.param('n')) || 0
  const s = getSurahByNumber(n)
  return c.render(
    <SurahDetailPage surahNumber={n} />,
    { title: s ? `سورة ${s.name}` : 'سورة' } as any,
  )
})

app.get('/about', c => c.render(<AboutPage />, { title: 'عن التطبيق' } as any))

app.get('/bookmarks', c => c.render(
  <BookmarksPage />,
  {
    title: 'المفضلة',
    description: 'الآيات التي حفظتها للمراجعة لاحقًا. تُخزَّن محليًا في متصفّحك فقط.',
  } as any,
))

app.get('/history', c => c.render(
  <HistoryPage />,
  {
    title: 'سجل التصفح',
    description: 'آخر الآيات التي تصفّحتها مؤخرًا. يُخزَّن محليًا في متصفّحك فقط.',
  } as any,
))

app.get('/dashboard', c => c.render(
  <DashboardPage />,
  {
    title: 'لوحة الإحصاءات',
    description: 'نظرة شاملة على محتوى التطبيق: الكتب، المؤلفون، المدارس التفسيرية، توزيع القرون، والسور الأكثر تغطية.',
  } as any,
))

// ============== JSON API ==============
app.get('/api/stats', c => c.json({ ok: true, data: getStats() }))
app.get('/api/stats/detailed', c => c.json({ ok: true, data: getDetailedStats() }))

// ============== JSON Export Endpoints ==============
function jsonExport(c: any, filename: string, payload: any) {
  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="${filename}"`)
  c.header('Cache-Control', 'no-store')
  return c.body(JSON.stringify(payload, null, 2))
}
app.get('/api/export/all', c => jsonExport(c, 'tafseer-all.json', {
  exportedAt: new Date().toISOString(),
  surahs: SURAHS,
  books: BOOKS,
  authors: AUTHORS,
  categories: CATEGORIES,
  ayahs: AYAHS,
  tafseers: TAFSEERS,
  stats: getStats(),
}))
app.get('/api/export/books', c => jsonExport(c, 'tafseer-books.json', BOOKS))
app.get('/api/export/authors', c => jsonExport(c, 'tafseer-authors.json', AUTHORS))
app.get('/api/export/surahs', c => jsonExport(c, 'tafseer-surahs.json', SURAHS))
app.get('/api/export/ayahs', c => jsonExport(c, 'tafseer-ayahs.json', AYAHS))
app.get('/api/export/tafseers', c => jsonExport(c, 'tafseer-tafseers.json', TAFSEERS))
app.get('/api/export/categories', c => jsonExport(c, 'tafseer-categories.json', CATEGORIES))
app.get('/api/surahs', c => c.json({ ok: true, data: SURAHS }))
app.get('/api/surahs/:n', c => {
  const n = parseIntSafe(c.req.param('n')) || 0
  const s = getSurahByNumber(n)
  if (!s) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json({ ok: true, data: s })
})
app.get('/api/books', c => c.json({ ok: true, data: BOOKS }))
app.get('/api/books/:id', c => {
  const b = BOOKS.find(x => x.id === c.req.param('id'))
  if (!b) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json({ ok: true, data: b })
})
app.get('/api/authors', c => c.json({ ok: true, data: AUTHORS }))
app.get('/api/authors/:id', c => {
  const a = AUTHORS.find(x => x.id === c.req.param('id'))
  if (!a) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json({ ok: true, data: a })
})
app.get('/api/categories', c => c.json({ ok: true, data: CATEGORIES }))
app.get('/api/ayah/:surah/:ayah', c => {
  const surah = parseIntSafe(c.req.param('surah')) || 0
  const ayah = parseIntSafe(c.req.param('ayah')) || 0
  const a = getAyah(surah, ayah)
  const tafseers = getTafseersByAyah(surah, ayah)
  return c.json({ ok: true, data: { ayah: a, tafseers } })
})

app.get('/api/suggest', c => {
  const q = c.req.query('q') || ''
  if (q.length > 80) return c.json({ ok: false, error: 'query_too_long' }, 400)
  const limit = Math.min(20, Math.max(1, parseIntSafe(c.req.query('limit')) || 10))
  const items = suggest(q, limit)
  c.header('Cache-Control', 'public, max-age=60')
  return c.json({ ok: true, data: { q, items } })
})

app.get('/api/search', c => {
  const q = c.req.query('q') || ''
  if (q.length > 200) return c.json({ ok: false, error: 'query_too_long' }, 400)
  const surah = parseIntSafe(c.req.query('surah'))
  const filters: SearchFilters = {
    q, surah,
    ayahFrom: parseIntSafe(c.req.query('ayahFrom')),
    ayahTo: parseIntSafe(c.req.query('ayahTo')),
    bookIds: parseArrayParam(c, 'bookIds'),
    authorIds: parseArrayParam(c, 'authorIds'),
    schools: parseArrayParam(c, 'schools') as TafseerSchool[],
    centuryFrom: parseIntSafe(c.req.query('centuryFrom')),
    centuryTo: parseIntSafe(c.req.query('centuryTo')),
    exactMatch: c.req.query('exactMatch') === '1',
    fuzzy: c.req.query('fuzzy') === '1',
    searchIn: (c.req.query('searchIn') || 'all') as any,
    sort: (c.req.query('sort') || 'relevance') as any,
    page: parseIntSafe(c.req.query('page')) || 1,
    perPage: parseIntSafe(c.req.query('perPage')) || 10,
  }
  return c.json({ ok: true, data: search(filters) })
})

// ============== PWA Manifest ==============
app.get('/manifest.json', c => {
  return c.json({
    name: 'تفسير - البحث في كتب تفسير القرآن',
    short_name: 'تفسير',
    description: 'تطبيق ويب علمي متقدم للبحث في كتب التفسير',
    start_url: '/',
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
    categories: ['education', 'books', 'reference'],
  })
})

// robots.txt + sitemap
app.get('/robots.txt', c => {
  return c.text(
    `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', c.req.url).toString()}\n`,
  )
})
app.get('/sitemap.xml', c => {
  const base = new URL('/', c.req.url).toString().replace(/\/$/, '')
  const urls: string[] = [
    '/', '/search', '/books', '/authors', '/categories', '/compare', '/surahs', '/about',
    ...BOOKS.map(b => `/books/${b.id}`),
    ...AUTHORS.map(a => `/authors/${a.id}`),
    ...CATEGORIES.map(c2 => `/categories/${c2.id}`),
    ...SURAHS.map(s => `/surahs/${s.number}`),
    ...AYAHS.map(a => `/ayah/${a.surah}/${a.number}`),
  ]
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${base}${u}</loc></url>`).join('\n') +
    `\n</urlset>`
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' })
})

// 404
app.notFound(c => {
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

// Error handler
app.onError((err, c) => {
  console.error('App error:', err)
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
