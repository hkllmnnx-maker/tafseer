// =============================================================================
// Seed Data Provider — مزوّد البيانات المضمَّنة في الكود (src/data/*).
// =============================================================================
// هذا هو المزوّد الافتراضي الحالي. يقرأ من الذاكرة (TS arrays) ويعيد
// النتائج متزامنة. عقده يتطابق مع DataProvider بحيث يمكن استبداله لاحقًا
// بمزوّد D1 دون تغيير الطبقة العليا.
// =============================================================================

import { SURAHS, getSurahByNumber as _getSurahByNumber } from '../../data/surahs'
import { AYAHS, getAyah as _getAyah } from '../../data/ayahs'
import { AUTHORS } from '../../data/authors'
import { BOOKS } from '../../data/books'
import { CATEGORIES } from '../../data/categories'
import { TAFSEERS, getTafseersByAyah as _getTafseersByAyah } from '../../data/tafseers'
import {
  search as _search,
  suggest as _suggest,
  getDetailedStats as _getDetailedStats,
  type SearchFilters, type SearchResults, type Suggestion,
} from '../search'

import type {
  DataProvider, BasicStats, DetailedStatsLike,
  Surah, Ayah, TafseerBook, Author, Category, TafseerEntry,
  QuranCoverageSummary, ReadSurahPayload,
  BookDetailPayload, AuthorDetailPayload, SurahDetailPayload,
} from './types'

export const seedProvider: DataProvider = {
  name: 'seed',

  // ---- Stats ----
  getStatsBasic(): BasicStats {
    return {
      booksCount: BOOKS.length,
      authorsCount: AUTHORS.length,
      surahsCount: SURAHS.length,
      ayahsCount: AYAHS.length,
      tafseersCount: TAFSEERS.length,
      mode: 'seed',
    }
  },

  getStatsDetailed(): DetailedStatsLike {
    return _getDetailedStats() as DetailedStatsLike
  },

  // ---- Surahs ----
  listSurahs(): Surah[] { return SURAHS },
  getSurahByNumber(n: number): Surah | undefined { return _getSurahByNumber(n) },

  // ---- Ayahs ----
  getAyah(surah: number, ayah: number): Ayah | undefined {
    return _getAyah(surah, ayah)
  },
  listAyahsForSurah(surah: number): Ayah[] {
    return AYAHS.filter(a => a.surah === surah).sort((a, b) => a.number - b.number)
  },

  // ---- Tafseers ----
  getTafseersByAyah(surah: number, ayah: number): TafseerEntry[] {
    return _getTafseersByAyah(surah, ayah)
  },

  getTafseersForSurah(surah: number): TafseerEntry[] {
    return TAFSEERS
      .filter(t => t.surah === surah)
      .sort((a, b) => a.ayah - b.ayah || String(a.id).localeCompare(String(b.id)))
  },

  getReadSurahPayload(surah: number): ReadSurahPayload {
    const surahData = _getSurahByNumber(surah)
    const ayahs = AYAHS
      .filter(a => a.surah === surah)
      .sort((a, b) => a.number - b.number)
    const tafseersByAyah: Record<number, TafseerEntry[]> = {}
    for (const t of TAFSEERS) {
      if (t.surah !== surah) continue
      if (!tafseersByAyah[t.ayah]) tafseersByAyah[t.ayah] = []
      tafseersByAyah[t.ayah].push(t)
    }
    const coverage = (seedProvider.getQuranCoverageSummary?.() as QuranCoverageSummary | undefined)
    return {
      surah: surahData,
      ayahs,
      tafseersByAyah,
      coverage,
      isCompleteQuran: !!coverage?.isComplete,
      mode: 'seed',
    }
  },

  getQuranCoverageSummary(): QuranCoverageSummary {
    const ayahsCount = AYAHS.length
    const expectedAyahs = 6236 as const
    const surahsCount = SURAHS.length
    // احسب السور المغطّاة + الناقصة + الجزئية
    const coveredSet = new Set<number>(AYAHS.map(a => a.surah))
    const missingSurahs: number[] = []
    const partialSurahs: number[] = []
    for (const s of SURAHS) {
      const present = AYAHS.filter(a => a.surah === s.number).length
      if (present === 0) missingSurahs.push(s.number)
      else if (present < s.ayahCount) partialSurahs.push(s.number)
    }
    // hasSourceMetadata: في seed mode البيانات لا تتضمّن source_name حاليًا
    // (تُسجَّل بنية الآيات في src/data/ayahs.ts بدون مصدر مفصَّل)، فيكون false.
    const hasSourceMetadata = AYAHS.some((a: any) =>
      typeof a?.sourceName === 'string' && a.sourceName.trim().length > 0
    )
    return {
      ayahsCount,
      expectedAyahs,
      surahsCovered: coveredSet.size,
      surahsCount,
      missingSurahs,
      partialSurahs,
      hasSourceMetadata,
      isComplete: ayahsCount === expectedAyahs,
      coveragePercent: +((ayahsCount / expectedAyahs) * 100).toFixed(2),
      mode: 'seed',
    }
  },

  // ---- Books ----
  listBooks(): TafseerBook[] { return BOOKS },
  getBookById(id: string): TafseerBook | undefined {
    return BOOKS.find(b => b.id === id)
  },
  getBooksByAuthor(authorId: string): TafseerBook[] {
    if (!authorId || typeof authorId !== 'string') return []
    return BOOKS.filter(b => b.authorId === authorId)
  },
  getTafseerCountByBook(bookId: string): number {
    if (!bookId || typeof bookId !== 'string') return 0
    return TAFSEERS.filter(t => t.bookId === bookId).length
  },
  getBookDetailPayload(bookId: string): BookDetailPayload {
    const book = BOOKS.find(b => b.id === bookId)
    const author = book ? AUTHORS.find(a => a.id === book.authorId) : undefined
    const tafs = book ? TAFSEERS.filter(t => t.bookId === book.id) : []
    const sampleTafseers = tafs.slice(0, 8)
    const relatedBooks = author
      ? BOOKS.filter(b => b.authorId === author.id && b.id !== bookId)
      : []
    return {
      book,
      author,
      tafseersCount: tafs.length,
      sampleTafseers,
      relatedBooks,
      mode: 'seed',
    }
  },

  // ---- Authors ----
  listAuthors(): Author[] { return AUTHORS },
  getAuthorById(id: string): Author | undefined {
    return AUTHORS.find(a => a.id === id)
  },
  getTafseerCountByAuthor(authorId: string): number {
    if (!authorId || typeof authorId !== 'string') return 0
    // التفاسير لا تحوي author_id مباشرة في seed → نمرّ عبر الكتب.
    const bookIds = new Set(BOOKS.filter(b => b.authorId === authorId).map(b => b.id))
    return TAFSEERS.filter(t => bookIds.has(t.bookId)).length
  },
  getAuthorDetailPayload(authorId: string): AuthorDetailPayload {
    const author = AUTHORS.find(a => a.id === authorId)
    const books = author ? BOOKS.filter(b => b.authorId === author.id) : []
    const bookIds = new Set(books.map(b => b.id))
    const tafseersCount = TAFSEERS.filter(t => bookIds.has(t.bookId)).length
    return {
      author,
      books,
      tafseersCount,
      mode: 'seed',
    }
  },

  // ---- Surahs (detail) ----
  getSurahDetailPayload(surahNumber: number): SurahDetailPayload {
    const surah = _getSurahByNumber(surahNumber)
    const ayahs = AYAHS
      .filter(a => a.surah === surahNumber)
      .sort((a, b) => a.number - b.number)
    const tafseersByAyah: Record<number, number> = {}
    let total = 0
    for (const t of TAFSEERS) {
      if (t.surah !== surahNumber) continue
      tafseersByAyah[t.ayah] = (tafseersByAyah[t.ayah] || 0) + 1
      total++
    }
    return {
      surah,
      ayahs,
      tafseersByAyah,
      tafseersCount: total,
      mode: 'seed',
    }
  },

  // ---- Categories ----
  listCategories(): Category[] { return CATEGORIES },
  getCategoryById(id: string): Category | undefined {
    return CATEGORIES.find(c => c.id === id)
  },

  // ---- Search & Suggest ----
  search(filters: SearchFilters): SearchResults {
    return _search(filters)
  },
  suggest(q: string, limit: number = 10): Suggestion[] {
    return _suggest(q, limit)
  },
}
