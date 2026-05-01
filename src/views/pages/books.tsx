// صفحة كتب التفسير
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconBook, IconArrowRightCircle, IconUser, IconHash, IconSearch, IconExternal } from '../icons'
import { BOOKS, type TafseerSchool } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { TAFSEERS } from '../../data/tafseers'

export const BooksPage = ({
  q = '',
  school = '',
  sort = 'popular',
}: { q?: string; school?: string; sort?: string }) => {
  const SCHOOLS: TafseerSchool[] = ['بالمأثور', 'بالرأي', 'فقهي', 'لغوي', 'بلاغي', 'معاصر', 'ميسر', 'موسوعي']

  let books = [...BOOKS]
  if (q) {
    const nq = q.toLowerCase()
    books = books.filter(b => {
      const a = AUTHORS.find(x => x.id === b.authorId)
      return (
        b.title.includes(q) ||
        b.fullTitle.includes(q) ||
        b.description.includes(q) ||
        a?.name.includes(q) ||
        a?.fullName.includes(q)
      )
    })
  }
  if (school) {
    books = books.filter(b => b.schools.includes(school as TafseerSchool))
  }
  if (sort === 'popular') books.sort((a, b) => b.popularity - a.popularity)
  else if (sort === 'oldest') {
    books.sort((a, b) => {
      const aa = AUTHORS.find(x => x.id === a.authorId)?.deathYear || 0
      const bb = AUTHORS.find(x => x.id === b.authorId)?.deathYear || 0
      return aa - bb
    })
  } else if (sort === 'newest') {
    books.sort((a, b) => {
      const aa = AUTHORS.find(x => x.id === a.authorId)?.deathYear || 0
      const bb = AUTHORS.find(x => x.id === b.authorId)?.deathYear || 0
      return bb - aa
    })
  } else if (sort === 'title') {
    books.sort((a, b) => a.title.localeCompare(b.title, 'ar'))
  }

  return (
    <>
      <Header active="books" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'كتب التفسير' }]} />

        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">
              <span class="icon-deco"><IconBook size={18} /></span>
              كتب التفسير
            </h2>
            <span class="section-subtitle">
              {books.length.toLocaleString('ar-EG')} كتاب من أمهات كتب التفسير
            </span>
          </div>
        </div>

        <form method="get" action="/books" class="card mb-6" style="padding:1.25rem">
          <div class="flex flex-wrap gap-3 items-center">
            <div style="position:relative;flex:1;min-width:240px">
              <input type="text" name="q" class="input" value={q} placeholder="ابحث عن اسم كتاب أو مؤلف..." />
            </div>
            <select name="school" class="select" style="min-width:160px">
              <option value="">— كل المدارس —</option>
              {SCHOOLS.map(s => <option value={s} selected={school === s}>{s}</option>)}
            </select>
            <select name="sort" class="select" style="min-width:160px">
              <option value="popular" selected={sort === 'popular'}>الأشهر</option>
              <option value="oldest" selected={sort === 'oldest'}>الأقدم</option>
              <option value="newest" selected={sort === 'newest'}>الأحدث</option>
              <option value="title" selected={sort === 'title'}>اسم الكتاب</option>
            </select>
            <button type="submit" class="btn btn-primary">
              <IconSearch size={16} /> تطبيق
            </button>
          </div>
        </form>

        {books.length === 0 ? (
          <div class="empty-state card">
            <h3>لا توجد كتب مطابقة</h3>
            <p>جرّب كلمات بحث مختلفة أو امسح الفلاتر.</p>
          </div>
        ) : (
          <div class="book-grid">
            {books.map(b => {
              const author = AUTHORS.find(a => a.id === b.authorId)!
              const tafseerCount = TAFSEERS.filter(t => t.bookId === b.id).length
              return (
                <a href={`/books/${b.id}`} class="book-card" style="text-decoration:none;color:inherit">
                  <div class="book-cover">
                    <svg class="book-cover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h6" />
                    </svg>
                  </div>
                  <div class="book-body">
                    <div class="book-title">{b.title}</div>
                    <div class="book-author">
                      <IconUser size={12} style="display:inline" /> {author.name} (ت {author.deathYear}هـ)
                    </div>
                    <div class="book-tags">
                      {b.schools.map(s => <span class="badge">{s}</span>)}
                    </div>
                    <div class="book-desc">{b.description}</div>
                    <div class="book-footer">
                      <span class="text-tertiary text-xs flex items-center gap-1">
                        <IconHash size={12} /> {tafseerCount} تفسير مفهرس
                      </span>
                      <span class="result-link">
                        التفاصيل <IconArrowRightCircle size={14} />
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
      <Toast />
    </>
  )
}

export const BookDetailPage = ({ bookId }: { bookId: string }) => {
  const book = BOOKS.find(b => b.id === bookId)
  if (!book) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <div class="empty-state card">
            <h3>الكتاب غير موجود</h3>
            <p><a href="/books" class="text-accent">العودة لقائمة الكتب</a></p>
          </div>
        </main>
        <Footer />
      </>
    )
  }
  const author = AUTHORS.find(a => a.id === book.authorId)!
  const tafseers = TAFSEERS.filter(t => t.bookId === book.id)

  return (
    <>
      <Header active="books" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'كتب التفسير', href: '/books' },
          { label: book.title },
        ]} />

        <div class="card card-elevated mb-6" style="padding:2rem">
          <div class="flex gap-4 flex-wrap">
            <div class="book-cover" style="width:140px;height:180px;border-radius:var(--radius-md);flex-shrink:0">
              <svg class="book-cover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h6" />
              </svg>
            </div>
            <div style="flex:1;min-width:240px">
              <h1 style="margin-bottom:.5rem">{book.title}</h1>
              <p class="text-tertiary mb-4">{book.fullTitle}</p>
              <div class="flex flex-wrap gap-2 mb-4">
                {book.schools.map(s => <span class="badge">{s}</span>)}
                {book.volumes ? <span class="badge badge-gold">{book.volumes} مجلد</span> : null}
                <span class="badge badge-outline">{tafseers.length} تفسير مفهرس</span>
              </div>
              <p style="line-height:1.9">{book.description}</p>
              <div class="flex gap-2 mt-4">
                <a href={`/authors/${author.id}`} class="btn btn-secondary">
                  <IconUser size={16} /> صفحة المؤلف: {author.name}
                </a>
                <a href={`/search?bookIds=${book.id}`} class="btn btn-primary">
                  <IconSearch size={16} /> ابحث داخل هذا الكتاب
                </a>
              </div>
            </div>
          </div>
        </div>

        {tafseers.length > 0 && (
          <section>
            <h2 class="section-title mb-4">
              <span class="icon-deco"><IconHash size={18} /></span>
              مقتطفات من تفاسير الكتاب
            </h2>
            <div class="tafseer-list">
              {tafseers.slice(0, 8).map(t => (
                <a href={`/ayah/${t.surah}/${t.ayah}`} class="tafseer-card" style="text-decoration:none;color:inherit;display:block">
                  <header class="tafseer-header">
                    <div class="tafseer-book-info">
                      <div class="tafseer-book-cover-mini"><IconBook size={20} /></div>
                      <div class="tafseer-book-meta">
                        <div class="tafseer-book-name">سورة {t.surah} - آية {t.ayah}</div>
                        <div class="tafseer-author-name">انقر لفتح الآية وكل التفاسير</div>
                      </div>
                    </div>
                    <IconExternal size={16} />
                  </header>
                  <div class="tafseer-body" style="max-height:140px;overflow:hidden;position:relative">
                    {t.text.slice(0, 200)}…
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <Toast />
    </>
  )
}
