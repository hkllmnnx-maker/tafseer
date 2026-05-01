// Helpers to compute Quran coverage statistics — what verses exist in the dataset
// versus the canonical 114 surahs / total ayah counts.
import { SURAHS, getSurahByNumber } from '../data/surahs'
import { AYAHS } from '../data/ayahs'
import { TAFSEERS } from '../data/tafseers'

export interface SurahCoverage {
  surahNumber: number
  surahName: string
  totalAyahs: number       // canonical (from SURAHS table)
  availableAyahs: number   // present in AYAHS dataset
  ayahsWithTafseer: number // present in TAFSEERS dataset
  tafseersCount: number    // total tafseer entries for this surah
  ayahCoveragePercent: number      // availableAyahs / totalAyahs
  tafseerCoveragePercent: number   // ayahsWithTafseer / totalAyahs
  completeness: 'complete' | 'partial' | 'minimal' | 'empty'
}

export interface OverallCoverage {
  totalSurahs: number
  surahsWithAyahs: number
  surahsWithTafseer: number
  totalCanonicalAyahs: number
  availableAyahs: number
  ayahsWithTafseer: number
  totalTafseerEntries: number
  ayahCoveragePercent: number
  tafseerCoveragePercent: number
}

const TOTAL_QURAN_AYAHS = SURAHS.reduce((sum, s) => sum + s.ayahCount, 0)

function classifyCompleteness(percent: number, available: number): SurahCoverage['completeness'] {
  if (available === 0) return 'empty'
  if (percent >= 95) return 'complete'
  if (percent >= 30) return 'partial'
  return 'minimal'
}

/** Quickly check whether an ayah exists in the dataset (canonical sense + indexed). */
export function ayahExistsInQuran(surah: number, ayah: number): boolean {
  const s = getSurahByNumber(surah)
  if (!s) return false
  return ayah >= 1 && ayah <= s.ayahCount
}

/** Whether the verse text is actually available in the AYAHS dataset. */
export function ayahHasText(surah: number, ayah: number): boolean {
  return AYAHS.some(a => a.surah === surah && a.number === ayah)
}

/** Whether at least one tafseer entry exists for this verse. */
export function ayahHasTafseer(surah: number, ayah: number): boolean {
  return TAFSEERS.some(t => t.surah === surah && t.ayah === ayah)
}

/** Coverage statistics for a single surah. */
export function getSurahCoverage(surahNumber: number): SurahCoverage | null {
  const s = getSurahByNumber(surahNumber)
  if (!s) return null
  const ayahsForSurah = AYAHS.filter(a => a.surah === surahNumber)
  const tafseerSet = new Set<number>()
  let tafseersCount = 0
  for (const t of TAFSEERS) {
    if (t.surah === surahNumber) {
      tafseerSet.add(t.ayah)
      tafseersCount++
    }
  }
  const availableAyahs = ayahsForSurah.length
  const ayahsWithTafseer = tafseerSet.size
  const ayahCoveragePercent = +((availableAyahs / s.ayahCount) * 100).toFixed(1)
  const tafseerCoveragePercent = +((ayahsWithTafseer / s.ayahCount) * 100).toFixed(1)
  return {
    surahNumber: s.number,
    surahName: s.name,
    totalAyahs: s.ayahCount,
    availableAyahs,
    ayahsWithTafseer,
    tafseersCount,
    ayahCoveragePercent,
    tafseerCoveragePercent,
    completeness: classifyCompleteness(ayahCoveragePercent, availableAyahs),
  }
}

/** Coverage for every surah (sorted by number). */
export function getAllSurahCoverages(): SurahCoverage[] {
  return SURAHS.map(s => getSurahCoverage(s.number)!).filter(Boolean)
}

/** Overall coverage of the dataset versus the canonical Qur'an. */
export function getOverallCoverage(): OverallCoverage {
  const surahsWithAyahs = new Set(AYAHS.map(a => a.surah)).size
  const tafseerKeys = new Set<string>()
  const surahsWithTafseer = new Set<number>()
  for (const t of TAFSEERS) {
    tafseerKeys.add(`${t.surah}:${t.ayah}`)
    surahsWithTafseer.add(t.surah)
  }
  const availableAyahs = AYAHS.length
  const ayahsWithTafseer = tafseerKeys.size
  return {
    totalSurahs: SURAHS.length,
    surahsWithAyahs,
    surahsWithTafseer: surahsWithTafseer.size,
    totalCanonicalAyahs: TOTAL_QURAN_AYAHS,
    availableAyahs,
    ayahsWithTafseer,
    totalTafseerEntries: TAFSEERS.length,
    ayahCoveragePercent: +((availableAyahs / TOTAL_QURAN_AYAHS) * 100).toFixed(2),
    tafseerCoveragePercent: +((ayahsWithTafseer / TOTAL_QURAN_AYAHS) * 100).toFixed(2),
  }
}

export function completenessLabel(c: SurahCoverage['completeness']): string {
  switch (c) {
    case 'complete': return 'مكتمل'
    case 'partial': return 'جزئي'
    case 'minimal': return 'محدود'
    case 'empty': return 'لا يوجد'
  }
}

export function completenessClass(c: SurahCoverage['completeness']): string {
  switch (c) {
    case 'complete': return 'cov-complete'
    case 'partial': return 'cov-partial'
    case 'minimal': return 'cov-minimal'
    case 'empty': return 'cov-empty'
  }
}
