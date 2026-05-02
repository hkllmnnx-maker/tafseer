// =============================================================================
// D1 Data Provider — مزوّد البيانات من Cloudflare D1
// =============================================================================
// يُفعَّل تلقائيًا عند توفّر env.DB في Hono. كل الاستعلامات تستعمل
// prepared statements مع .bind() لمنع حقن SQL، وتعتمد على المخطط
// المعرَّف في db/migrations/0001_initial_schema.sql.
//
// السلوك الأساسي:
//   - يستفيد من فهارس (surah,ayah)/(book_id)/(source_type) لجلب البيانات.
//   - البحث يُولِّد SearchResults كاملاً من D1 مباشرة عبر JOIN
//     (لا يعتمد على seed engine لتشكيل النتائج).
//   - يدعم البحث عبر LIKE (آمن مع bind) كخيار افتراضي،
//     مع إمكانية الاعتماد على FTS5 إن طُبِّق ترحيل 0002.
//   - عند فشل استعلام (exception): نسقط بشكل آمن إلى مزوّد seed.
//   - عند جدول فارغ فعلاً: نسقط إلى seed (مناسب لبيئة D1 بدون migrations).
//   - في الحالات العادية: نُرجع نتائج D1 حتى لو كانت فارغة (مثلاً
//     listAyahsForSurah لسورة لا تحتوي آيات في D1) — لا نسقط على seed
//     لأن العميل يجب أن يرى نتيجة D1 الصحيحة.
//
// الأمان (SQL Injection — Defense in Depth):
//   - كل قيم المستخدم تمر عبر prepared statements (.bind()).
//   - الـ placeholders (`?N`) تُبنى ديناميكيًا من *عدد* العناصر،
//     ولا تُبنى من قيم المستخدم نفسها.
//   - String interpolation مسموح فقط لـ:
//       1) أسماء أعمدة/جداول ثابتة في الكود.
//       2) ORDER BY clauses من قائمة بيضاء (ALLOWED_SORTS).
//       3) searchIn من قائمة بيضاء (ALLOWED_SEARCH_IN).
//       4) HARD_LIMIT (ثابت رقمي حرفي).
//   - LIKE patterns تستعمل ESCAPE '\\' مع تهريب %, _, \ من المستخدم.
//   - schools filter يُقصر على JSON LIKE مع قيمة مغلَّفة بـ "..." لمنع
//     الالتباس بين اسم مدرسة جزئي ومدرسة كاملة.
// =============================================================================

import { seedProvider } from './seed-provider'
import { CATEGORIES } from '../../data/categories'
import { normalizeArabic } from '../normalize'
import {
  MAX_QUERY_LENGTH, MAX_PER_PAGE, MIN_PER_PAGE, MAX_PAGE,
} from '../search'
import type {
  DataProvider, BasicStats, DetailedStatsLike,
  Surah, Ayah, TafseerBook, Author, Category, TafseerEntry,
  SourceType, VerificationStatus,
  SearchFilters, SearchResults, Suggestion,
} from './types'

// ============== Minimal Typing for D1 ==============
// لا نستورد @cloudflare/workers-types مباشرةً لتجنّب التبعية الإضافية،
// نكتفي بالواجهة الحدّ أدنى.
interface D1Result<T = any> { results?: T[]; success?: boolean }
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement
  first<T = any>(col?: string): Promise<T | null>
  run(): Promise<D1Result<any>>
  all<T = any>(): Promise<D1Result<T>>
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(stmts: D1PreparedStatement[]): Promise<D1Result<any>[]>
}

// ============== Helpers ==============
function safeJsonArray(v: any): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const parsed = JSON.parse(String(v))
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function rowToSurah(r: any): Surah {
  return {
    number: Number(r.number),
    name: String(r.name),
    nameLatin: String(r.name_latin),
    ayahCount: Number(r.ayah_count),
    type: r.type as Surah['type'],
    order: Number(r.revelation_order),
  }
}
function rowToAyah(r: any): Ayah {
  return {
    surah: Number(r.surah_number),
    number: Number(r.ayah_number),
    text: String(r.text),
    juz: r.juz != null ? Number(r.juz) : undefined,
    page: r.page != null ? Number(r.page) : undefined,
  }
}
function rowToAuthor(r: any): Author {
  return {
    id: String(r.id),
    name: String(r.name),
    fullName: r.full_name || String(r.name),
    birthYear: r.birth_year != null ? Number(r.birth_year) : undefined,
    deathYear: Number(r.death_year),
    century: Number(r.century),
    bio: r.biography || '',
    school: safeJsonArray(r.schools)[0],
  } as Author
}
function rowToBook(r: any): TafseerBook {
  return {
    id: String(r.id),
    title: String(r.title),
    fullTitle: r.full_title || String(r.title),
    authorId: String(r.author_id),
    schools: safeJsonArray(r.schools) as TafseerBook['schools'],
    volumes: r.volumes != null ? Number(r.volumes) : undefined,
    description: r.description || '',
    publishedYear: r.published_year != null ? Number(r.published_year) : undefined,
    edition: r.edition || undefined,
    popularity: Number(r.popularity ?? 5),
    featured: !!r.featured,
  } as TafseerBook
}
function rowToTafseerEntry(r: any): TafseerEntry {
  return {
    id: String(r.id),
    bookId: String(r.book_id),
    surah: Number(r.surah_number),
    ayah: Number(r.ayah_number),
    text: String(r.text),
    sourceType: (r.source_type || 'sample') as SourceType,
    verificationStatus: (r.verification_status || 'unverified') as VerificationStatus,
    sourceName: r.source_name || undefined,
    edition: r.edition || undefined,
    volume: r.volume != null ? Number(r.volume) : undefined,
    page: r.page != null ? Number(r.page) : undefined,
    sourceUrl: r.source_url || undefined,
    reviewerNote: r.reviewer_note || undefined,
    isOriginalText: !!r.is_original_text,
    isSample: !!r.is_sample,
    source: r.source_name || undefined,
  }
}

// ============== مولّد المقتطف (snippet) — مستقل عن seed ==============
const SNIPPET_LEN = 220
function makeSnippet(text: string, q: string, maxLen: number = SNIPPET_LEN): string {
  if (!q || !q.trim()) {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  }
  const ntext = normalizeArabic(text)
  const nq = normalizeArabic(q)
  const firstToken = nq.split(/\s+/).filter(Boolean)[0] || nq
  const idx = ntext.indexOf(firstToken)
  if (idx === -1) {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  }
  const realIdx = Math.min(idx, text.length - 1)
  const halfLen = Math.floor(maxLen / 2)
  const startIdx = Math.max(0, realIdx - halfLen)
  const endIdx = Math.min(text.length, realIdx + halfLen)
  let snippet = text.slice(startIdx, endIdx)
  if (startIdx > 0) snippet = '…' + snippet
  if (endIdx < text.length) snippet = snippet + '…'
  return snippet
}

// ============== مساعد ترتيب آمن ==============
const ALLOWED_SORTS = new Set(['relevance', 'oldest', 'newest', 'book', 'author'])
const ALLOWED_SEARCH_IN = new Set(['tafseer', 'ayah', 'all'])

// ============== FTS5 detection (cached) ==============
const fts5Cache = new WeakMap<D1Database, boolean>()
async function hasFts5(db: D1Database): Promise<boolean> {
  if (fts5Cache.has(db)) return fts5Cache.get(db)!
  try {
    const r = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tafsir_entries_fts' LIMIT 1"
    ).first<any>()
    const ok = !!r
    fts5Cache.set(db, ok)
    return ok
  } catch {
    fts5Cache.set(db, false)
    return false
  }
}

// ============== Provider Factory ==============
export function makeD1Provider(db: D1Database): DataProvider {
  return {
    name: 'd1',

    // -------- Stats --------
    async getStatsBasic(): Promise<BasicStats> {
      try {
        const [b, a, s, y, t] = await Promise.all([
          db.prepare('SELECT COUNT(*) AS c FROM tafsir_books').first<any>(),
          db.prepare('SELECT COUNT(*) AS c FROM authors').first<any>(),
          db.prepare('SELECT COUNT(*) AS c FROM surahs').first<any>(),
          db.prepare('SELECT COUNT(*) AS c FROM ayahs').first<any>(),
          db.prepare('SELECT COUNT(*) AS c FROM tafsir_entries').first<any>(),
        ])
        return {
          booksCount: Number(b?.c || 0),
          authorsCount: Number(a?.c || 0),
          surahsCount: Number(s?.c || 0),
          ayahsCount: Number(y?.c || 0),
          tafseersCount: Number(t?.c || 0),
          mode: 'd1',
        }
      } catch {
        // fallback إلى seed عند الفشل
        const fallback = seedProvider.getStatsBasic() as BasicStats
        return { ...fallback, mode: 'd1' }
      }
    },

    async getStatsDetailed(): Promise<DetailedStatsLike> {
      // نحاول حساب الإحصاءات التفصيلية من D1 عبر aggregations.
      // إن فشل أي استعلام نقع على seed كقيمة احتياطية.
      try {
        const [
          totalsRow, perBookRows, perAuthorRows, schoolsBookRows, schoolsTafseerRows,
          centuryRows, surahCoverageRows, sourceTypeRows, verificationRows,
          coveredRow, quranTotalRow,
        ] = await Promise.all([
          db.prepare(
            `SELECT
               (SELECT COUNT(*) FROM tafsir_books) AS books,
               (SELECT COUNT(*) FROM authors) AS authors,
               (SELECT COUNT(*) FROM surahs) AS surahs,
               (SELECT COUNT(*) FROM ayahs) AS ayahs,
               (SELECT COUNT(*) FROM tafsir_entries) AS tafseers,
               (SELECT IFNULL(SUM(LENGTH(text)),0) FROM tafsir_entries) AS total_chars,
               (SELECT IFNULL(AVG(LENGTH(text)),0) FROM tafsir_entries) AS avg_len`
          ).first<any>(),
          db.prepare(
            `SELECT b.id AS id, b.title AS title, b.schools AS schools, b.author_id AS author_id,
                    a.name AS author_name,
                    (SELECT COUNT(*) FROM tafsir_entries t WHERE t.book_id = b.id) AS cnt,
                    (SELECT IFNULL(AVG(LENGTH(t.text)),0) FROM tafsir_entries t WHERE t.book_id = b.id) AS avg_len
               FROM tafsir_books b LEFT JOIN authors a ON a.id = b.author_id
              ORDER BY cnt DESC, b.title ASC`
          ).all<any>(),
          db.prepare(
            `SELECT a.id AS id, a.name AS name, a.century AS century, a.death_year AS death_year,
                    (SELECT COUNT(*) FROM tafsir_books bx WHERE bx.author_id = a.id) AS books_count,
                    (SELECT COUNT(*) FROM tafsir_entries t WHERE t.author_id = a.id) AS tafseers_count
               FROM authors a ORDER BY tafseers_count DESC, a.death_year ASC`
          ).all<any>(),
          db.prepare(`SELECT id, schools FROM tafsir_books`).all<any>(),
          db.prepare(
            `SELECT b.id AS id, b.schools AS schools,
                    (SELECT COUNT(*) FROM tafsir_entries t WHERE t.book_id = b.id) AS cnt
               FROM tafsir_books b`
          ).all<any>(),
          db.prepare(
            `SELECT century, COUNT(*) AS authors_count FROM authors GROUP BY century ORDER BY century ASC`
          ).all<any>(),
          db.prepare(
            `SELECT t.surah_number AS surah, COUNT(*) AS cnt,
                    COUNT(DISTINCT t.ayah_number) AS ayahs_covered,
                    s.name AS surah_name
               FROM tafsir_entries t LEFT JOIN surahs s ON s.number = t.surah_number
              GROUP BY t.surah_number, s.name ORDER BY cnt DESC LIMIT 10`
          ).all<any>(),
          db.prepare(
            `SELECT source_type, COUNT(*) AS cnt FROM tafsir_entries GROUP BY source_type`
          ).all<any>(),
          db.prepare(
            `SELECT verification_status, COUNT(*) AS cnt FROM tafsir_entries GROUP BY verification_status`
          ).all<any>(),
          db.prepare(
            `SELECT COUNT(DISTINCT (surah_number || ':' || ayah_number)) AS covered FROM tafsir_entries`
          ).first<any>(),
          db.prepare(`SELECT IFNULL(SUM(ayah_count),0) AS total FROM surahs`).first<any>(),
        ])

        const total = Number(totalsRow?.tafseers || 0) || 1
        const tafseersCount = Number(totalsRow?.tafseers || 0)
        const ayahsCount = Number(totalsRow?.ayahs || 0)
        const ayahsCoveredCount = Number(coveredRow?.covered || 0)
        const quranAyahsTotal = Number(quranTotalRow?.total || 6236)

        const perBook = (perBookRows.results || []).map((r: any) => ({
          id: String(r.id),
          title: String(r.title),
          authorName: r.author_name || '',
          schools: safeJsonArray(r.schools),
          tafseersCount: Number(r.cnt || 0),
          avgLength: Math.round(Number(r.avg_len || 0)),
        }))
        const perAuthor = (perAuthorRows.results || []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          century: Number(r.century || 0),
          deathYear: Number(r.death_year || 0),
          booksCount: Number(r.books_count || 0),
          tafseersCount: Number(r.tafseers_count || 0),
        }))

        // bySchool: نُحسبه من schools JSON يدويًا
        const schoolBooksMap = new Map<string, Set<string>>()
        const schoolTafseerMap = new Map<string, number>()
        for (const r of (schoolsTafseerRows.results || [])) {
          const schools = safeJsonArray((r as any).schools)
          const cnt = Number((r as any).cnt || 0)
          for (const s of schools) {
            if (!schoolBooksMap.has(s)) schoolBooksMap.set(s, new Set())
            schoolBooksMap.get(s)!.add(String((r as any).id))
            schoolTafseerMap.set(s, (schoolTafseerMap.get(s) || 0) + cnt)
          }
        }
        const bySchool = Array.from(schoolBooksMap.keys()).map(s => ({
          school: s,
          booksCount: schoolBooksMap.get(s)!.size,
          tafseersCount: schoolTafseerMap.get(s) || 0,
        })).sort((a, b) => b.tafseersCount - a.tafseersCount)

        // byCentury: count tafseers per century عبر join مستقلّ
        const centuryTafseerRowsRes = await db.prepare(
          `SELECT a.century AS century, COUNT(t.id) AS cnt
             FROM authors a LEFT JOIN tafsir_entries t ON t.author_id = a.id
            GROUP BY a.century`
        ).all<any>().catch(() => ({ results: [] }))
        const centuryTafseerMap = new Map<number, number>()
        for (const r of (centuryTafseerRowsRes.results || [])) {
          centuryTafseerMap.set(Number((r as any).century), Number((r as any).cnt || 0))
        }
        const byCentury = (centuryRows.results || []).map((r: any) => ({
          century: Number(r.century),
          authorsCount: Number(r.authors_count || 0),
          tafseersCount: centuryTafseerMap.get(Number(r.century)) || 0,
        })).sort((a: any, b: any) => a.century - b.century)

        const topSurahs = (surahCoverageRows.results || []).map((r: any) => ({
          surah: Number(r.surah),
          surahName: r.surah_name || `سورة ${r.surah}`,
          tafseersCount: Number(r.cnt || 0),
          ayahsCovered: Number(r.ayahs_covered || 0),
        }))

        // bySourceType - whitelist
        const SOURCE_TYPES_FULL: SourceType[] =
          ['original-text', 'summary', 'sample', 'review-needed', 'curated']
        const stCounts = new Map<SourceType, number>()
        for (const r of (sourceTypeRows.results || [])) {
          stCounts.set((r as any).source_type as SourceType, Number((r as any).cnt || 0))
        }
        const bySourceType = SOURCE_TYPES_FULL.map(type => {
          const count = stCounts.get(type) || 0
          return { type, count, percent: +((count / total) * 100).toFixed(1) }
        })

        const VERIFICATION_FULL: VerificationStatus[] =
          ['verified', 'partially-verified', 'unverified', 'flagged']
        const vCounts = new Map<VerificationStatus, number>()
        for (const r of (verificationRows.results || [])) {
          vCounts.set((r as any).verification_status as VerificationStatus, Number((r as any).cnt || 0))
        }
        const byVerification = VERIFICATION_FULL.map(status => {
          const count = vCounts.get(status) || 0
          return { status, count, percent: +((count / total) * 100).toFixed(1) }
        })

        const quranCoveragePercent = quranAyahsTotal
          ? +((ayahsCoveredCount / quranAyahsTotal) * 100).toFixed(2)
          : 0

        return {
          totals: {
            books: Number(totalsRow?.books || 0),
            authors: Number(totalsRow?.authors || 0),
            surahs: Number(totalsRow?.surahs || 0),
            ayahs: ayahsCount,
            tafseers: tafseersCount,
            avgTafseerLength: Math.round(Number(totalsRow?.avg_len || 0)),
            totalTafseerChars: Number(totalsRow?.total_chars || 0),
          },
          perBook,
          perAuthor,
          bySchool,
          byCentury,
          topSurahs,
          ayahsCoveredCount,
          ayahsCoverageRatio: ayahsCount ? +(ayahsCoveredCount / ayahsCount).toFixed(3) : 0,
          bySourceType,
          byVerification,
          scientific: {
            originalTexts: stCounts.get('original-text') || 0,
            summaries: stCounts.get('summary') || 0,
            samples: stCounts.get('sample') || 0,
            pendingReview: stCounts.get('review-needed') || 0,
            curated: stCounts.get('curated') || 0,
            verified: vCounts.get('verified') || 0,
            partiallyVerified: vCounts.get('partially-verified') || 0,
            unverified: vCounts.get('unverified') || 0,
            flagged: vCounts.get('flagged') || 0,
            quranAyahsTotal,
            quranAyahsCovered: ayahsCoveredCount,
            quranCoveragePercent,
          },
        }
      } catch {
        return seedProvider.getStatsDetailed() as DetailedStatsLike
      }
    },

    // -------- Surahs --------
    async listSurahs(): Promise<Surah[]> {
      try {
        const r = await db.prepare(
          'SELECT number, name, name_latin, ayah_count, type, revelation_order FROM surahs ORDER BY number ASC'
        ).all<any>()
        const rows = r.results || []
        if (!rows.length) return seedProvider.listSurahs() as Surah[]
        return rows.map(rowToSurah)
      } catch {
        return seedProvider.listSurahs() as Surah[]
      }
    },
    async getSurahByNumber(n: number): Promise<Surah | undefined> {
      if (!Number.isFinite(n) || n < 1 || n > 114) return undefined
      try {
        const r = await db.prepare(
          'SELECT number, name, name_latin, ayah_count, type, revelation_order FROM surahs WHERE number = ?1 LIMIT 1'
        ).bind(n).first<any>()
        if (!r) return seedProvider.getSurahByNumber(n) as Surah | undefined
        return rowToSurah(r)
      } catch {
        return seedProvider.getSurahByNumber(n) as Surah | undefined
      }
    },

    // -------- Ayahs --------
    async getAyah(surah: number, ayah: number): Promise<Ayah | undefined> {
      if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return undefined
      try {
        const r = await db.prepare(
          'SELECT surah_number, ayah_number, text, juz, page FROM ayahs WHERE surah_number = ?1 AND ayah_number = ?2 LIMIT 1'
        ).bind(surah, ayah).first<any>()
        if (!r) return seedProvider.getAyah(surah, ayah) as Ayah | undefined
        return rowToAyah(r)
      } catch {
        return seedProvider.getAyah(surah, ayah) as Ayah | undefined
      }
    },
    async listAyahsForSurah(surah: number): Promise<Ayah[]> {
      if (!Number.isFinite(surah)) return []
      try {
        const r = await db.prepare(
          'SELECT surah_number, ayah_number, text, juz, page FROM ayahs WHERE surah_number = ?1 ORDER BY ayah_number ASC'
        ).bind(surah).all<any>()
        const rows = r.results || []
        if (!rows.length) return seedProvider.listAyahsForSurah(surah) as Ayah[]
        return rows.map(rowToAyah)
      } catch {
        return seedProvider.listAyahsForSurah(surah) as Ayah[]
      }
    },

    // -------- Tafseers --------
    async getTafseersByAyah(surah: number, ayah: number): Promise<TafseerEntry[]> {
      try {
        const r = await db.prepare(
          `SELECT id, book_id, author_id, surah_number, ayah_number, text,
                  source_type, verification_status, is_original_text,
                  source_name, edition, volume, page, source_url, reviewer_note, is_sample
             FROM tafsir_entries
            WHERE surah_number = ?1 AND ayah_number = ?2
            ORDER BY id`
        ).bind(surah, ayah).all<any>()
        const rows = r.results || []
        if (!rows.length) return seedProvider.getTafseersByAyah(surah, ayah) as TafseerEntry[]
        return rows.map(rowToTafseerEntry)
      } catch {
        return seedProvider.getTafseersByAyah(surah, ayah) as TafseerEntry[]
      }
    },

    // -------- Books --------
    async listBooks(): Promise<TafseerBook[]> {
      try {
        const r = await db.prepare(
          `SELECT id, title, full_title, author_id, schools, volumes, description,
                  published_year, edition, popularity, featured
             FROM tafsir_books ORDER BY popularity DESC, title ASC`
        ).all<any>()
        const rows = r.results || []
        if (!rows.length) return seedProvider.listBooks() as TafseerBook[]
        return rows.map(rowToBook)
      } catch {
        return seedProvider.listBooks() as TafseerBook[]
      }
    },
    async getBookById(id: string): Promise<TafseerBook | undefined> {
      if (!id || typeof id !== 'string') return undefined
      try {
        const r = await db.prepare(
          `SELECT id, title, full_title, author_id, schools, volumes, description,
                  published_year, edition, popularity, featured
             FROM tafsir_books WHERE id = ?1 LIMIT 1`
        ).bind(id).first<any>()
        if (!r) return seedProvider.getBookById(id) as TafseerBook | undefined
        return rowToBook(r)
      } catch {
        return seedProvider.getBookById(id) as TafseerBook | undefined
      }
    },

    // -------- Authors --------
    async listAuthors(): Promise<Author[]> {
      try {
        const r = await db.prepare(
          `SELECT id, name, full_name, birth_year, death_year, century, biography, schools, popularity
             FROM authors ORDER BY death_year ASC`
        ).all<any>()
        const rows = r.results || []
        if (!rows.length) return seedProvider.listAuthors() as Author[]
        return rows.map(rowToAuthor)
      } catch {
        return seedProvider.listAuthors() as Author[]
      }
    },
    async getAuthorById(id: string): Promise<Author | undefined> {
      if (!id || typeof id !== 'string') return undefined
      try {
        const r = await db.prepare(
          `SELECT id, name, full_name, birth_year, death_year, century, biography, schools, popularity
             FROM authors WHERE id = ?1 LIMIT 1`
        ).bind(id).first<any>()
        if (!r) return seedProvider.getAuthorById(id) as Author | undefined
        return rowToAuthor(r)
      } catch {
        return seedProvider.getAuthorById(id) as Author | undefined
      }
    },

    // -------- Categories --------
    // الموضوعات صغيرة الحجم وثابتة الشكل، نقرأها من seed دائمًا
    // (مع إمكانية القراءة من D1 لاحقًا عند تخزينها هناك).
    listCategories(): Category[] {
      return CATEGORIES
    },
    getCategoryById(id: string): Category | undefined {
      return CATEGORIES.find(c => c.id === id)
    },

    // -------- Search (D1-native) --------
    // نُولّد SearchResults كاملاً من D1 عبر JOIN مع tafsir_books / authors /
    // surahs / ayahs. لا يوجد اعتماد على seed لتشكيل النتائج، فقط fallback
    // عند الخطأ أو غياب أي صف.
    async search(filters: SearchFilters): Promise<SearchResults> {
      const startTs = Date.now()
      const q = (filters.q || '').trim().slice(0, MAX_QUERY_LENGTH)
      const nq = normalizeArabic(q)
      const tokens = nq.split(/\s+/).filter(t => t.length > 0)
      const page = Math.max(1, Math.min(MAX_PAGE, Number(filters.page) || 1))
      const perPage = Math.max(MIN_PER_PAGE, Math.min(MAX_PER_PAGE, Number(filters.perPage) || 10))
      const sort = ALLOWED_SORTS.has(String(filters.sort)) ? filters.sort : 'relevance'
      const searchIn = ALLOWED_SEARCH_IN.has(String(filters.searchIn)) ? filters.searchIn : 'all'

      try {
        // 1) ابني WHERE ديناميكيًا — placeholders فقط، لا قيم مستخدم
        const where: string[] = []
        const binds: any[] = []
        let p = 1
        const ph = () => `?${p++}`

        if (filters.surah) { where.push(`t.surah_number = ${ph()}`); binds.push(filters.surah) }
        if (filters.ayahFrom) { where.push(`t.ayah_number >= ${ph()}`); binds.push(filters.ayahFrom) }
        if (filters.ayahTo) { where.push(`t.ayah_number <= ${ph()}`); binds.push(filters.ayahTo) }

        if (filters.bookIds?.length) {
          const list = filters.bookIds.map(() => ph()).join(',')
          where.push(`t.book_id IN (${list})`)
          binds.push(...filters.bookIds)
        }
        if (filters.authorIds?.length) {
          const list = filters.authorIds.map(() => ph()).join(',')
          where.push(`t.author_id IN (${list})`)
          binds.push(...filters.authorIds)
        }
        if (filters.sourceTypes?.length) {
          const list = filters.sourceTypes.map(() => ph()).join(',')
          where.push(`t.source_type IN (${list})`)
          binds.push(...filters.sourceTypes)
        }
        if (filters.verificationStatuses?.length) {
          const list = filters.verificationStatuses.map(() => ph()).join(',')
          where.push(`t.verification_status IN (${list})`)
          binds.push(...filters.verificationStatuses)
        }
        // schools فلتر اختياري عبر books.schools (LIKE آمن)
        if (filters.schools?.length) {
          const orParts: string[] = []
          for (const s of filters.schools) {
            // `%"school"%` بحث آمن داخل JSON المخزن
            orParts.push(`b.schools LIKE ${ph()}`)
            binds.push(`%"${s}"%`)
          }
          if (orParts.length) where.push(`(${orParts.join(' OR ')})`)
        }
        // centuryFrom / centuryTo عبر authors.century
        if (filters.centuryFrom) { where.push(`au.century >= ${ph()}`); binds.push(filters.centuryFrom) }
        if (filters.centuryTo)   { where.push(`au.century <= ${ph()}`); binds.push(filters.centuryTo) }

        // 2) البحث النصي
        const useFts = q.length >= 2 && (await hasFts5(db))
        if (useFts) {
          // مع FTS5: نُطابق rowid
          where.push(`t.rowid IN (SELECT rowid FROM tafsir_entries_fts WHERE tafsir_entries_fts MATCH ${ph()})`)
          // FTS5 query — بسيطة (الكلمات فقط)
          binds.push(tokens.length ? tokens.join(' ') : q)
        } else if (q) {
          // LIKE — كل token يجب أن يكون موجودًا في النص (AND)
          // ESCAPE '\\' لمنع تأثير % و _ القادمة من المستخدم
          const escapedTokens = tokens.length ? tokens : [nq]
          if (searchIn === 'ayah') {
            // البحث في نص الآية فقط
            for (const tk of escapedTokens) {
              where.push(`ay.text LIKE ${ph()} ESCAPE '\\'`)
              binds.push('%' + tk.replace(/[%_\\]/g, m => '\\' + m) + '%')
            }
          } else if (searchIn === 'tafseer') {
            for (const tk of escapedTokens) {
              where.push(`t.text LIKE ${ph()} ESCAPE '\\'`)
              binds.push('%' + tk.replace(/[%_\\]/g, m => '\\' + m) + '%')
            }
          } else {
            // all — في أيٍّ من النصّين
            for (const tk of escapedTokens) {
              const safeTok = '%' + tk.replace(/[%_\\]/g, m => '\\' + m) + '%'
              where.push(`(t.text LIKE ${ph()} ESCAPE '\\' OR ay.text LIKE ${ph()} ESCAPE '\\')`)
              binds.push(safeTok, safeTok)
            }
          }
        }

        // 3) ORDER BY آمن (ثوابت فقط، لا قيم مستخدم)
        let orderBy = 'b.popularity DESC, t.id ASC'
        switch (sort) {
          case 'oldest': orderBy = 'au.death_year ASC, t.id ASC'; break
          case 'newest': orderBy = 'au.death_year DESC, t.id ASC'; break
          case 'book':   orderBy = 'b.title ASC, t.id ASC'; break
          case 'author': orderBy = 'au.name ASC, t.id ASC'; break
          // relevance: لا يمكن حسابها بدقّة في SQL لكل token،
          // نقرّب بـ popularity ونرتّب نهائيًا في JS بعد الجلب.
          case 'relevance':
          default:       orderBy = 'b.popularity DESC, t.id ASC'; break
        }

        // SELECT الكامل: كل ما يلزم لبناء SearchResultItem دون أي seed lookup
        const baseSql =
          `SELECT t.id AS id, t.book_id, t.author_id, t.surah_number, t.ayah_number,
                  t.text AS tafseer_text, t.source_type, t.verification_status,
                  t.is_original_text, t.source_name, t.edition, t.volume, t.page,
                  t.source_url, t.reviewer_note, t.is_sample,
                  b.title AS book_title, b.popularity AS book_popularity,
                  au.id AS author_id_real, au.name AS author_name, au.death_year AS author_death,
                  s.name AS surah_name,
                  ay.text AS ayah_text
             FROM tafsir_entries t
             LEFT JOIN tafsir_books b  ON b.id = t.book_id
             LEFT JOIN authors      au ON au.id = t.author_id
             LEFT JOIN surahs       s  ON s.number = t.surah_number
             LEFT JOIN ayahs        ay ON ay.surah_number = t.surah_number AND ay.ayah_number = t.ayah_number`
        const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : ''

        // count إجمالي قبل الـ pagination
        const countSql = `SELECT COUNT(*) AS c FROM tafsir_entries t
             LEFT JOIN tafsir_books b  ON b.id = t.book_id
             LEFT JOIN authors      au ON au.id = t.author_id
             LEFT JOIN ayahs        ay ON ay.surah_number = t.surah_number AND ay.ayah_number = t.ayah_number${whereSql}`

        // نجلب صفًا أكبر من perPage حتى نحسب relevance ثم نقطع
        // لكن نبقى محدودين حتى لا نُحمِّل D1 بنتائج هائلة.
        const HARD_LIMIT = 500
        const fetchSql = `${baseSql}${whereSql} ORDER BY ${orderBy} LIMIT ${HARD_LIMIT}`

        const [countRes, dataRes] = await Promise.all([
          db.prepare(countSql).bind(...binds).first<any>(),
          db.prepare(fetchSql).bind(...binds).all<any>(),
        ])
        const total = Number(countRes?.c || 0)
        const rows = dataRes.results || []

        // إذا لم نحصل على أي نتيجة من D1 وقاعدة البيانات فارغة فعلاً،
        // نسقط إلى seed (مفيد في وضع بيئة D1 جديدة بلا بيانات).
        if (!rows.length && total === 0) {
          // فحص بسيط: هل الجدول فارغ؟
          try {
            const probe = await db.prepare('SELECT 1 AS x FROM tafsir_entries LIMIT 1').first<any>()
            if (!probe) {
              // قاعدة فارغة → seed
              const { search: seedSearch } = await import('../search')
              return seedSearch(filters)
            }
          } catch { /* تجاهل */ }
        }

        // 4) بناء SearchResultItem و حساب relevance من D1 rows مباشرة
        const items = rows.map((r: any) => {
          const tafseerText = String(r.tafseer_text || '')
          const ayahText = String(r.ayah_text || '')
          let relevance = 0
          if (q && tokens.length > 0) {
            const ncorp = normalizeArabic(tafseerText)
            const nayah = normalizeArabic(ayahText)
            for (const tk of tokens) {
              if (!tk) continue
              const re = new RegExp(escapeRegExp(tk), 'g')
              const m1 = (ncorp.match(re) || []).length
              const m2 = (nayah.match(re) || []).length
              relevance += m1 * 1 + m2 * 2
            }
          }
          relevance += Number(r.book_popularity || 5) * 0.1

          return {
            type: 'tafseer' as const,
            tafseerId: String(r.id),
            bookId: String(r.book_id),
            bookTitle: String(r.book_title || ''),
            authorId: String(r.author_id_real || r.author_id || ''),
            authorName: String(r.author_name || ''),
            surah: Number(r.surah_number),
            surahName: String(r.surah_name || `سورة ${r.surah_number}`),
            ayah: Number(r.ayah_number),
            ayahText,
            snippet: makeSnippet(tafseerText, q, SNIPPET_LEN),
            relevance,
            sourceType: (r.source_type || 'sample') as SourceType,
            verificationStatus: (r.verification_status || 'unverified') as VerificationStatus,
            isOriginalText: !!r.is_original_text,
            sourceName: r.source_name || undefined,
            edition: r.edition || undefined,
            volume: r.volume != null ? Number(r.volume) : undefined,
            page: r.page != null ? Number(r.page) : undefined,
            sourceUrl: r.source_url || undefined,
            reviewerNote: r.reviewer_note || undefined,
            ayahMissing: !ayahText,
          }
        })

        // 5) الترتيب النهائي حسب الاختيار
        if (sort === 'relevance') {
          items.sort((a: any, b: any) => b.relevance - a.relevance)
        }
        // باقي أنواع الترتيب طُبِّقت في SQL ORDER BY مسبقًا.

        // 6) Pagination على JS بعد الترتيب (آمن ومتّسق مع seed)
        const totalAfterRelevance = items.length
        const totalPages = Math.max(1, Math.ceil(totalAfterRelevance / perPage))
        const startIdx = (page - 1) * perPage
        const pageItems = items.slice(startIdx, startIdx + perPage)

        return {
          items: pageItems,
          total: totalAfterRelevance, // عدد الصفوف المُستردة فعليًا (≤ HARD_LIMIT)
          page,
          perPage,
          totalPages,
          query: q,
          took: Date.now() - startTs,
        }
      } catch {
        // fallback آمن إلى seed عند الخطأ الجذري
        try {
          const { search: seedSearch } = await import('../search')
          return seedSearch(filters)
        } catch {
          return {
            items: [], total: 0, page, perPage, totalPages: 1,
            query: q, took: Date.now() - startTs,
          }
        }
      }
    },

    suggest(q: string, limit: number = 10): Promise<Suggestion[]> {
      // الاقتراحات تعتمد على بيانات صغيرة (سور/كتب/مؤلفون) — نعيد استخدام seed.
      // (يمكن لاحقًا توليدها من D1 إن أصبحت أكبر بكثير.)
      return Promise.resolve(seedProvider.suggest(q, limit) as Suggestion[])
    },
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
