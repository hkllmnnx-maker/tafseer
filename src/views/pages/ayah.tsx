// صفحة عرض الآية وتفاسيرها
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconArrowLeft, IconArrowRight, IconCopy, IconShare, IconExternal,
  IconBook, IconChevronDown, IconChevronUp, IconQuote, IconCompare,
  IconTextSize, IconHash,
} from '../icons'
import { SURAHS, getSurahByNumber } from '../../data/surahs'
import { getAyah } from '../../data/ayahs'
import { getTafseersByAyah } from '../../data/tafseers'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { highlightText, escapeHtml } from '../../lib/normalize'

export const AyahPage = ({
  surah,
  ayah,
  q = '',
}: {
  surah: number
  ayah: number
  q?: string
}) => {
  const surahData = getSurahByNumber(surah)
  const ayahData = getAyah(surah, ayah)
  const tafseers = getTafseersByAyah(surah, ayah)

  if (!surahData) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <div class="empty-state card">
            <h3>السورة غير موجودة</h3>
            <p>تأكد من رقم السورة. <a href="/" class="text-accent">العودة للرئيسية</a></p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const prevAyah = ayah > 1 ? { surah, ayah: ayah - 1 } : null
  const nextAyah = ayah < surahData.ayahCount ? { surah, ayah: ayah + 1 } : null

  return (
    <>
      <Header />
      <main class="container" style="padding-top:1.5rem;padding-bottom:2rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'السور', href: '/surahs' },
          { label: `سورة ${surahData.name}`, href: `/surahs/${surah}` },
          { label: `آية ${ayah}` },
        ]} />

        {/* Reading Tools */}
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <button class="btn btn-secondary btn-sm" id="font-size-toggle" title="تكبير الخط">
            <IconTextSize size={16} /> حجم الخط
          </button>
          <a href={`/compare?surah=${surah}&ayah=${ayah}`} class="btn btn-secondary btn-sm">
            <IconCompare size={16} /> مقارنة
          </a>
          <span style="margin-inline-start:auto" class="text-sm text-tertiary">
            {tafseers.length > 0 ? `${tafseers.length} مصدر تفسيري` : 'لا توجد تفاسير محفوظة لهذه الآية'}
          </span>
        </div>

        {/* Ayah Display */}
        <section class="ayah-display mb-6">
          <div class="ayah-meta">
            <IconBook size={14} />
            <span>سورة {surahData.name}</span>
            <span style="opacity:.5">·</span>
            <span>{surahData.type}</span>
          </div>
          {ayahData ? (
            <div class="ayah-text">
              {ayahData.text}
              <span class="ayah-number-circle">{toArabicNumber(ayah)}</span>
            </div>
          ) : (
            <div class="text-tertiary">
              نص الآية غير متوفر في العينة الحالية - لكن يمكنك استخدام الفلاتر للوصول للتفاسير المتاحة.
            </div>
          )}

          <div class="ayah-nav">
            {prevAyah ? (
              <a href={`/ayah/${prevAyah.surah}/${prevAyah.ayah}`} class="btn btn-secondary btn-sm">
                <IconArrowRight size={16} />
                الآية السابقة
              </a>
            ) : <span></span>}
            <span class="text-sm text-tertiary">
              {ayah} / {surahData.ayahCount}
            </span>
            {nextAyah ? (
              <a href={`/ayah/${nextAyah.surah}/${nextAyah.ayah}`} class="btn btn-secondary btn-sm">
                الآية التالية
                <IconArrowLeft size={16} />
              </a>
            ) : <span></span>}
          </div>
        </section>

        {/* Tafseers */}
        {tafseers.length === 0 ? (
          <div class="empty-state card">
            <div class="empty-icon"><IconQuote size={28} /></div>
            <h3>لا توجد تفاسير مفهرسة لهذه الآية في العينة الحالية</h3>
            <p>
              التطبيق يحتوي حاليًا على عينة من التفاسير. يمكنك استيراد المزيد من البيانات عبر لوحة الاستيراد.
              أو <a href="/search" class="text-accent">جرّب البحث في آية أخرى</a>.
            </p>
          </div>
        ) : (
          <section>
            <div class="section-header" style="margin-bottom:1rem">
              <h2 class="section-title">
                <span class="icon-deco"><IconQuote size={18} /></span>
                التفاسير
              </h2>
              <div class="flex gap-2">
                <button class="btn btn-secondary btn-sm" id="expand-all">
                  <IconChevronDown size={14} /> توسيع الكل
                </button>
                <button class="btn btn-secondary btn-sm" id="collapse-all">
                  <IconChevronUp size={14} /> طيّ الكل
                </button>
              </div>
            </div>

            <div class="tafseer-list" id="tafseer-list">
              {tafseers.map(t => {
                const book = BOOKS.find(b => b.id === t.bookId)!
                const author = AUTHORS.find(a => a.id === book.authorId)!
                return (
                  <article class="tafseer-card" data-tafseer-id={t.id}>
                    <header class="tafseer-header">
                      <div class="tafseer-book-info">
                        <div class="tafseer-book-cover-mini">
                          <IconBook size={20} />
                        </div>
                        <div class="tafseer-book-meta">
                          <div class="tafseer-book-name">
                            <a href={`/books/${book.id}`} style="color:inherit">{book.title}</a>
                          </div>
                          <div class="tafseer-author-name">
                            {author.name} · ت {author.deathYear}هـ
                            {' '}· {book.schools.join('، ')}
                          </div>
                        </div>
                      </div>
                      <div class="tafseer-actions">
                        <button class="icon-btn copy-btn" data-copy-target={`#tafseer-body-${t.id}`} title="نسخ">
                          <IconCopy size={16} />
                        </button>
                        <button class="icon-btn share-btn" data-share-id={t.id} data-surah={surah} data-ayah={ayah} title="مشاركة">
                          <IconShare size={16} />
                        </button>
                        <a href={`/books/${book.id}`} class="icon-btn" title="فتح الكتاب">
                          <IconExternal size={16} />
                        </a>
                      </div>
                    </header>
                    <div
                      class="tafseer-body"
                      id={`tafseer-body-${t.id}`}
                      data-collapsible="true"
                      dangerouslySetInnerHTML={{ __html: highlightText(t.text, q) }}
                    />
                    {t.source ? (
                      <div style="padding:0 1.5rem 1rem;font-size:.8rem;color:var(--text-muted)">
                        المصدر: {t.source}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <Toast />
    </>
  )
}

function toArabicNumber(n: number): string {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)])
}
