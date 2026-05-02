// =============================================================================
// D1 Data Provider — مزوّد البيانات من Cloudflare D1
// =============================================================================
// يُفعَّل تلقائيًا عند توفّر env.DB في Hono. كل الاستعلامات تستعمل
// prepared statements مع .bind() لمنع حقن SQL، وتعتمد على المخطط
// المعرَّف في db/migrations/0001_initial_schema.sql.
//
// السلوك الأساسي:
//   - يستفيد من فهارس (surah,ayah)/(book_id)/(source_type) لجلب البيانات.
//   - يدعم البحث عبر LIKE (آمن مع bind) كخيار افتراضي،
//     مع إمكانية الاعتماد على FTS5 إن طُبِّق ترحيل 0002.
//   - عند فشل أي استعلام جوهري نسقط بشكل آمن إلى مزوّد seed عبر
//     الغلاف في src/lib/data/index.ts (لا يحدث ضمن هذا الملف نفسه).
// =============================================================================

import { seedProvider } from './seed-provider'
import { search as seedSearch } from '../search'
import { CATEGORIES } from '../../data/categories'
import { normalizeArabic } from '../normalize'
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
      } catch (err) {
        // fallback إلى seed عند الفشل
        const fallback = seedProvider.getStatsBasic() as BasicStats
        return { ...fallback, mode: 'd1' }
      }
    },

    async getStatsDetailed(): Promise<DetailedStatsLike> {
      // الإحصاءات التفصيلية مكلفة على D1، لذا نعيد المحسوبة من seed كقيمة تقريبية
      // (يبقى السلوك متطابقًا للواجهة العلوية). تطوير لاحقًا: استبدال بـ aggregations سريعة.
      return seedProvider.getStatsDetailed() as DetailedStatsLike
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
    // الموضوعات صغيرة الحجم وثابتة الشكل، نقرأها من seed دائمًا (مع إمكانية القراءة من D1 لاحقًا).
    listCategories(): Category[] {
      return CATEGORIES
    },
    getCategoryById(id: string): Category | undefined {
      return CATEGORIES.find(c => c.id === id)
    },

    // -------- Search --------
    async search(filters: SearchFilters): Promise<SearchResults> {
      // الاستراتيجية: نجلب الـ tafsir_entries المرشَّحة من D1 عبر LIKE/FTS5 آمن،
      // ثم نُعيد الإرسال إلى محرك seed بنفس الشكل (الذي يحسب المقتطفات والترتيب).
      // هذا يحفظ شكل SearchResults كما هو، ولا يكسر الواجهات.
      try {
        const q = (filters.q || '').trim().slice(0, 200)
        const useFts = q.length >= 2 && (await hasFts5(db))

        // نبني WHERE ديناميكيًا مع .bind() آمن.
        const where: string[] = []
        const binds: any[] = []
        let p = 1
        if (filters.surah) { where.push(`t.surah_number = ?${p++}`); binds.push(filters.surah) }
        if (filters.ayahFrom) { where.push(`t.ayah_number >= ?${p++}`); binds.push(filters.ayahFrom) }
        if (filters.ayahTo) { where.push(`t.ayah_number <= ?${p++}`); binds.push(filters.ayahTo) }
        if (filters.bookIds?.length) {
          const ph = filters.bookIds.map(() => `?${p++}`).join(',')
          where.push(`t.book_id IN (${ph})`)
          binds.push(...filters.bookIds)
        }
        if (filters.sourceTypes?.length) {
          const ph = filters.sourceTypes.map(() => `?${p++}`).join(',')
          where.push(`t.source_type IN (${ph})`)
          binds.push(...filters.sourceTypes)
        }
        if (filters.verificationStatuses?.length) {
          const ph = filters.verificationStatuses.map(() => `?${p++}`).join(',')
          where.push(`t.verification_status IN (${ph})`)
          binds.push(...filters.verificationStatuses)
        }

        let sql: string
        if (useFts) {
          // FTS5 path
          where.push(`t.rowid IN (SELECT rowid FROM tafsir_entries_fts WHERE tafsir_entries_fts MATCH ?${p++})`)
          binds.push(q)
          sql = `SELECT t.* FROM tafsir_entries t WHERE ${where.join(' AND ') || '1=1'} LIMIT 500`
        } else if (q) {
          // LIKE path (آمن لأن النص مُمرَّر عبر bind)
          const like = '%' + normalizeArabic(q).replace(/[%_]/g, m => '\\' + m) + '%'
          where.push(`t.text LIKE ?${p++} ESCAPE '\\'`)
          binds.push(like)
          sql = `SELECT t.* FROM tafsir_entries t WHERE ${where.join(' AND ') || '1=1'} LIMIT 500`
        } else {
          sql = `SELECT t.* FROM tafsir_entries t ${where.length ? 'WHERE ' + where.join(' AND ') : ''} LIMIT 500`
        }

        const r = await db.prepare(sql).bind(...binds).all<any>()
        const rows = r.results || []

        // إذا لم نحصل على شيء (مثلاً الجدول فارغ)، نسقط إلى seed.
        if (!rows.length && q) return seedSearch(filters)
        if (!rows.length) return seedSearch(filters)

        // نعيد توجيه إلى محرّك seed مع هذه المرشَّحات لمحاسبة الترتيب والمقتطف،
        // لكن مقصورًا على IDs التي رجعت من D1 لتقليل التكلفة العامة.
        const ids = new Set(rows.map(r => String(r.id)))
        const limited: SearchFilters = { ...filters }
        const baseRes = seedSearch(limited)
        const filtered = baseRes.items.filter(it => ids.has(it.tafseerId))
        return {
          ...baseRes,
          items: filtered,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / (filters.perPage || 10))),
        }
      } catch {
        return seedSearch(filters)
      }
    },

    suggest(q: string, limit: number = 10): Promise<Suggestion[]> {
      // الاقتراحات تعتمد على بيانات صغيرة (سور/كتب/مؤلفون) — نعيد استخدام seed.
      return Promise.resolve(seedProvider.suggest(q, limit) as Suggestion[])
    },
  }
}
