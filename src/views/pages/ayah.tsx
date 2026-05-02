// صفحة عرض الآية وتفاسيرها
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconArrowLeft, IconArrowRight, IconCopy, IconShare, IconExternal,
  IconBook, IconChevronDown, IconChevronUp, IconQuote, IconCompare,
  IconTextSize, IconHash, IconBookmark,
} from '../icons'
import { SURAHS, getSurahByNumber } from '../../data/surahs'
import { getAyah } from '../../data/ayahs'
import { getTafseersByAyah } from '../../data/tafseers'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { highlightText, escapeHtml } from '../../lib/normalize'
import {
  SourceTypeBadge, VerificationBadge, VerificationWarning, SourceCitation,
  ScientificDisclaimer,
} from '../components/badges'
import { getSurahCoverage, ayahHasText } from '../../lib/coverage'

export const AyahPage = ({
  surah,
  ayah,
  q = '',
  notFound = false,
}: {
  surah: number
  ayah: number
  q?: string
  notFound?: boolean
}) => {
  const surahData = getSurahByNumber(surah)
  const ayahData = getAyah(surah, ayah)
  const tafseers = getTafseersByAyah(surah, ayah)

  if (notFound || !surahData) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <Breadcrumbs items={[
            { label: 'الرئيسية', href: '/' },
            { label: 'السور', href: '/surahs' },
            { label: 'آية غير موجودة' },
          ]} />
          <div class="empty-state card">
            <div class="empty-icon"><IconQuote size={28} /></div>
            <h3>الآية المطلوبة غير موجودة في القرآن</h3>
            <p style="line-height:1.9">
              {surahData ? (
                <>السورة <strong>{surahData.name}</strong> تحتوي على {surahData.ayahCount} آية فقط، والرقم <strong>{ayah}</strong> خارج هذا النطاق.</>
              ) : (
                <>تأكد من رقم السورة (1 إلى 114) ورقم الآية.</>
              )}
            </p>
            <div class="flex gap-2 mt-3" style="justify-content:center;flex-wrap:wrap">
              <a href="/" class="btn btn-primary btn-sm">العودة للرئيسية</a>
              <a href="/surahs" class="btn btn-secondary btn-sm">قائمة السور</a>
              {surahData ? (
                <a href={`/surahs/${surahData.number}`} class="btn btn-secondary btn-sm">سورة {surahData.name}</a>
              ) : null}
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const prevAyah = ayah > 1 ? { surah, ayah: ayah - 1 } : null
  const nextAyah = ayah < surahData.ayahCount ? { surah, ayah: ayah + 1 } : null
  const coverage = getSurahCoverage(surah)
  const hasAnyWarning = tafseers.some(t => t.verificationStatus !== 'verified')
  const verifiedCount = tafseers.filter(t => t.verificationStatus === 'verified').length
  const originalCount = tafseers.filter(t => t.sourceType === 'original-text').length
  const summaryCount = tafseers.filter(t => t.sourceType === 'summary' || t.sourceType === 'sample').length
  const ayahHas = !!ayahData

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

        {/* Info Bar — بيان سريع عن التغطية وتوفر النص */}
        <div class="card mb-4" style="padding:.85rem 1rem;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;font-size:.85rem">
          <span class="badge"><IconHash size={12} /> سورة {surah} : آية {ayah}</span>
          <span class="badge" title="عدد التفاسير المتوفرة">{tafseers.length} تفسير</span>
          {ayahHas
            ? <span class="badge badge-success">نص الآية متوفر</span>
            : <span class="badge badge-warn">نص الآية غير متوفر</span>}
          {verifiedCount > 0 ? <span class="badge badge-success">{verifiedCount} موثّق</span> : null}
          {originalCount > 0 ? <span class="badge badge-gold">{originalCount} نص أصلي</span> : null}
          {summaryCount > 0 ? <span class="badge">{summaryCount} ملخّص/عيّنة</span> : null}
          <a href="/methodology" class="text-accent text-xs" style="margin-inline-start:auto" title="معاني الشارات ومنهجية التحقّق">
            ما معنى هذه الشارات؟ ↗
          </a>
        </div>

        {/* Reading Tools */}
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <button class="btn btn-secondary btn-sm" id="font-size-toggle" title="تكبير الخط">
            <IconTextSize size={16} /> حجم الخط
          </button>
          <a href={`/compare?surah=${surah}&ayah=${ayah}`} class="btn btn-secondary btn-sm">
            <IconCompare size={16} /> مقارنة
          </a>
          <button
            class="btn btn-secondary btn-sm bookmark-toggle-btn"
            id="bookmark-toggle"
            data-surah={surah}
            data-ayah={ayah}
            data-surah-name={surahData.name}
            data-ayah-text={ayahData ? ayahData.text : ''}
            aria-pressed="false"
            title="حفظ في المفضلة">
            <IconBookmark size={16} />
            <span class="bookmark-toggle-label">حفظ في المفضلة</span>
          </button>
          {tafseers.length > 0 ? (
            <>
              <button
                class="btn btn-secondary btn-sm"
                id="copy-all-tafseers"
                data-surah={surah}
                data-ayah={ayah}
                data-surah-name={surahData.name}
                title="نسخ كل التفاسير مع الإسناد">
                <IconCopy size={16} /> نسخ كل التفاسير
              </button>
              {verifiedCount > 0 && verifiedCount < tafseers.length ? (
                <button
                  class="btn btn-secondary btn-sm"
                  id="toggle-documented-only"
                  aria-pressed="false"
                  title="إظهار التفاسير الموثّقة فقط">
                  📑 الموثّقة فقط
                </button>
              ) : null}
            </>
          ) : null}
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
            <div class="partial-data-notice" role="note">
              <strong>تنبيه:</strong> نص هذه الآية غير متوفّر في القاعدة الحالية (نحن نوسّع التغطية تدريجيًا).
              يمكنك استعراض التفاسير المرتبطة بها في الأسفل.
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

            {hasAnyWarning ? <ScientificDisclaimer /> : null}

            {/* فهرس التفاسير — تنقّل سريع داخل الصفحة */}
            {tafseers.length > 1 ? (
              <nav class="card mb-4" style="padding:.6rem .9rem" aria-label="فهرس التفاسير">
                <div class="text-xs text-tertiary mb-2">فهرس سريع:</div>
                <div class="flex flex-wrap gap-2">
                  {tafseers.map(t => {
                    const b = BOOKS.find(x => x.id === t.bookId)
                    return (
                      <a href={`#tafseer-body-${t.id}`} class="chip" style="text-decoration:none;font-size:.8rem">
                        {b?.title || t.bookId}
                      </a>
                    )
                  })}
                </div>
              </nav>
            ) : null}

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
                          <div class="tafseer-badges">
                            <SourceTypeBadge type={t.sourceType} />
                            <VerificationBadge status={t.verificationStatus} />
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
                    <VerificationWarning status={t.verificationStatus} note={t.reviewerNote} />
                    <div
                      class="tafseer-body"
                      id={`tafseer-body-${t.id}`}
                      data-collapsible="true"
                      dangerouslySetInnerHTML={{ __html: highlightText(t.text, q) }}
                    />
                    <div style="padding:0 1.5rem 1rem">
                      <SourceCitation
                        bookTitle={book.title}
                        sourceName={t.sourceName || t.source}
                        edition={t.edition}
                        volume={t.volume}
                        page={t.page}
                        sourceUrl={t.sourceUrl}
                      />
                    </div>
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
