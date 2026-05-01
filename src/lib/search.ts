// محرك البحث المركزي - يعالج كل أنواع البحث
import { AYAHS } from '../data/ayahs'
import { SURAHS } from '../data/surahs'
import { BOOKS, type TafseerSchool } from '../data/books'
import { AUTHORS } from '../data/authors'
import { TAFSEERS } from '../data/tafseers'
import { normalizeArabic, fuzzyMatch } from './normalize'

export interface SearchFilters {
  q?: string
  surah?: number
  ayahFrom?: number
  ayahTo?: number
  bookIds?: string[]
  authorIds?: string[]
  schools?: TafseerSchool[]
  centuryFrom?: number
  centuryTo?: number
  exactMatch?: boolean
  fuzzy?: boolean
  searchIn?: 'tafseer' | 'ayah' | 'all'
  sort?: 'relevance' | 'oldest' | 'newest' | 'book' | 'author'
  page?: number
  perPage?: number
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
