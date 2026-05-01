// صفحة قائمة السور
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconBookOpen, IconArrowRightCircle, IconHash, IconSearch } from '../icons'
import { SURAHS, getSurahByNumber } from '../../data/surahs'
import { getAyahsBySurah } from '../../data/ayahs'
import { TAFSEERS } from '../../data/tafseers'
import { getSurahCoverage, completenessLabel, completenessClass } from '../../lib/coverage'

export const SurahsPage = ({ q = '', type = '' }: { q?: string; type?: string }) => {
  let surahs = [...SURAHS]
  if (q) surahs = surahs.filter(s => s.name.includes(q) || s.nameLatin.toLowerCase().includes(q.toLowerCase()))
  if (type === 'مكية' || type === 'مدنية') surahs = surahs.filter(s => s.type === type)

  return (
    <>
      <Header />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'سور القرآن' }]} />
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">
              <span class="icon-deco"><IconBookOpen size={18} /></span>
              سور القرآن الكريم
            </h2>
            <span class="section-subtitle">{surahs.length} سورة</span>
          </div>
        </div>

        <form method="get" action="/surahs" class="card mb-6" style="padding:1.25rem">
          <div class="flex flex-wrap gap-3 items-center">
            <input type="text" name="q" class="input" value={q} placeholder="ابحث باسم السورة..." style="flex:1;min-width:200px" />
            <select name="type" class="select" style="min-width:140px">
              <option value="">— كل السور —</option>
              <option value="مكية" selected={type === 'مكية'}>المكية</option>
              <option value="مدنية" selected={type === 'مدنية'}>المدنية</option>
            </select>
            <button type="submit" class="btn btn-primary"><IconSearch size={16} /> تطبيق</button>
          </div>
        </form>

        <div class="feature-grid">
          {surahs.map(s => {
            const cov = getSurahCoverage(s.number)!
            return (
              <a href={`/surahs/${s.number}`} class="feature-card" style="text-decoration:none;display:block">
                <div class="flex items-center gap-3 mb-2">
                  <div class="ayah-number-circle" style="margin:0">{s.number}</div>
                  <div style="flex:1">
                    <div class="feature-title" style="margin:0">{s.name}</div>
                    <div class="text-sm text-tertiary">{s.nameLatin}</div>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span class="badge">{s.type}</span>
                  <span class="badge badge-outline"><IconHash size={11} /> {s.ayahCount} آية</span>
                  {cov.tafseersCount > 0 ? <span class="badge badge-gold">{cov.tafseersCount} تفسير</span> : null}
                  <span class={`badge ${completenessClass(cov.completeness)}`} title={`التغطية: ${cov.tafseerCoveragePercent}% من آيات السورة`}>
                    {completenessLabel(cov.completeness)}
                  </span>
                </div>
                <div class="coverage-bar mt-2" aria-label={`نسبة التغطية ${cov.tafseerCoveragePercent}%`}>
                  <span style={`width:${Math.min(100, cov.tafseerCoveragePercent)}%`}></span>
                </div>
              </a>
            )
          })}
        </div>
      </main>
      <Footer />
      <Toast />
    </>
  )
}

export const SurahDetailPage = ({ surahNumber }: { surahNumber: number }) => {
  const surah = getSurahByNumber(surahNumber)
  if (!surah) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <div class="empty-state card"><h3>السورة غير موجودة</h3></div>
        </main>
        <Footer />
      </>
    )
  }
  const ayahs = getAyahsBySurah(surahNumber)

  return (
    <>
      <Header />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'سور القرآن', href: '/surahs' },
          { label: `سورة ${surah.name}` },
        ]} />

        <div class="card card-elevated mb-6" style="padding:2rem;text-align:center">
          <div class="ayah-meta" style="margin-bottom:1rem">
            <IconBookOpen size={14} /> <span>{surah.type}</span> · <span>{surah.ayahCount} آية</span>
          </div>
          <h1>سورة {surah.name}</h1>
          <p class="text-tertiary">{surah.nameLatin}</p>
          <div class="flex flex-wrap gap-2 mt-4" style="justify-content:center">
            <a href={`/read/${surah.number}`} class="btn btn-primary">
              <IconBookOpen size={16} /> قراءة متسلسلة (آيات + تفاسير)
            </a>
            <a href={`/compare?surah=${surah.number}&ayah=1`} class="btn btn-secondary">
              مقارنة تفاسير الآية الأولى
            </a>
          </div>
          {(() => {
            const cov = getSurahCoverage(surah.number)!
            return (
              <div class="coverage-card mt-4" aria-label="نسبة تغطية السورة">
                <div class="flex flex-wrap gap-3" style="justify-content:center">
                  <span class="badge badge-outline">آيات متاحة: <strong>{cov.availableAyahs}</strong> / {cov.totalAyahs}</span>
                  <span class="badge badge-outline">آيات لها تفسير: <strong>{cov.ayahsWithTafseer}</strong></span>
                  <span class="badge badge-outline">إجمالي التفاسير: <strong>{cov.tafseersCount}</strong></span>
                  <span class={`badge ${completenessClass(cov.completeness)}`}>{completenessLabel(cov.completeness)} · {cov.tafseerCoveragePercent}%</span>
                </div>
                <div class="coverage-bar mt-3" aria-hidden="true">
                  <span style={`width:${Math.min(100, cov.tafseerCoveragePercent)}%`}></span>
                </div>
              </div>
            )
          })()}
        </div>

        {ayahs.length > 0 ? (
          <section>
            <h2 class="section-title mb-4">
              <span class="icon-deco"><IconHash size={18} /></span>
              الآيات المتاحة في العينة
            </h2>
            <div class="flex" style="flex-direction:column;gap:1rem">
              {ayahs.map(a => {
                const tafCount = TAFSEERS.filter(t => t.surah === a.surah && t.ayah === a.number).length
                return (
                  <a href={`/ayah/${a.surah}/${a.number}`} class="result-item" style="text-decoration:none;color:inherit;display:block">
                    <div class="result-meta">
                      <span class="badge">آية {a.number}</span>
                      {tafCount > 0 ? <span class="badge badge-gold">{tafCount} تفسير</span> : null}
                    </div>
                    <div class="result-ayah">{a.text}</div>
                    <div class="result-link">افتح الآية <IconArrowRightCircle size={14} /></div>
                  </a>
                )
              })}
            </div>
          </section>
        ) : (
          <div class="empty-state card">
            <h3>لا توجد آيات من هذه السورة في العينة الحالية</h3>
            <p>التطبيق يعرض عينة من الآيات. يمكن استيراد المزيد عبر مسار /admin/import.</p>
          </div>
        )}
      </main>
      <Footer />
      <Toast />
    </>
  )
}
