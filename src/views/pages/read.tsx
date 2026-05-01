// صفحة القراءة المتسلسلة لسورة كاملة - كل الآيات وتفاسيرها في صفحة واحدة
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconBook, IconBookOpen, IconHash, IconQuote, IconArrowLeft, IconArrowRight,
  IconTextSize, IconChevronUp, IconCopy, IconExternal, IconBookmark,
} from '../icons'
import { SURAHS, getSurahByNumber } from '../../data/surahs'
import { getAyahsBySurah } from '../../data/ayahs'
import { TAFSEERS } from '../../data/tafseers'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'

function toArabicNumber(n: number): string {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)])
}

export const ReadPage = ({ surahNumber }: { surahNumber: number }) => {
  const surah = getSurahByNumber(surahNumber)
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

  const ayahs = getAyahsBySurah(surahNumber)
  const totalTafseersInSurah = TAFSEERS.filter(t => t.surah === surahNumber).length
  const ayahsWithTafseer = new Set(
    TAFSEERS.filter(t => t.surah === surahNumber).map(t => t.ayah),
  ).size

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
              <IconHash size={11} /> {toArabicNumber(ayahs.length)} آية في العينة
            </span>
            {totalTafseersInSurah > 0 ? (
              <span class="badge">
                <IconQuote size={11} /> {toArabicNumber(totalTafseersInSurah)} تفسير في {toArabicNumber(ayahsWithTafseer)} آية
              </span>
            ) : null}
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
              const tafs = TAFSEERS.filter(t => t.surah === a.surah && t.ayah === a.number)
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
                          const book = BOOKS.find(b => b.id === t.bookId)!
                          const author = AUTHORS.find(au => au.id === book.authorId)!
                          return (
                            <article class="tafseer-card compact" data-tafseer-id={t.id}>
                              <header class="tafseer-header">
                                <div class="tafseer-book-info">
                                  <div class="tafseer-book-cover-mini">
                                    <IconBook size={18} />
                                  </div>
                                  <div class="tafseer-book-meta">
                                    <div class="tafseer-book-name">
                                      <a href={`/books/${book.id}`} style="color:inherit">{book.title}</a>
                                    </div>
                                    <div class="tafseer-author-name">
                                      {author.name} · ت {author.deathYear}هـ
                                      · {book.schools.join('، ')}
                                    </div>
                                  </div>
                                </div>
                                <div class="tafseer-actions">
                                  <button class="icon-btn copy-btn" data-copy-target={`#read-tafseer-${t.id}`} title="نسخ">
                                    <IconCopy size={14} />
                                  </button>
                                  <a href={`/books/${book.id}`} class="icon-btn" title="فتح الكتاب">
                                    <IconExternal size={14} />
                                  </a>
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
