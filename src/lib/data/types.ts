// =============================================================================
// Data Access Layer — Types (Unified DataProvider contract)
// =============================================================================
// هذا الملف يعرّف العقد (interface) الذي يجب أن يلتزم به أي مزوّد بيانات
// (seed أو D1). الهدف أن يصبح التبديل بين البيانات المضمَّنة (seed) وقاعدة
// Cloudflare D1 الفعلية شفافًا تمامًا للطبقة العليا (الصفحات/المسارات).
//
// لا تستورد هذا الملف من ملفات `src/data/*` (تجنّبًا للتبعية الدائرية).
// =============================================================================

import type { Surah } from '../../data/surahs'
import type { Ayah } from '../../data/ayahs'
import type { Author } from '../../data/authors'
import type { TafseerBook } from '../../data/books'
import type { Category } from '../../data/categories'
import type { TafseerEntry } from '../../data/tafseers'
import type { SourceType, VerificationStatus } from '../scientific'
import type { SearchFilters, SearchResults, Suggestion } from '../search'

// ====== Re-export الأنواع لسهولة الاستيراد من الطبقة العليا ======
export type {
  Surah, Ayah, Author, TafseerBook, Category, TafseerEntry,
  SourceType, VerificationStatus,
  SearchFilters, SearchResults, Suggestion,
}

/** ملخّص تغطية القرآن في قاعدة البيانات الحالية. */
export interface QuranCoverageSummary {
  /** عدد الآيات الموجودة فعلًا في قاعدة البيانات. */
  ayahsCount: number
  /** العدد المتوقَّع للقرآن الكامل (ثابت 6236). */
  expectedAyahs: 6236
  /** عدد السور التي تحوي آية واحدة على الأقل. */
  surahsCovered: number
  /** هل القرآن كامل (ayahsCount === 6236)؟ */
  isComplete: boolean
  /** نسبة التغطية ٪ (مدوَّرة لرقمين). */
  coveragePercent: number
  /** اسم المزوّد الحالي. */
  mode: 'seed' | 'd1'
}

/** Payload جاهز لصفحة /read/:n. */
export interface ReadSurahPayload {
  surah: Surah | undefined
  ayahs: Ayah[]
  /** التفاسير مفهرسة حسب رقم الآية لتسهيل العرض. */
  tafseersByAyah: Record<number, TafseerEntry[]>
  /** اسم المزوّد. */
  mode: 'seed' | 'd1'
}

/** إحصاءات إجمالية مختصرة (موحَّدة بين seed و D1). */
export interface BasicStats {
  booksCount: number
  authorsCount: number
  surahsCount: number
  ayahsCount: number
  tafseersCount: number
  /** وضع المزوّد الحالي (seed أو d1) — يُستعمل في الواجهة للتمييز. */
  mode?: 'seed' | 'd1'
}

/** إحصاءات تفصيلية مرنة (تستفيد منها لوحة المعلومات). */
export interface DetailedStatsLike {
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
  bySourceType: Array<{ type: SourceType; count: number; percent: number }>
  byVerification: Array<{ status: VerificationStatus; count: number; percent: number }>
  scientific: {
    originalTexts: number
    summaries: number
    samples: number
    pendingReview: number
    curated: number
    verified: number
    partiallyVerified: number
    unverified: number
    flagged: number
    quranAyahsTotal: number
    quranAyahsCovered: number
    quranCoveragePercent: number
  }
}

/**
 * عقد مزوّد البيانات (Unified DataProvider).
 *
 * كل دالة قد تكون متزامنة (seed) أو غير متزامنة (D1)، لذا نُعيد
 * `T | Promise<T>` ونتعامل في الطبقة العليا عبر `await` دائمًا.
 *
 * يُغطّي الواجهات الرئيسية للتطبيق:
 *  - الإحصاءات (basic + detailed)
 *  - وصول السور والآيات
 *  - قراءة الكتب والمؤلفين والموضوعات والتفاسير
 *  - البحث المتقدّم والاقتراحات (suggest)
 */
export interface DataProvider {
  /** اسم المزوّد (للتسجيل والتشخيص). */
  readonly name: 'seed' | 'd1'

  // -------- Stats --------
  getStatsBasic(): BasicStats | Promise<BasicStats>
  getStatsDetailed(): DetailedStatsLike | Promise<DetailedStatsLike>

  // -------- Surahs --------
  listSurahs(): Surah[] | Promise<Surah[]>
  getSurahByNumber(n: number): Surah | undefined | Promise<Surah | undefined>

  // -------- Ayahs --------
  /** يجلب آية واحدة بنصّها من البيانات (إن كانت متوفرة في العينة). */
  getAyah(surah: number, ayah: number): Ayah | undefined | Promise<Ayah | undefined>
  /** كل الآيات لسورة معيّنة (مرتّبة ترتيبًا تصاعديًا حسب رقم الآية). */
  listAyahsForSurah(surah: number): Ayah[] | Promise<Ayah[]>

  // -------- Tafseers --------
  /** كل التفاسير لآية معيّنة (مرتّبة كما في البيانات الأصلية). */
  getTafseersByAyah(surah: number, ayah: number): TafseerEntry[] | Promise<TafseerEntry[]>

  /**
   * كل التفاسير لسورة كاملة دفعة واحدة (مرتّبة بـ ayah ثم id).
   * مهم لتجنّب N+1 على صفحة /read/:n.
   */
  getTafseersForSurah?(surah: number): TafseerEntry[] | Promise<TafseerEntry[]>

  /**
   * Payload جاهز لصفحة القراءة: السورة + الآيات + التفاسير
   * مفهرسة حسب رقم الآية. يخفض عدد الجولات إلى 3 استعلامات على D1.
   */
  getReadSurahPayload?(surah: number): ReadSurahPayload | Promise<ReadSurahPayload>

  /** ملخّص تغطية القرآن الحالية (آيات/سور/هل مكتمل). */
  getQuranCoverageSummary?(): QuranCoverageSummary | Promise<QuranCoverageSummary>

  // -------- Books --------
  listBooks(): TafseerBook[] | Promise<TafseerBook[]>
  getBookById(id: string): TafseerBook | undefined | Promise<TafseerBook | undefined>

  // -------- Authors --------
  listAuthors(): Author[] | Promise<Author[]>
  getAuthorById(id: string): Author | undefined | Promise<Author | undefined>

  // -------- Categories --------
  listCategories(): Category[] | Promise<Category[]>
  getCategoryById(id: string): Category | undefined | Promise<Category | undefined>

  // -------- Search & Suggest --------
  search(filters: SearchFilters): SearchResults | Promise<SearchResults>
  suggest(q: string, limit?: number): Suggestion[] | Promise<Suggestion[]>
}

/**
 * البيئة المتاحة في وقت الطلب على Cloudflare Pages.
 * في seed mode يكون undefined أو لا يحتوي DB binding.
 */
export interface RequestEnv {
  DB?: unknown // ستكون D1Database عند تفعيل الـ binding
}
