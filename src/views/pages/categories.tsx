// صفحات البحث الموضوعي
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconLayers, IconArrowRightCircle, IconQuote, IconBook, IconShield } from '../icons'
import { CATEGORIES, getCategoryById } from '../../data/categories'
import { getAyah } from '../../data/ayahs'
import { getSurahByNumber } from '../../data/surahs'
import { getTafseersByAyah } from '../../data/tafseers'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'

export const CategoriesPage = () => (
  <>
    <Header active="categories" />
    <main class="container" style="padding-top:1.5rem">
      <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'البحث الموضوعي' }]} />

      <div class="section-header">
        <div class="section-title-wrap">
          <h2 class="section-title">
            <span class="icon-deco"><IconLayers size={18} /></span>
            البحث الموضوعي
          </h2>
          <span class="section-subtitle">استعرض الآيات والتفاسير حسب الموضوع</span>
        </div>
      </div>

      <div class="card mb-6" style="padding:1rem;border-style:dashed">
        <div class="flex items-center gap-2">
          <IconShield size={18} class="text-accent" />
          <span class="text-sm text-tertiary">
            <strong>تنبيه:</strong> النتائج هنا مبنية على فهرسة موضوعية للآيات وليست فتوى شرعية.
            ارجع إلى أهل العلم في المسائل العملية.
          </span>
        </div>
      </div>

      <div class="feature-grid">
        {CATEGORIES.map(c => (
          <a href={`/categories/${c.id}`} class="feature-card" style="text-decoration:none;display:block">
            <div class="feature-icon"><IconLayers /></div>
            <div class="feature-title">{c.name}</div>
            <div class="feature-desc">{c.description}</div>
            <div class="mt-2 flex items-center gap-2">
              <span class="badge">{c.ayahRefs.length} آية</span>
              <span class="result-link" style="margin-inline-start:auto">استكشف <IconArrowRightCircle size={14} /></span>
            </div>
          </a>
        ))}
      </div>
    </main>
    <Footer />
    <Toast />
  </>
)

export const CategoryDetailPage = ({ id }: { id: string }) => {
  const cat = getCategoryById(id)
  if (!cat) {
    return (
      <>
        <Header />
        <main class="container" style="padding:3rem 0">
          <div class="empty-state card">
            <h3>الموضوع غير موجود</h3>
            <p><a href="/categories" class="text-accent">العودة للموضوعات</a></p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header active="categories" />
      <main class="container" style="padding-top:1.5rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'الموضوعات', href: '/categories' },
          { label: cat.name },
        ]} />

        <div class="card card-elevated mb-6" style="padding:2rem">
          <div class="flex gap-4 items-center flex-wrap">
            <div class="feature-icon" style="width:64px;height:64px"><IconLayers size={28} /></div>
            <div style="flex:1;min-width:240px">
              <h1>{cat.name}</h1>
              <p class="text-tertiary">{cat.description}</p>
              <span class="badge mt-2">{cat.ayahRefs.length} آية في هذا الموضوع</span>
            </div>
          </div>
        </div>

        <h2 class="section-title mb-4">
          <span class="icon-deco"><IconQuote size={18} /></span>
          الآيات المرتبطة
        </h2>

        <div class="flex" style="flex-direction:column;gap:1rem">
          {cat.ayahRefs.map(ref => {
            const surah = getSurahByNumber(ref.surah)!
            const ayah = getAyah(ref.surah, ref.ayah)
            const tafseers = getTafseersByAyah(ref.surah, ref.ayah)
            return (
              <article class="result-item">
                <div class="result-meta">
                  <span class="badge"><IconBook size={12} /> {surah.name}</span>
                  <span class="badge">آية {ref.ayah}</span>
                  <span class="badge badge-outline">{tafseers.length} تفسير</span>
                </div>
                {ayah ? (
                  <div class="result-ayah">{ayah.text}</div>
                ) : (
                  <div class="text-tertiary">نص الآية غير متوفر في العينة</div>
                )}
                <a href={`/ayah/${ref.surah}/${ref.ayah}`} class="result-link">
                  افتح الآية والتفاسير <IconArrowRightCircle size={14} />
                </a>
              </article>
            )
          })}
        </div>
      </main>
      <Footer />
      <Toast />
    </>
  )
}
