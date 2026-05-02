// =============================================================================
// Data Access Layer — Types
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

// ====== Re-export الأنواع لسهولة الاستيراد من الطبقة العليا ======
export type {
  Surah, Ayah, Author, TafseerBook, Category, TafseerEntry,
  SourceType, VerificationStatus,
}

/** إحصاءات إجمالية مختصرة (موحَّدة بين seed و D1). */
export interface BasicStats {
  booksCount: number
  authorsCount: number
  surahsCount: number
  ayahsCount: number
  tafseersCount: number
}

/**
 * عقد مزوّد البيانات.
 *
 * كل دالة هنا قد تكون متزامنة (seed) أو غير متزامنة (D1)، لذا نُعيد
 * `T | Promise<T>` ونتعامل في الطبقة العليا عبر `await` دائمًا.
 *
 * المسارات المهمّة المُغطّاة في هذه المرحلة الأولى:
 *  - getStatsBasic         — للصفحة الرئيسية / لوحة الإحصاءات
 *  - getAyah / getTafseersByAyah  — لصفحة الآية
 *  - listBooks / getBookById      — لصفحات الكتب
 *  - listAuthors / getAuthorById  — لصفحات المؤلفين
 *
 * لاحقًا سنغطّي: search، detailedStats، coverage، وغيرها.
 */
export interface DataProvider {
  /** اسم المزوّد (للتسجيل والتشخيص). */
  readonly name: 'seed' | 'd1'

  // -------- Stats --------
  getStatsBasic(): BasicStats | Promise<BasicStats>

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

  // -------- Books --------
  listBooks(): TafseerBook[] | Promise<TafseerBook[]>
  getBookById(id: string): TafseerBook | undefined | Promise<TafseerBook | undefined>

  // -------- Authors --------
  listAuthors(): Author[] | Promise<Author[]>
  getAuthorById(id: string): Author | undefined | Promise<Author | undefined>

  // -------- Categories --------
  listCategories(): Category[] | Promise<Category[]>
  getCategoryById(id: string): Category | undefined | Promise<Category | undefined>
}

/**
 * البيئة المتاحة في وقت الطلب على Cloudflare Pages.
 * في seed mode يكون undefined أو لا يحتوي DB binding.
 */
export interface RequestEnv {
  DB?: unknown // ستكون D1Database عند تفعيل الـ binding
}
