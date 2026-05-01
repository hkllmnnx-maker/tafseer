// صفحة المقارنة بين التفاسير
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconCompare, IconBook, IconArrowRightCircle, IconQuote } from '../icons'
import { SURAHS, getSurahByNumber } from '../../data/surahs'
import { getAyah } from '../../data/ayahs'
import { getTafseersByAyah } from '../../data/tafseers'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { highlightText } from '../../lib/normalize'

export const ComparePage = ({
  surah,
  ayah,
  bookIds = [],
}: {
  surah?: number
  ayah?: number
  bookIds?: string[]
}) => {
  const surahData = surah ? getSurahByNumber(surah) : null
  const ayahData = surah && ayah ? getAyah(surah, ayah) : null
  const allTafseers = surah && ayah ? getTafseersByAyah(surah, ayah) : []
  const filteredTafseers =
    bookIds.length > 0 ? allTafseers.filter(t => bookIds.includes(t.bookId)) : allTafseers

  return (
    <>
      <Header active="compare" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'المقارنة' }]} />

        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">
              <span class="icon-deco"><IconCompare size={18} /></span>
              المقارنة بين التفاسير
            </h2>
            <span class="section-subtitle">اختر آية و2 إلى 5 من كتب التفسير لعرضها جنبًا إلى جنب</span>
          </div>
        </div>

        <form method="get" action="/compare" class="card mb-6" style="padding:1.5rem">
          <div class="flex flex-wrap gap-3">
            <div style="min-width:220px;flex:1">
              <label class="field-label">السورة</label>
              <select name="surah" class="select">
                <option value="">— اختر سورة —</option>
                {SURAHS.map(s => (
                  <option value={s.number} selected={surah === s.number}>
                    {s.number}. {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div style="min-width:140px;flex:1">
              <label class="field-label">رقم الآية</label>
              <input type="number" min="1" class="input" name="ayah" value={ayah || ''} placeholder="مثال: 1" />
            </div>
          </div>

          <div class="mt-4">
            <label class="field-label">اختر كتب التفسير (2 إلى 5)</label>
            <div class="flex flex-wrap gap-2">
              {BOOKS.map(b => (
                <label class="filter-option" style="border:1px solid var(--border-default);border-radius:var(--radius-md);padding:.4rem .65rem">
                  <input
                    type="checkbox" name="bookIds" value={b.id}
                    checked={bookIds.includes(b.id)}
                  />
                  <span class="text-sm">{b.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div class="mt-4 flex gap-2">
            <button type="submit" class="btn btn-primary">عرض المقارنة</button>
            <a href="/compare" class="btn btn-ghost btn-sm">إعادة ضبط</a>
          </div>
        </form>

        {!surah || !ayah ? (
          <div class="empty-state card">
            <div class="empty-icon"><IconCompare size={28} /></div>
            <h3>اختر سورة ورقم آية للبدء</h3>
            <p>سيتم عرض التفاسير في أعمدة منظمة لتسهيل القراءة والمقارنة.</p>
          </div>
        ) : !ayahData ? (
          <div class="empty-state card">
            <h3>الآية غير متوفرة في العينة الحالية</h3>
            <p>جرّب آية أخرى مثل: الفاتحة 1، البقرة 255، الإخلاص 1.</p>
          </div>
        ) : filteredTafseers.length === 0 ? (
          <div class="empty-state card">
            <h3>لا توجد تفاسير متاحة لهذه الآية في العينة</h3>
            <p>التفاسير المفهرسة تشمل آيات منتقاة - جرّب آية أخرى.</p>
          </div>
        ) : (
          <>
            {/* Ayah display */}
            <section class="ayah-display mb-6">
              <div class="ayah-meta">
                <IconBook size={14} /> <span>سورة {surahData!.name}</span>
              </div>
              <div class="ayah-text">{ayahData.text}</div>
            </section>

            {/* Comparison columns */}
            <div class="compare-grid" style={`grid-template-columns:repeat(${Math.min(filteredTafseers.length, 3)}, minmax(280px, 1fr))`}>
              {filteredTafseers.map(t => {
                const book = BOOKS.find(b => b.id === t.bookId)!
                const author = AUTHORS.find(a => a.id === book.authorId)!
                return (
                  <article class="tafseer-card">
                    <header class="tafseer-header">
                      <div class="tafseer-book-info">
                        <div class="tafseer-book-cover-mini"><IconBook size={18} /></div>
                        <div class="tafseer-book-meta">
                          <div class="tafseer-book-name">{book.title}</div>
                          <div class="tafseer-author-name">{author.name} · ت {author.deathYear}هـ</div>
                        </div>
                      </div>
                    </header>
                    <div class="tafseer-body">{t.text}</div>
                  </article>
                )
              })}
            </div>
            <div class="mt-6 flex flex-wrap gap-2">
              <a href={`/ayah/${surah}/${ayah}`} class="btn btn-secondary">
                <IconQuote size={16} /> عرض جميع التفاسير لهذه الآية
              </a>
            </div>
          </>
        )}
      </main>
      <Footer />
      <Toast />
    </>
  )
}
