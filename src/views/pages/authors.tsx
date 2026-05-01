// صفحة المؤلفين والمفسرين
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconUser, IconArrowRightCircle, IconBook, IconCalendar, IconSearch } from '../icons'
import { AUTHORS } from '../../data/authors'
import { BOOKS } from '../../data/books'

export const AuthorsPage = ({ q = '', sort = 'oldest' }: { q?: string; sort?: string }) => {
  let authors = [...AUTHORS]
  if (q) {
    authors = authors.filter(a => a.name.includes(q) || a.fullName.includes(q) || a.bio.includes(q))
  }
  if (sort === 'oldest') authors.sort((a, b) => a.deathYear - b.deathYear)
  else if (sort === 'newest') authors.sort((a, b) => b.deathYear - a.deathYear)
  else if (sort === 'name') authors.sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <>
      <Header active="authors" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'المؤلفون' }]} />
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">
              <span class="icon-deco"><IconUser size={18} /></span>
              المؤلفون والمفسرون
            </h2>
            <span class="section-subtitle">{authors.length} مؤلف من كبار أئمة التفسير</span>
          </div>
        </div>

        <form method="get" action="/authors" class="card mb-6" style="padding:1.25rem">
          <div class="flex flex-wrap gap-3 items-center">
            <input type="text" name="q" class="input" value={q} placeholder="ابحث بالاسم..." style="flex:1;min-width:240px" />
            <select name="sort" class="select" style="min-width:160px">
              <option value="oldest" selected={sort === 'oldest'}>الأقدم</option>
              <option value="newest" selected={sort === 'newest'}>الأحدث</option>
              <option value="name" selected={sort === 'name'}>الاسم</option>
            </select>
            <button type="submit" class="btn btn-primary"><IconSearch size={16} /> تطبيق</button>
          </div>
        </form>

        <div class="feature-grid">
          {authors.map(a => {
            const books = BOOKS.filter(b => b.authorId === a.id)
            return (
              <a href={`/authors/${a.id}`} class="feature-card" style="text-decoration:none;color:inherit;display:block">
                <div class="feature-icon"><IconUser /></div>
                <div class="feature-title">{a.name}</div>
                <div class="text-sm text-tertiary mb-2">{a.fullName}</div>
                <div class="flex flex-wrap gap-2 mb-2">
                  <span class="badge badge-outline"><IconCalendar size={11} /> ت {a.deathYear}هـ</span>
                  <span class="badge"><IconBook size={11} /> {books.length} كتاب</span>
                  {a.school ? <span class="badge badge-gold">{a.school}</span> : null}
                </div>
                <div class="feature-desc" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">{a.bio}</div>
                <div class="result-link mt-2">السيرة <IconArrowRightCircle size={14} /></div>
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

export const AuthorDetailPage = ({ authorId }: { authorId: string }) => {
  const a = AUTHORS.find(x => x.id === authorId)
  if (!a) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <div class="empty-state card">
            <h3>المؤلف غير موجود</h3>
            <p><a href="/authors" class="text-accent">العودة للمؤلفين</a></p>
          </div>
        </main>
        <Footer />
      </>
    )
  }
  const books = BOOKS.filter(b => b.authorId === a.id)

  return (
    <>
      <Header active="authors" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'المؤلفون', href: '/authors' },
          { label: a.name },
        ]} />

        <div class="card card-elevated mb-6" style="padding:2rem">
          <div class="flex gap-4 flex-wrap items-center" style="align-items:flex-start">
            <div class="feature-icon" style="width:80px;height:80px"><IconUser size={36} /></div>
            <div style="flex:1;min-width:240px">
              <h1 style="margin-bottom:.25rem">{a.name}</h1>
              <p class="text-tertiary mb-3">{a.fullName}</p>
              <div class="flex flex-wrap gap-2 mb-3">
                <span class="badge badge-outline"><IconCalendar size={11} /> ت {a.deathYear}هـ {a.deathYearAD ? `/ ${a.deathYearAD}م` : ''}</span>
                <span class="badge">القرن {a.century}هـ</span>
                {a.origin ? <span class="badge badge-gold">{a.origin}</span> : null}
                {a.school ? <span class="badge">{a.school}</span> : null}
              </div>
              <p style="line-height:1.95">{a.bio}</p>
            </div>
          </div>
        </div>

        <h2 class="section-title mb-4">
          <span class="icon-deco"><IconBook size={18} /></span>
          مؤلفاته في التفسير
        </h2>
        {books.length === 0 ? (
          <div class="empty-state card"><p>لا توجد كتب مدرجة لهذا المؤلف بعد.</p></div>
        ) : (
          <div class="book-grid">
            {books.map(b => (
              <a href={`/books/${b.id}`} class="book-card" style="text-decoration:none;color:inherit">
                <div class="book-cover">
                  <svg class="book-cover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    <path d="M8 7h8" /><path d="M8 11h8" />
                  </svg>
                </div>
                <div class="book-body">
                  <div class="book-title">{b.title}</div>
                  <div class="book-tags">
                    {b.schools.slice(0, 2).map(s => <span class="badge">{s}</span>)}
                  </div>
                  <div class="book-desc">{b.description}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
      <Footer />
      <Toast />
    </>
  )
}
