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
    return { surah: surahData, ayahs, tafseersByAyah, mode: 'seed' }
  },

  getQuranCoverageSummary(): QuranCoverageSummary {
    const ayahsCount = AYAHS.length
    const surahsCovered = new Set(AYAHS.map(a => a.surah)).size
    const expectedAyahs = 6236 as const
    return {
      ayahsCount,
      expectedAyahs,
      surahsCovered,
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

  // ---- Authors ----
  listAuthors(): Author[] { return AUTHORS },
  getAuthorById(id: string): Author | undefined {
    return AUTHORS.find(a => a.id === id)
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
