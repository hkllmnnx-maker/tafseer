// صفحة البحث المتقدم
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconSearch, IconFilter, IconHash, IconBookOpen, IconArrowRightCircle,
  IconQuote, IconShield,
} from '../icons'
import { SURAHS } from '../../data/surahs'
import { BOOKS, type TafseerSchool } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { search, type SearchFilters, type SearchResults } from '../../lib/search'
import { highlightText, escapeHtml } from '../../lib/normalize'
import {
  SOURCE_TYPES, VERIFICATION_STATUSES,
  getSourceTypeMeta, getVerificationMeta,
} from '../../lib/scientific'
import { SourceTypeBadge, VerificationBadge } from '../components/badges'

const SCHOOLS: TafseerSchool[] = ['بالمأثور', 'بالرأي', 'فقهي', 'لغوي', 'بلاغي', 'معاصر', 'ميسر', 'موسوعي']

export const SearchPage = ({
  filters,
  results,
}: {
  filters: SearchFilters
  results: SearchResults
}) => {
  const buildQuery = (extra: Record<string, any> = {}) => {
    const params = new URLSearchParams()
    const merged = { ...filters, ...extra }
    Object.entries(merged).forEach(([k, v]) => {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return
      if (Array.isArray(v)) v.forEach(item => params.append(k, String(item)))
      else params.set(k, String(v))
    })
    return params.toString()
  }

  return (
    <>
      <Header active="search" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'البحث المتقدم' }]} />

        {/* Top search */}
        <form method="get" action="/search" class="card mb-6" style="padding:1.5rem">
          <div class="search-box">
            <span class="search-icon"><IconSearch /></span>
            <input
              type="text"
              name="q"
              class="search-input"
              placeholder="ابحث عن كلمة أو عبارة في نصوص التفسير والآيات..."
              value={filters.q || ''}
              autocomplete="off"
            />
            <button type="submit" class="btn btn-primary search-submit">
              بحث <IconArrowRightCircle size={18} />
            </button>
          </div>

          <div class="flex flex-wrap gap-3 mt-4">
            {/* Surah */}
            <div style="min-width:180px;flex:1">
              <label class="field-label">السورة</label>
              <select class="select" name="surah">
                <option value="">— كل السور —</option>
                {SURAHS.map(s => (
                  <option value={s.number} selected={filters.surah === s.number}>
                    {s.number}. {s.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Ayah from */}
            <div style="min-width:120px;flex:1">
              <label class="field-label">من آية</label>
              <input type="number" min="1" class="input" name="ayahFrom" value={filters.ayahFrom || ''} placeholder="1" />
            </div>
            <div style="min-width:120px;flex:1">
              <label class="field-label">إلى آية</label>
              <input type="number" min="1" class="input" name="ayahTo" value={filters.ayahTo || ''} placeholder="" />
            </div>
            {/* Search in */}
            <div style="min-width:180px;flex:1">
              <label class="field-label">البحث في</label>
              <select class="select" name="searchIn">
                <option value="all" selected={!filters.searchIn || filters.searchIn === 'all'}>نصوص الآية والتفسير</option>
                <option value="tafseer" selected={filters.searchIn === 'tafseer'}>نص التفسير فقط</option>
                <option value="ayah" selected={filters.searchIn === 'ayah'}>نص الآية فقط</option>
              </select>
            </div>
            {/* Sort */}
            <div style="min-width:160px;flex:1">
              <label class="field-label">الترتيب</label>
              <select class="select" name="sort">
                <option value="relevance" selected={!filters.sort || filters.sort === 'relevance'}>حسب الصلة</option>
                <option value="oldest" selected={filters.sort === 'oldest'}>الأقدم</option>
                <option value="newest" selected={filters.sort === 'newest'}>الأحدث</option>
                <option value="book" selected={filters.sort === 'book'}>اسم الكتاب</option>
                <option value="author" selected={filters.sort === 'author'}>اسم المؤلف</option>
              </select>
            </div>
          </div>

          <div class="flex flex-wrap gap-4 mt-4">
            <label class="filter-option" style="padding:0">
              <input type="checkbox" name="exactMatch" value="1" checked={!!filters.exactMatch} />
              <span>تطابق تام (exact)</span>
            </label>
            <label class="filter-option" style="padding:0">
              <input type="checkbox" name="fuzzy" value="1" checked={!!filters.fuzzy} />
              <span>بحث تقريبي (fuzzy)</span>
            </label>
            <span class="text-sm text-tertiary" style="margin-inline-start:auto">
              {results.total > 0
                ? <>وجدنا <strong>{results.total.toLocaleString('ar-EG')}</strong> نتيجة في <strong>{results.took}</strong> مللي ثانية</>
                : <>لا توجد نتائج بعد - استخدم الفلاتر للبدء</>
              }
            </span>
          </div>
        </form>

        <div class="search-layout">
          {/* Filters Sidebar */}
          <aside class="filter-panel">
            <form method="get" action="/search">
              {/* Carry over query */}
              <input type="hidden" name="q" value={filters.q || ''} />
              {filters.surah ? <input type="hidden" name="surah" value={filters.surah} /> : null}
              {filters.searchIn ? <input type="hidden" name="searchIn" value={filters.searchIn} /> : null}
              {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}

              <div class="filter-group">
                <div class="filter-title">
                  <span><IconFilter size={14} /> المدرسة التفسيرية</span>
                </div>
                <div class="filter-options">
                  {SCHOOLS.map(s => (
                    <label class="filter-option">
                      <input
                        type="checkbox" name="schools" value={s}
                        checked={filters.schools?.includes(s)}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-title">الكتاب</div>
                <div class="filter-options" style="max-height:240px;overflow-y:auto">
                  {BOOKS.map(b => (
                    <label class="filter-option">
                      <input
                        type="checkbox" name="bookIds" value={b.id}
                        checked={filters.bookIds?.includes(b.id)}
                      />
                      <span class="text-sm">{b.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-title">المؤلف</div>
                <div class="filter-options" style="max-height:200px;overflow-y:auto">
                  {AUTHORS.map(a => (
                    <label class="filter-option">
                      <input
                        type="checkbox" name="authorIds" value={a.id}
                        checked={filters.authorIds?.includes(a.id)}
                      />
                      <span class="text-sm">{a.name} (ت {a.deathYear}هـ)</span>
                    </label>
                  ))}
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-title">القرن (هجري)</div>
                <div class="flex gap-2">
                  <input type="number" name="centuryFrom" placeholder="من" class="input"
                    value={filters.centuryFrom || ''} min="1" max="15" style="font-size:.85rem" />
                  <input type="number" name="centuryTo" placeholder="إلى" class="input"
                    value={filters.centuryTo || ''} min="1" max="15" style="font-size:.85rem" />
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-title">
                  <span><IconQuote size={14} /> نوع المصدر</span>
                </div>
                <div class="filter-options">
                  {SOURCE_TYPES.map(s => {
                    const m = getSourceTypeMeta(s)
                    return (
                      <label class="filter-option" title={m.description}>
                        <input
                          type="checkbox" name="sourceTypes" value={s}
                          checked={filters.sourceTypes?.includes(s)}
                        />
                        <span class="text-sm">{m.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div class="filter-group">
                <div class="filter-title">
                  <span><IconShield size={14} /> حالة التحقق</span>
                </div>
                <div class="filter-options">
                  {VERIFICATION_STATUSES.map(v => {
                    const m = getVerificationMeta(v)
                    return (
                      <label class="filter-option" title={m.description}>
                        <input
                          type="checkbox" name="verificationStatuses" value={v}
                          checked={filters.verificationStatuses?.includes(v)}
                        />
                        <span class="text-sm">{m.label}</span>
                      </label>
                    )
                  })}
                </div>
                <a href="/methodology" class="text-accent text-xs" style="display:block;margin-top:.4rem">
                  ما معنى هذه الحالات؟ ↗
                </a>
              </div>

              <div class="filter-group">
                <button type="submit" class="btn btn-primary" style="width:100%">
                  تطبيق الفلاتر
                </button>
                <a href="/search" class="btn btn-ghost btn-sm mt-2" style="width:100%;display:flex">
                  مسح الفلاتر
                </a>
              </div>
            </form>
          </aside>

          {/* Results */}
          <section>
            {results.items.length === 0 ? (
              <EmptyResults q={filters.q || ''} hasFilters={hasAnyFilter(filters)} />
            ) : (
              <>
                <div class="flex flex-wrap gap-2 mb-4">
                  {filters.schools?.map(s => (
                    <span class="chip active">{s}</span>
                  ))}
                  {filters.bookIds?.map(id => {
                    const b = BOOKS.find(x => x.id === id)
                    return b ? <span class="chip active">{b.title}</span> : null
                  })}
                  {filters.authorIds?.map(id => {
                    const a = AUTHORS.find(x => x.id === id)
                    return a ? <span class="chip active">{a.name}</span> : null
                  })}
                  {filters.surah ? (
                    <span class="chip active">سورة {SURAHS.find(s => s.number === filters.surah)?.name}</span>
                  ) : null}
                </div>

                <div class="flex flex-wrap" style="flex-direction:column;gap:1rem">
                  {results.items.map(item => (
                    <article class="result-item">
                      <div class="result-meta flex flex-wrap items-center gap-2">
                        <span class="badge"><IconBookOpen size={12} /> {item.surahName}</span>
                        <span class="badge"><IconHash size={12} /> آية {item.ayah}</span>
                        <span class="badge badge-gold">{item.bookTitle}</span>
                        <span class="text-xs text-tertiary">— {item.authorName}</span>
                        <SourceTypeBadge type={item.sourceType} />
                        <VerificationBadge status={item.verificationStatus} />
                      </div>
                      {item.ayahText && (
                        <div class="result-ayah" dangerouslySetInnerHTML={{
                          __html: highlightText(item.ayahText, filters.q || '')
                        }} />
                      )}
                      <div class="result-snippet" dangerouslySetInnerHTML={{
                        __html: highlightText(item.snippet, filters.q || '')
                      }} />
                      <a href={`/ayah/${item.surah}/${item.ayah}`} class="result-link">
                        <IconQuote size={14} />
                        افتح الآية وقارن التفاسير
                        <IconArrowRightCircle size={14} />
                      </a>
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                {results.totalPages > 1 && (
                  <Pagination
                    page={results.page}
                    totalPages={results.totalPages}
                    buildQuery={buildQuery}
                  />
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <Toast />
    </>
  )
}

const Pagination = ({ page, totalPages, buildQuery }: any) => {
  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div class="pagination">
      <a href={`/search?${buildQuery({ page: 1 })}`} aria-label="الأولى">
        <button disabled={page === 1}>الأولى</button>
      </a>
      <a href={`/search?${buildQuery({ page: Math.max(1, page - 1) })}`}>
        <button disabled={page === 1}>السابق</button>
      </a>
      {pages.map(p => (
        <a href={`/search?${buildQuery({ page: p })}`}>
          <button class={p === page ? 'active' : ''}>{p}</button>
        </a>
      ))}
      <a href={`/search?${buildQuery({ page: Math.min(totalPages, page + 1) })}`}>
        <button disabled={page === totalPages}>التالي</button>
      </a>
      <a href={`/search?${buildQuery({ page: totalPages })}`}>
        <button disabled={page === totalPages}>الأخيرة</button>
      </a>
    </div>
  )
}

const EmptyResults = ({ q, hasFilters }: { q: string; hasFilters: boolean }) => (
  <div class="empty-state card">
    <div class="empty-icon"><IconSearch size={28} /></div>
    {q || hasFilters ? (
      <>
        <h3>لا توجد نتائج مطابقة</h3>
        <p>جرّب تغيير الكلمات المفتاحية أو إزالة بعض الفلاتر، أو فعّل البحث التقريبي (fuzzy).</p>
      </>
    ) : (
      <>
        <h3>ابدأ البحث في كتب التفسير</h3>
        <p>اكتب كلمة في صندوق البحث، أو اختر سورة وآية محددة، أو فلتر حسب الكتاب أو المؤلف.</p>
      </>
    )}
  </div>
)

function hasAnyFilter(f: SearchFilters): boolean {
  return !!(
    f.surah || f.ayahFrom || f.ayahTo ||
    (f.bookIds?.length) || (f.authorIds?.length) || (f.schools?.length) ||
    f.centuryFrom || f.centuryTo
  )
}
