// صفحة القراءة المتسلسلة لسورة كاملة - كل الآيات وتفاسيرها في صفحة واحدة
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconBook, IconBookOpen, IconHash, IconQuote, IconArrowLeft, IconArrowRight,
  IconTextSize, IconChevronUp, IconCopy, IconExternal, IconBookmark, IconDatabase,
} from '../icons'
import { SURAHS, getSurahByNumber } from '../../data/surahs'
import { getAyahsBySurah } from '../../data/ayahs'
import { TAFSEERS } from '../../data/tafseers'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { getSurahCoverage } from '../../lib/coverage'
import type { Surah, Ayah, TafseerEntry } from '../../lib/data/types'

function toArabicNumber(n: number): string {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)])
}

export const ReadPage = ({
  surahNumber,
  filter = 'all',
  // Optional pre-fetched payload via DataProvider (avoids N+1 on D1)
  surah: surahProp,
  ayahs: ayahsProp,
  tafseersByAyah: tafseersByAyahProp,
  dataMode,
}: {
  surahNumber: number
  filter?: 'all' | 'summaries' | 'verified'
  surah?: Surah | undefined
  ayahs?: Ayah[]
  tafseersByAyah?: Record<number, TafseerEntry[]>
  dataMode?: 'seed' | 'd1'
}) => {
  // Fall back to seed lookup when no pre-fetched data is provided.
  const surah = surahProp !== undefined ? surahProp : getSurahByNumber(surahNumber)
  const mode = dataMode || 'seed'
  if (!surah) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <div class="empty-state card"><h3>السورة غير موجودة</h3>
            <p>تأكد من رقم السورة. <a href="/surahs" class="text-accent">عرض كل السور</a></p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const ayahs = ayahsProp !== undefined ? ayahsProp : getAyahsBySurah(surahNumber)
  // Build tafseersByAyah index once (no N+1 lookups inside the render loop)
  let tafseersByAyahLocal: Record<number, TafseerEntry[]>
  if (tafseersByAyahProp !== undefined) {
    tafseersByAyahLocal = tafseersByAyahProp
  } else {
    tafseersByAyahLocal = {}
    for (const t of TAFSEERS) {
      if (t.surah !== surahNumber) continue
      if (!tafseersByAyahLocal[t.ayah]) tafseersByAyahLocal[t.ayah] = []
      tafseersByAyahLocal[t.ayah].push(t as any)
    }
  }
  const allTafseersInSurah: TafseerEntry[] = Object.values(tafseersByAyahLocal).flat()
  const totalTafseersInSurah = allTafseersInSurah.length
  const ayahsWithTafseer = Object.keys(tafseersByAyahLocal).length

  // جيران
  const prevSurah = SURAHS.find(s => s.number === surahNumber - 1)
  const nextSurah = SURAHS.find(s => s.number === surahNumber + 1)

  return (
    <>
      <Header />
      <main class="container" style="padding-top:1.5rem;padding-bottom:3rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'السور', href: '/surahs' },
          { label: `سورة ${surah.name}`, href: `/surahs/${surah.number}` },
          { label: 'قراءة متسلسلة' },
        ]} />

        {/* Cover */}
        <div class="card card-elevated mb-6" style="padding:2rem;text-align:center">
          <div class="ayah-meta" style="margin-bottom:.5rem;justify-content:center">
            <IconBookOpen size={14} /> <span>{surah.type}</span>
            <span style="opacity:.5">·</span>
            <span>{toArabicNumber(surah.ayahCount)} آية</span>
            <span style="opacity:.5">·</span>
            <span>ترتيب النزول: {toArabicNumber(surah.order)}</span>
          </div>
          <h1 style="margin:.5rem 0">سورة {surah.name}</h1>
          <p class="text-tertiary" style="margin:0">{surah.nameLatin}</p>

          <div class="flex flex-wrap gap-2 mt-4" style="justify-content:center">
            <span class="badge badge-gold">
              <IconHash size={11} /> {toArabicNumber(ayahs.length)} / {toArabicNumber(surah.ayahCount)} آية متوفرة
            </span>
            {totalTafseersInSurah > 0 ? (
              <span class="badge">
                <IconQuote size={11} /> {toArabicNumber(totalTafseersInSurah)} تفسير في {toArabicNumber(ayahsWithTafseer)} آية
              </span>
            ) : null}
            <span
              class={`badge ${mode === 'd1' ? 'badge-success' : 'badge-gold'}`}
              title={mode === 'd1' ? 'البيانات تُقرأ من قاعدة Cloudflare D1' : 'البيانات تُقرأ من العيّنة المضمَّنة (seed)'}>
              <IconDatabase size={11} /> {mode === 'd1' ? 'D1' : 'seed'}
            </span>
            {(() => {
              const cov = getSurahCoverage(surahNumber)
              if (!cov) return null
              const completenessLabel: Record<string, string> = {
                'complete': 'مكتمل',
                'partial': 'جزئي',
                'minimal': 'محدود',
                'none': 'بدون عينة',
              }
              const completenessClass: Record<string, string> = {
                'complete': 'badge-success',
                'partial': 'badge-warning',
                'minimal': 'badge-warning',
                'none': 'badge-danger',
              }
              return (
                <span class={`badge ${completenessClass[cov.completeness] || ''}`}>
                  التغطية: {cov.ayahCoveragePercent}% — {completenessLabel[cov.completeness] || cov.completeness}
                </span>
              )
            })()}
          </div>
          <div style="margin-top:1rem;max-width:480px;margin-inline:auto">
            {(() => {
              const cov = getSurahCoverage(surahNumber)
              if (!cov) return null
              return (
                <div class="coverage-bar" aria-label={`نسبة التغطية ${cov.ayahCoveragePercent}%`}>
                  <span style={`width:${Math.max(2, cov.ayahCoveragePercent)}%`}></span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Reading Tools (sticky) */}
        <div class="read-toolbar" id="read-toolbar">
          <button class="btn btn-secondary btn-sm" id="font-size-toggle" title="تكبير الخط">
            <IconTextSize size={16} /> حجم الخط
          </button>
          <button class="btn btn-secondary btn-sm" id="toggle-tafseers" title="إخفاء/إظهار التفاسير">
            <IconQuote size={16} /> <span id="toggle-tafseers-label">إخفاء التفاسير</span>
          </button>
          <a href={`/surahs/${surah.number}`} class="btn btn-secondary btn-sm">
            <IconBook size={16} /> قائمة الآيات
          </a>
          <span style="margin-inline-start:auto" class="text-sm text-tertiary hide-mobile">
            قراءة متسلسلة لسورة {surah.name}
          </span>
        </div>

        {/* فلاتر التفاسير (الكل / ملخّصات / موثّق فقط) */}
        <div class="flex flex-wrap gap-2 mt-3 mb-4" role="tablist" aria-label="فلاتر عرض التفاسير">
          <a href={`/read/${surah.number}`}
             class={`chip ${filter === 'all' ? 'active' : ''}`}
             style="text-decoration:none" role="tab" aria-selected={filter === 'all'}>
            كل التفاسير
          </a>
          <a href={`/read/${surah.number}?filter=summaries`}
             class={`chip ${filter === 'summaries' ? 'active' : ''}`}
             style="text-decoration:none" role="tab" aria-selected={filter === 'summaries'}>
            الملخّصات فقط
          </a>
          <a href={`/read/${surah.number}?filter=verified`}
             class={`chip ${filter === 'verified' ? 'active' : ''}`}
             style="text-decoration:none" role="tab" aria-selected={filter === 'verified'}>
            الموثّقة فقط
          </a>
          <span class="text-xs text-tertiary" style="margin-inline-start:auto">
            فلتر عرض التفاسير تحت كل آية
          </span>
        </div>

        {/* TOC for ayahs */}
        {ayahs.length > 0 ? (
          <details class="card mb-6" style="padding:1rem 1.25rem">
            <summary style="cursor:pointer;font-weight:600">
              <IconHash size={14} /> فهرس الآيات في هذه الصفحة ({toArabicNumber(ayahs.length)})
            </summary>
            <div class="flex flex-wrap gap-2 mt-3">
              {ayahs.map(a => (
                <a href={`#ayah-${a.number}`} class="badge badge-outline" style="text-decoration:none">
                  آية {toArabicNumber(a.number)}
                </a>
              ))}
            </div>
          </details>
        ) : null}

        {/* Ayahs with inline tafseers */}
        {ayahs.length === 0 ? (
          <div class="empty-state card">
            <h3>لا توجد آيات من هذه السورة في العينة الحالية</h3>
            <p>التطبيق يعرض عينة من الآيات. <a href="/surahs" class="text-accent">تصفح السور الأخرى</a></p>
          </div>
        ) : (
          <div class="read-ayahs-list">
            {ayahs.map((a, idx) => {
              // Pre-indexed tafseers by ayah number → no N+1 scans of TAFSEERS
              let tafs: TafseerEntry[] = tafseersByAyahLocal[a.number] || []
              if (filter === 'summaries') {
                tafs = tafs.filter(t => t.sourceType === 'summary' || t.sourceType === 'sample' || !t.sourceType)
              } else if (filter === 'verified') {
                tafs = tafs.filter(t => t.verificationStatus === 'verified')
              }
              return (
                <section
                  id={`ayah-${a.number}`}
                  class="read-ayah-block"
                  style={idx > 0 ? 'margin-top:2rem' : ''}
                >
                  <div class="ayah-display">
                    <div class="ayah-meta" style="justify-content:center">
                      <IconBook size={14} />
                      <span>سورة {surah.name}</span>
                      <span style="opacity:.5">·</span>
                      <span>آية {toArabicNumber(a.number)}</span>
                    </div>
                    <div class="ayah-text">
                      {a.text}
                      <span class="ayah-number-circle">{toArabicNumber(a.number)}</span>
                    </div>

                    <div class="flex flex-wrap gap-2 mt-3" style="justify-content:center">
                      <a href={`/ayah/${a.surah}/${a.number}`} class="btn btn-secondary btn-sm">
                        صفحة الآية المنفصلة <IconArrowLeft size={14} />
                      </a>
                      <a href={`/compare?surah=${a.surah}&ayah=${a.number}`} class="btn btn-secondary btn-sm">
                        مقارنة التفاسير
                      </a>
                      <button
                        class="btn btn-secondary btn-sm bookmark-toggle-btn"
                        data-surah={a.surah}
                        data-ayah={a.number}
                        data-surah-name={surah.name}
                        data-ayah-text={a.text}
                        aria-pressed="false"
                        title="حفظ في المفضلة">
                        <IconBookmark size={14} />
                        <span class="bookmark-toggle-label">حفظ</span>
                      </button>
                    </div>
                  </div>

                  {tafs.length > 0 ? (
                    <div class="read-tafseers" data-tafseers-block>
                      <h3 class="section-title" style="font-size:1rem;margin:1.25rem 0 .75rem">
                        <span class="icon-deco"><IconQuote size={14} /></span>
                        التفاسير ({toArabicNumber(tafs.length)})
                      </h3>
                      <div class="tafseer-list">
                        {tafs.map(t => {
                          // Resilient lookup: book/author may be missing if D1 contains rows
                          // for books that aren't part of the seed metadata.
                          const book = BOOKS.find(b => b.id === t.bookId)
                          const author = book ? AUTHORS.find(au => au.id === book.authorId) : undefined
                          const bookTitle = book?.title || t.bookId
                          const bookSchools = book?.schools?.join('، ') || ''
                          return (
                            <article class="tafseer-card compact" data-tafseer-id={t.id}>
                              <header class="tafseer-header">
                                <div class="tafseer-book-info">
                                  <div class="tafseer-book-cover-mini">
                                    <IconBook size={18} />
                                  </div>
                                  <div class="tafseer-book-meta">
                                    <div class="tafseer-book-name">
                                      {book
                                        ? <a href={`/books/${book.id}`} style="color:inherit">{bookTitle}</a>
                                        : <span>{bookTitle}</span>}
                                    </div>
                                    <div class="tafseer-author-name">
                                      {author ? <>{author.name} · ت {author.deathYear}هـ</> : null}
                                      {bookSchools ? <> · {bookSchools}</> : null}
                                    </div>
                                  </div>
                                </div>
                                <div class="tafseer-actions">
                                  <button class="icon-btn copy-btn" data-copy-target={`#read-tafseer-${t.id}`} title="نسخ">
                                    <IconCopy size={14} />
                                  </button>
                                  {book ? (
                                    <a href={`/books/${book.id}`} class="icon-btn" title="فتح الكتاب">
                                      <IconExternal size={14} />
                                    </a>
                                  ) : null}
                                </div>
                              </header>
                              <div
                                class="tafseer-body"
                                id={`read-tafseer-${t.id}`}
                              >{t.text}</div>
                              {t.source ? (
                                <div style="padding:0 1.5rem 1rem;font-size:.8rem;color:var(--text-muted)">
                                  المصدر: {t.source}
                                </div>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div class="text-tertiary text-sm" style="text-align:center;padding:.5rem;opacity:.7">
                      لا توجد تفاسير مفهرسة لهذه الآية في العينة الحالية
                    </div>
                  )}

                  <a href="#read-toolbar" class="back-to-top-mini" title="العودة للأعلى">
                    <IconChevronUp size={14} />
                  </a>
                </section>
              )
            })}
          </div>
        )}

        {/* Footer Nav */}
        <nav class="flex flex-wrap items-center gap-3 mt-8" style="justify-content:space-between">
          {prevSurah ? (
            <a href={`/read/${prevSurah.number}`} class="btn btn-secondary">
              <IconArrowRight size={16} />
              السورة السابقة: {prevSurah.name}
            </a>
          ) : <span></span>}
          <a href="/surahs" class="btn btn-secondary btn-sm">كل السور</a>
          {nextSurah ? (
            <a href={`/read/${nextSurah.number}`} class="btn btn-secondary">
              السورة التالية: {nextSurah.name}
              <IconArrowLeft size={16} />
            </a>
          ) : <span></span>}
        </nav>
      </main>
      <Footer />
      <Toast />
    </>
  )
}
