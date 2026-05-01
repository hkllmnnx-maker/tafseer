// محرك البحث المركزي - يعالج كل أنواع البحث
import { AYAHS } from '../data/ayahs'
import { SURAHS } from '../data/surahs'
import { BOOKS, type TafseerSchool } from '../data/books'
import { AUTHORS } from '../data/authors'
import { TAFSEERS } from '../data/tafseers'
import { normalizeArabic, fuzzyMatch } from './normalize'
import {
  SOURCE_TYPES, VERIFICATION_STATUSES,
  type SourceType, type VerificationStatus,
} from './scientific'

// ============== Hard limits enforced by the search engine ==============
export const MAX_QUERY_LENGTH = 200
export const MAX_PER_PAGE = 50
export const MIN_PER_PAGE = 5
export const MAX_PAGE = 1000
const ALLOWED_SORTS = new Set(['relevance', 'oldest', 'newest', 'book', 'author'])
const ALLOWED_SEARCH_IN = new Set(['tafseer', 'ayah', 'all'])
const ALLOWED_SCHOOLS = new Set<TafseerSchool>([
  'بالمأثور', 'بالرأي', 'فقهي', 'لغوي', 'بلاغي', 'معاصر', 'ميسر', 'موسوعي',
])
const ALLOWED_SOURCE_TYPES = new Set<SourceType>(SOURCE_TYPES as readonly SourceType[])
const ALLOWED_VERIFICATION = new Set<VerificationStatus>(VERIFICATION_STATUSES as readonly VerificationStatus[])

export interface SearchFilters {
  q?: string
  surah?: number
  ayahFrom?: number
  ayahTo?: number
  bookIds?: string[]
  authorIds?: string[]
  schools?: TafseerSchool[]
  sourceTypes?: SourceType[]
  verificationStatuses?: VerificationStatus[]
  centuryFrom?: number
  centuryTo?: number
  exactMatch?: boolean
  fuzzy?: boolean
  searchIn?: 'tafseer' | 'ayah' | 'all'
  sort?: 'relevance' | 'oldest' | 'newest' | 'book' | 'author'
  page?: number
  perPage?: number
}

/** Strip / clamp filters into safe values. Always call this before passing to search(). */
export function sanitizeFilters(input: Partial<SearchFilters>): SearchFilters {
  const f: SearchFilters = {}
  f.q = (input.q || '').toString().slice(0, MAX_QUERY_LENGTH)
  f.surah = clampInt(input.surah, 1, 114)
  f.ayahFrom = clampInt(input.ayahFrom, 1, 286)
  f.ayahTo = clampInt(input.ayahTo, 1, 286)
  f.bookIds = uniqueStrings(input.bookIds, 30)
  f.authorIds = uniqueStrings(input.authorIds, 30)
  f.schools = (input.schools || []).filter(s => ALLOWED_SCHOOLS.has(s)) as TafseerSchool[]
  f.sourceTypes = (input.sourceTypes || []).filter(s => ALLOWED_SOURCE_TYPES.has(s as SourceType)) as SourceType[]
  f.verificationStatuses = (input.verificationStatuses || [])
    .filter(s => ALLOWED_VERIFICATION.has(s as VerificationStatus)) as VerificationStatus[]
  f.centuryFrom = clampInt(input.centuryFrom, 1, 15)
  f.centuryTo = clampInt(input.centuryTo, 1, 15)
  f.exactMatch = !!input.exactMatch
  f.fuzzy = !!input.fuzzy
  f.searchIn = ALLOWED_SEARCH_IN.has(input.searchIn as string) ? input.searchIn : 'all'
  f.sort = ALLOWED_SORTS.has(input.sort as string) ? input.sort : 'relevance'
  f.page = clampInt(input.page, 1, MAX_PAGE) || 1
  f.perPage = clampInt(input.perPage, MIN_PER_PAGE, MAX_PER_PAGE) || 10
  return f
}

function clampInt(v: any, min: number, max: number): number | undefined {
  if (v == null || v === '') return undefined
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return undefined
  if (n < min || n > max) return undefined
  return n
}
function uniqueStrings(arr: string[] | undefined, max: number): string[] {
  if (!arr || !arr.length) return []
  return Array.from(new Set(arr.filter(s => typeof s === 'string' && s.length > 0 && s.length < 64))).slice(0, max)
}

export interface SearchResultItem {
  type: 'tafseer'
  tafseerId: string
  bookId: string
  bookTitle: string
  authorId: string
  authorName: string
  surah: number
  surahName: string
  ayah: number
  ayahText: string
  snippet: string
  relevance: number
  // Scientific metadata propagated to the UI for badges
  sourceType: SourceType
  verificationStatus: VerificationStatus
  isOriginalText: boolean
  sourceName?: string
  edition?: string
  volume?: number
  page?: number
  sourceUrl?: string
  reviewerNote?: string
  ayahMissing?: boolean
}

export interface SearchResults {
  items: SearchResultItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
  query: string
  took: number
}

const SNIPPET_LEN = 220

export function search(filters: SearchFilters): SearchResults {
  const start = Date.now()
  const page = Math.max(1, filters.page || 1)
  const perPage = Math.min(50, Math.max(5, filters.perPage || 10))
  const q = (filters.q || '').trim()
  const nq = normalizeArabic(q)
  const tokens = nq.split(/\s+/).filter(t => t.length > 0)

  // فلترة المؤلفين حسب القرن
  let allowedAuthorIds = new Set<string>(
    AUTHORS.filter(a => {
      if (filters.centuryFrom && a.century < filters.centuryFrom) return false
      if (filters.centuryTo && a.century > filters.centuryTo) return false
      if (filters.authorIds?.length && !filters.authorIds.includes(a.id)) return false
      return true
    }).map(a => a.id),
  )

  // فلترة الكتب
  let allowedBookIds = new Set<string>(
    BOOKS.filter(b => {
      if (filters.bookIds?.length && !filters.bookIds.includes(b.id)) return false
      if (!allowedAuthorIds.has(b.authorId)) return false
      if (filters.schools?.length) {
        const intersect = b.schools.some(s => filters.schools!.includes(s))
        if (!intersect) return false
      }
      return true
    }).map(b => b.id),
  )

  // الفلترة على التفاسير
  let candidates = TAFSEERS.filter(t => {
    if (!allowedBookIds.has(t.bookId)) return false
    if (filters.surah && t.surah !== filters.surah) return false
    if (filters.ayahFrom && t.ayah < filters.ayahFrom) return false
    if (filters.ayahTo && t.ayah > filters.ayahTo) return false
    if (filters.sourceTypes?.length) {
      const st = (t.sourceType || 'sample') as SourceType
      if (!filters.sourceTypes.includes(st)) return false
    }
    if (filters.verificationStatuses?.length) {
      const vs = (t.verificationStatus || 'unverified') as VerificationStatus
      if (!filters.verificationStatuses.includes(vs)) return false
    }
    return true
  })

  // البحث النصي
  if (q && tokens.length > 0) {
    candidates = candidates.filter(t => {
      const ayah = AYAHS.find(a => a.surah === t.surah && a.number === t.ayah)
      const ayahText = ayah?.text || ''
      const corpus =
        filters.searchIn === 'ayah'
          ? ayahText
          : filters.searchIn === 'tafseer'
          ? t.text
          : `${ayahText} ${t.text}`
      const ncorp = normalizeArabic(corpus)

      if (filters.exactMatch) {
        return ncorp.includes(nq)
      }
      if (filters.fuzzy) {
        return fuzzyMatch(corpus, q)
      }
      // كل التوكنز يجب أن تكون موجودة
      return tokens.every(tk => ncorp.includes(tk))
    })
  }

  // التحويل إلى نتائج مع حساب الصلة
  const items: SearchResultItem[] = candidates.map(t => {
    const surah = SURAHS.find(s => s.number === t.surah)!
    const book = BOOKS.find(b => b.id === t.bookId)!
    const author = AUTHORS.find(a => a.id === book.authorId)!
    const ayahObj = AYAHS.find(a => a.surah === t.surah && a.number === t.ayah)
    const ayahText = ayahObj?.text || ''

    // حساب الصلة - مقدار التطابق
    let relevance = 0
    if (q && tokens.length > 0) {
      const ncorp = normalizeArabic(t.text)
      const nayah = normalizeArabic(ayahText)
      tokens.forEach(tk => {
        const matches = (ncorp.match(new RegExp(escapeRegExp(tk), 'g')) || []).length
        const ayahMatches = (nayah.match(new RegExp(escapeRegExp(tk), 'g')) || []).length
        relevance += matches * 1 + ayahMatches * 2
      })
    }
    relevance += book.popularity * 0.1

    return {
      type: 'tafseer' as const,
      tafseerId: t.id,
      bookId: t.bookId,
      bookTitle: book.title,
      authorId: author.id,
      authorName: author.name,
      surah: t.surah,
      surahName: surah.name,
      ayah: t.ayah,
      ayahText,
      snippet: makeSnippet(t.text, q, SNIPPET_LEN),
      relevance,
      sourceType: (t.sourceType || 'sample') as SourceType,
      verificationStatus: (t.verificationStatus || 'unverified') as VerificationStatus,
      isOriginalText: !!t.isOriginalText,
      sourceName: t.sourceName || t.source,
      edition: t.edition,
      volume: t.volume,
      page: t.page,
      sourceUrl: t.sourceUrl,
      reviewerNote: t.reviewerNote,
      ayahMissing: !ayahObj,
    }
  })

  // الترتيب
  switch (filters.sort) {
    case 'oldest':
      items.sort((a, b) => {
        const aa = AUTHORS.find(x => x.id === a.authorId)?.deathYear || 0
        const bb = AUTHORS.find(x => x.id === b.authorId)?.deathYear || 0
        return aa - bb
      })
      break
    case 'newest':
      items.sort((a, b) => {
        const aa = AUTHORS.find(x => x.id === a.authorId)?.deathYear || 0
        const bb = AUTHORS.find(x => x.id === b.authorId)?.deathYear || 0
        return bb - aa
      })
      break
    case 'book':
      items.sort((a, b) => a.bookTitle.localeCompare(b.bookTitle, 'ar'))
      break
    case 'author':
      items.sort((a, b) => a.authorName.localeCompare(b.authorName, 'ar'))
      break
    case 'relevance':
    default:
      items.sort((a, b) => b.relevance - a.relevance)
      break
  }

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const startIdx = (page - 1) * perPage
  const pageItems = items.slice(startIdx, startIdx + perPage)

  return {
    items: pageItems,
    total,
    page,
    perPage,
    totalPages,
    query: q,
    took: Date.now() - start,
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function makeSnippet(text: string, q: string, maxLen: number): string {
  if (!q || !q.trim()) {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  }
  const ntext = normalizeArabic(text)
  const nq = normalizeArabic(q)
  const idx = ntext.indexOf(nq.split(/\s+/)[0])
  if (idx === -1) {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  }
  // تقريب الفهرس بين النص المطبع والأصلي تقريبًا
  const realIdx = Math.min(idx, text.length - 1)
  const halfLen = Math.floor(maxLen / 2)
  const startIdx = Math.max(0, realIdx - halfLen)
  const endIdx = Math.min(text.length, realIdx + halfLen)
  let snippet = text.slice(startIdx, endIdx)
  if (startIdx > 0) snippet = '…' + snippet
  if (endIdx < text.length) snippet = snippet + '…'
  return snippet
}

// إحصاءات عامة
export function getStats() {
  return {
    booksCount: BOOKS.length,
    authorsCount: AUTHORS.length,
    surahsCount: SURAHS.length,
    ayahsCount: AYAHS.length,
    tafseersCount: TAFSEERS.length,
  }
}

// ============== إحصاءات تفصيلية (لوحة المعلومات) ==============
export interface DetailedStats {
  totals: {
    books: number
    authors: number
    surahs: number
    ayahs: number
    tafseers: number
    avgTafseerLength: number
    totalTafseerChars: number
  }
  perBook: Array<{
    id: string
    title: string
    authorName: string
    schools: string[]
    tafseersCount: number
    avgLength: number
  }>
  perAuthor: Array<{
    id: string
    name: string
    century: number
    deathYear: number
    booksCount: number
    tafseersCount: number
  }>
  bySchool: Array<{ school: string; booksCount: number; tafseersCount: number }>
  byCentury: Array<{ century: number; authorsCount: number; tafseersCount: number }>
  topSurahs: Array<{ surah: number; surahName: string; tafseersCount: number; ayahsCovered: number }>
  ayahsCoveredCount: number
  ayahsCoverageRatio: number
}

export function getDetailedStats(): DetailedStats {
  // perBook
  const tafseerCountByBook = new Map<string, number>()
  const tafseerLenByBook = new Map<string, number>()
  let totalChars = 0
  for (const t of TAFSEERS) {
    tafseerCountByBook.set(t.bookId, (tafseerCountByBook.get(t.bookId) || 0) + 1)
    tafseerLenByBook.set(t.bookId, (tafseerLenByBook.get(t.bookId) || 0) + t.text.length)
    totalChars += t.text.length
  }
  const perBook = BOOKS.map(b => {
    const author = AUTHORS.find(a => a.id === b.authorId)
    const cnt = tafseerCountByBook.get(b.id) || 0
    const totalLen = tafseerLenByBook.get(b.id) || 0
    return {
      id: b.id,
      title: b.title,
      authorName: author?.name || '',
      schools: b.schools,
      tafseersCount: cnt,
      avgLength: cnt ? Math.round(totalLen / cnt) : 0,
    }
  }).sort((a, b) => b.tafseersCount - a.tafseersCount)

  // perAuthor
  const booksByAuthor = new Map<string, string[]>()
  for (const b of BOOKS) {
    if (!booksByAuthor.has(b.authorId)) booksByAuthor.set(b.authorId, [])
    booksByAuthor.get(b.authorId)!.push(b.id)
  }
  const perAuthor = AUTHORS.map(a => {
    const bookIds = booksByAuthor.get(a.id) || []
    const tCount = bookIds.reduce((sum, id) => sum + (tafseerCountByBook.get(id) || 0), 0)
    return {
      id: a.id,
      name: a.name,
      century: a.century,
      deathYear: a.deathYear,
      booksCount: bookIds.length,
      tafseersCount: tCount,
    }
  }).sort((a, b) => b.tafseersCount - a.tafseersCount)

  // bySchool
  const schoolBooksMap = new Map<string, Set<string>>()
  const schoolTafseersMap = new Map<string, number>()
  for (const b of BOOKS) {
    const cnt = tafseerCountByBook.get(b.id) || 0
    for (const s of b.schools) {
      if (!schoolBooksMap.has(s)) schoolBooksMap.set(s, new Set())
      schoolBooksMap.get(s)!.add(b.id)
      schoolTafseersMap.set(s, (schoolTafseersMap.get(s) || 0) + cnt)
    }
  }
  const bySchool = Array.from(schoolBooksMap.keys()).map(s => ({
    school: s,
    booksCount: schoolBooksMap.get(s)!.size,
    tafseersCount: schoolTafseersMap.get(s) || 0,
  })).sort((a, b) => b.tafseersCount - a.tafseersCount)

  // byCentury
  const centuryAuthorMap = new Map<number, Set<string>>()
  const centuryTafseerMap = new Map<number, number>()
  for (const a of AUTHORS) {
    if (!centuryAuthorMap.has(a.century)) centuryAuthorMap.set(a.century, new Set())
    centuryAuthorMap.get(a.century)!.add(a.id)
    const bookIds = booksByAuthor.get(a.id) || []
    const tCount = bookIds.reduce((sum, id) => sum + (tafseerCountByBook.get(id) || 0), 0)
    centuryTafseerMap.set(a.century, (centuryTafseerMap.get(a.century) || 0) + tCount)
  }
  const byCentury = Array.from(centuryAuthorMap.keys()).map(c => ({
    century: c,
    authorsCount: centuryAuthorMap.get(c)!.size,
    tafseersCount: centuryTafseerMap.get(c) || 0,
  })).sort((a, b) => a.century - b.century)

  // topSurahs (most-covered)
  const surahTafseerMap = new Map<number, number>()
  const surahAyahsCovered = new Map<number, Set<number>>()
  for (const t of TAFSEERS) {
    surahTafseerMap.set(t.surah, (surahTafseerMap.get(t.surah) || 0) + 1)
    if (!surahAyahsCovered.has(t.surah)) surahAyahsCovered.set(t.surah, new Set())
    surahAyahsCovered.get(t.surah)!.add(t.ayah)
  }
  const topSurahs = Array.from(surahTafseerMap.keys()).map(num => {
    const surah = SURAHS.find(s => s.number === num)
    return {
      surah: num,
      surahName: surah?.name || `سورة ${num}`,
      tafseersCount: surahTafseerMap.get(num) || 0,
      ayahsCovered: surahAyahsCovered.get(num)?.size || 0,
    }
  }).sort((a, b) => b.tafseersCount - a.tafseersCount).slice(0, 10)

  // Ayahs coverage (unique surah:ayah pairs in TAFSEERS)
  const coveredPairs = new Set<string>()
  for (const t of TAFSEERS) coveredPairs.add(`${t.surah}:${t.ayah}`)
  const ayahsCoveredCount = coveredPairs.size

  return {
    totals: {
      books: BOOKS.length,
      authors: AUTHORS.length,
      surahs: SURAHS.length,
      ayahs: AYAHS.length,
      tafseers: TAFSEERS.length,
      avgTafseerLength: TAFSEERS.length ? Math.round(totalChars / TAFSEERS.length) : 0,
      totalTafseerChars: totalChars,
    },
    perBook,
    perAuthor,
    bySchool,
    byCentury,
    topSurahs,
    ayahsCoveredCount,
    ayahsCoverageRatio: AYAHS.length ? +(ayahsCoveredCount / AYAHS.length).toFixed(3) : 0,
  }
}

// ============== Suggestions (Autocomplete) ==============
export type SuggestionType = 'surah' | 'ayah' | 'book' | 'author' | 'category' | 'topic'
export interface Suggestion {
  type: SuggestionType
  label: string
  sub?: string
  href: string
  score: number
}

// أكثر الكلمات شعبية للبحث (Topics) - مخزّنة في الذاكرة
const POPULAR_TOPICS: { label: string; href: string }[] = [
  { label: 'الرحمن', href: '/search?q=الرحمن' },
  { label: 'الصلاة', href: '/search?q=الصلاة' },
  { label: 'التوحيد', href: '/search?q=التوحيد' },
  { label: 'الزكاة', href: '/search?q=الزكاة' },
  { label: 'الصيام', href: '/search?q=الصيام' },
  { label: 'التقوى', href: '/search?q=التقوى' },
  { label: 'الإيمان', href: '/search?q=الإيمان' },
  { label: 'الصبر', href: '/search?q=الصبر' },
  { label: 'الجنة', href: '/search?q=الجنة' },
  { label: 'النار', href: '/search?q=النار' },
  { label: 'البسملة', href: '/search?q=البسملة' },
  { label: 'آية الكرسي', href: '/ayah/2/255' },
]

export function suggest(q: string, limit: number = 10): Suggestion[] {
  const query = (q || '').trim()
  if (!query) return []
  if (query.length > 80) return []
  const nq = normalizeArabic(query)
  if (!nq) return []
  const results: Suggestion[] = []

  // 1) السور (مطابقة بداية الاسم أعلى وزن)
  for (const s of SURAHS) {
    const nname = normalizeArabic(s.name)
    if (nname.startsWith(nq)) {
      results.push({
        type: 'surah',
        label: `سورة ${s.name}`,
        sub: `${s.type} · ${s.ayahCount} آية`,
        href: `/surahs/${s.number}`,
        score: 100 + (10 - Math.min(10, Math.abs(nname.length - nq.length))),
      })
    } else if (nname.includes(nq)) {
      results.push({
        type: 'surah',
        label: `سورة ${s.name}`,
        sub: `${s.type} · ${s.ayahCount} آية`,
        href: `/surahs/${s.number}`,
        score: 70,
      })
    }
  }

  // 2) الكتب
  for (const b of BOOKS) {
    const ntitle = normalizeArabic(b.title)
    if (ntitle.includes(nq)) {
      results.push({
        type: 'book',
        label: b.title,
        sub: b.fullTitle,
        href: `/books/${b.id}`,
        score: 60 + b.popularity,
      })
    }
  }

  // 3) المؤلفون
  for (const a of AUTHORS) {
    const nname = normalizeArabic(a.name)
    const nfull = normalizeArabic(a.fullName || '')
    if (nname.includes(nq) || (nfull && nfull.includes(nq))) {
      results.push({
        type: 'author',
        label: a.name,
        sub: `ت ${a.deathYear}هـ${a.origin ? ' · ' + a.origin : ''}`,
        href: `/authors/${a.id}`,
        score: 50,
      })
    }
  }

  // 4) المواضيع الشائعة
  for (const t of POPULAR_TOPICS) {
    const nlabel = normalizeArabic(t.label)
    if (nlabel.startsWith(nq) || nlabel.includes(nq)) {
      results.push({
        type: 'topic',
        label: t.label,
        sub: 'موضوع شائع',
        href: t.href,
        score: nlabel.startsWith(nq) ? 85 : 65,
      })
    }
  }

  // 5) الآيات (مطابقة في النص) - حد أقصى 5 لتجنب الإغراق
  let ayahHits = 0
  for (const a of AYAHS) {
    if (ayahHits >= 5) break
    const ntext = normalizeArabic(a.text)
    if (ntext.includes(nq)) {
      const surah = SURAHS.find(s => s.number === a.surah)
      results.push({
        type: 'ayah',
        label: a.text.length > 60 ? a.text.slice(0, 60) + '…' : a.text,
        sub: surah ? `سورة ${surah.name} - آية ${a.number}` : `آية ${a.number}`,
        href: `/ayah/${a.surah}/${a.number}?q=${encodeURIComponent(query)}`,
        score: 40,
      })
      ayahHits++
    }
  }

  // 6) دائماً نضيف خيار "ابحث عن" كآخر اقتراح
  results.push({
    type: 'topic',
    label: `ابحث عن: «${query}»`,
    sub: 'في كل التفاسير والآيات',
    href: `/search?q=${encodeURIComponent(query)}`,
    score: 1,
  })

  // إزالة التكرار (نفس href)
  const seen = new Set<string>()
  const unique: Suggestion[] = []
  for (const r of results.sort((a, b) => b.score - a.score)) {
    if (seen.has(r.href)) continue
    seen.add(r.href)
    unique.push(r)
    if (unique.length >= limit) break
  }
  return unique
}
