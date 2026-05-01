// الصفحة الرئيسية
import { Header, Footer, Toast } from '../components/layout'
import {
  IconSearch, IconBookOpen, IconHash, IconLayers, IconBook,
  IconDatabase, IconQuote, IconUser, IconSparkles, IconBolt,
  IconShield, IconStar, IconArrowRightCircle, IconCompare, IconCalendar,
} from '../icons'
import { SURAHS } from '../../data/surahs'
import { BOOKS } from '../../data/books'
import { AUTHORS } from '../../data/authors'
import { CATEGORIES } from '../../data/categories'
import { getStats } from '../../lib/search'

export const HomePage = () => {
  const stats = getStats()
  const featuredBooks = BOOKS.filter(b => b.featured).slice(0, 6)
  const popularAyahs = [
    { surah: 1, ayah: 1, label: 'الفاتحة - البسملة' },
    { surah: 2, ayah: 255, label: 'آية الكرسي' },
    { surah: 112, ayah: 1, label: 'الإخلاص' },
    { surah: 2, ayah: 183, label: 'الصيام' },
    { surah: 36, ayah: 1, label: 'يس' },
    { surah: 67, ayah: 1, label: 'الملك' },
  ]

  return (
    <>
      <Header active="home" />

      {/* Hero */}
      <section class="hero">
        <div class="container hero-inner">
          <div class="hero-badge fade-in">
            <IconSparkles size={16} />
            <span>أداة بحثية متقدمة في كتب التفسير</span>
          </div>
          <h1 class="fade-in-delay-1">تفسير</h1>
          <p class="hero-subtitle fade-in-delay-2">
            بوابة علمية للبحث في معاني القرآن الكريم؛ تجمع أبرز كتب التفسير،
            وتتيح لك البحث بالآية أو السورة أو الكلمة أو المؤلف بأدوات دقيقة وواجهة عربية أصيلة.
          </p>

          <form action="/search" method="get" class="hero-search fade-in-delay-3">
            <div class="search-box">
              <span class="search-icon"><IconSearch /></span>
              <input
                type="text"
                name="q"
                class="search-input"
                placeholder="ابحث عن آية أو كلمة أو اسم سورة..."
                autocomplete="off"
                aria-label="مربع البحث"
              />
              <button type="submit" class="btn btn-primary search-submit">
                بحث
                <IconArrowRightCircle size={18} />
              </button>
            </div>
            <div class="quick-actions">
              <a href="/search?mode=ayah" class="chip">
                <IconHash size={14} /> البحث في آية
              </a>
              <a href="/search?mode=surah" class="chip">
                <IconBookOpen size={14} /> البحث في سورة
              </a>
              <a href="/books" class="chip">
                <IconBook size={14} /> البحث في كتاب
              </a>
              <a href="/categories" class="chip">
                <IconLayers size={14} /> البحث الموضوعي
              </a>
              <a href="/compare" class="chip">
                <IconCompare size={14} /> المقارنة
              </a>
            </div>
          </form>
        </div>
      </section>

      {/* Recent (last visited ayahs) - hidden by default, populated by app.js if any history */}
      <section class="section" id="home-recent-section" style="padding-top:1.5rem;display:none">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">
                <span class="icon-deco"><IconCalendar size={18} /></span>
                تابع من حيث توقفت
              </h2>
              <span class="section-subtitle">آخر الآيات التي تصفّحتها (محليًا في متصفّحك)</span>
            </div>
            <a href="/history" class="btn btn-ghost btn-sm">
              كل السجل <IconArrowRightCircle size={14} />
            </a>
          </div>
          <div id="home-recent-list" class="recent-chips"></div>
        </div>
      </section>

      {/* Stats */}
      <section class="section" style="padding-top:1.5rem">
        <div class="container">
          <div class="stats-grid">
            <StatCard icon={<IconBook />} label="كتاب تفسير" value={stats.booksCount} />
            <StatCard icon={<IconUser />} label="مؤلف ومفسر" value={stats.authorsCount} />
            <StatCard icon={<IconBookOpen />} label="سور القرآن" value={stats.surahsCount} />
            <StatCard icon={<IconQuote />} label="نص تفسير مفهرس" value={stats.tafseersCount} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section class="section">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">
                <span class="icon-deco"><IconSparkles size={18} /></span>
                مزايا التطبيق
              </h2>
              <span class="section-subtitle">أدوات علمية تجعل البحث في التفسير أيسر وأدق</span>
            </div>
          </div>
          <div class="feature-grid">
            <FeatureCard
              icon={<IconBolt />}
              title="بحث سريع ودقيق"
              desc="محرك بحث ذكي يدعم تطبيع النصوص العربية، التشكيل، الهمزات، وحالات ة/ه و ى/ي تلقائيًا."
            />
            <FeatureCard
              icon={<IconLayers />}
              title="تفاسير متعددة"
              desc="قارن بين أقوال كبار المفسرين في الآية الواحدة جنبًا إلى جنب بطريقة منظمة."
            />
            <FeatureCard
              icon={<IconShield />}
              title="مصادر موثقة"
              desc="كل بطاقة تفسير تحمل اسم الكتاب والمؤلف ومصدر النص حتى تتحقق وتراجع."
            />
            <FeatureCard
              icon={<IconHash />}
              title="فلاتر متقدمة"
              desc="فلتر حسب القرن، المدرسة التفسيرية (بالمأثور، فقهي، لغوي…)، الكتاب، أو المؤلف."
            />
            <FeatureCard
              icon={<IconStar />}
              title="تجربة قراءة فاخرة"
              desc="خطوط عربية احترافية، وضع ليلي، تكبير الخط، وحفظ الإعدادات بين الجلسات."
            />
            <FeatureCard
              icon={<IconQuote />}
              title="نسخ ومشاركة"
              desc="انسخ أي تفسير أو شارك رابطًا مباشرًا للآية أو نتيجة البحث بضغطة واحدة."
            />
          </div>
        </div>
      </section>

      {/* Popular Ayahs */}
      <section class="section">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">
                <span class="icon-deco"><IconStar size={18} /></span>
                آيات مختارة
              </h2>
              <span class="section-subtitle">من أكثر الآيات تصفحًا واهتمامًا عند طلاب العلم</span>
            </div>
            <a href="/categories" class="btn btn-ghost btn-sm">
              المزيد <IconArrowRightCircle size={14} />
            </a>
          </div>
          <div class="feature-grid">
            {popularAyahs.map(p => {
              const surah = SURAHS.find(s => s.number === p.surah)!
              return (
                <a href={`/ayah/${p.surah}/${p.ayah}`} class="feature-card" style="text-decoration:none;display:block;">
                  <div class="feature-icon"><IconQuote /></div>
                  <div class="feature-title">{p.label}</div>
                  <div class="feature-desc">سورة {surah.name} · الآية {p.ayah}</div>
                  <div class="result-link mt-2">
                    اطّلع على تفسيرها <IconArrowRightCircle size={14} />
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* Featured Books */}
      <section class="section">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">
                <span class="icon-deco"><IconBook size={18} /></span>
                كتب التفسير المشهورة
              </h2>
              <span class="section-subtitle">نخبة من أعظم كتب التفسير عبر القرون</span>
            </div>
            <a href="/books" class="btn btn-ghost btn-sm">
              عرض الكل <IconArrowRightCircle size={14} />
            </a>
          </div>
          <div class="book-grid">
            {featuredBooks.map(b => {
              const author = AUTHORS.find(a => a.id === b.authorId)!
              return (
                <a href={`/books/${b.id}`} class="book-card" style="text-decoration:none;color:inherit;">
                  <div class="book-cover">
                    <svg class="book-cover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h6" />
                    </svg>
                  </div>
                  <div class="book-body">
                    <div class="book-title">{b.title}</div>
                    <div class="book-author">{author.name} (ت {author.deathYear}هـ)</div>
                    <div class="book-tags">
                      {b.schools.slice(0, 2).map(s => <span class="badge">{s}</span>)}
                    </div>
                    <div class="book-desc">{b.description}</div>
                    <div class="book-footer">
                      <span class="text-tertiary text-xs">
                        {b.volumes ? `${b.volumes} مجلد` : '—'}
                      </span>
                      <span class="result-link">
                        تفاصيل <IconArrowRightCircle size={14} />
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section class="section">
        <div class="container">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">
                <span class="icon-deco"><IconLayers size={18} /></span>
                تصفح حسب الموضوع
              </h2>
              <span class="section-subtitle">ابحث عن آيات تتعلق بموضوع معين</span>
            </div>
          </div>
          <div class="feature-grid">
            {CATEGORIES.map(c => (
              <a href={`/categories/${c.id}`} class="feature-card" style="text-decoration:none;display:block;">
                <div class="feature-icon"><IconLayers /></div>
                <div class="feature-title">{c.name}</div>
                <div class="feature-desc">{c.description}</div>
                <div class="mt-2 flex items-center gap-2">
                  <span class="badge">{c.ayahRefs.length} آية</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <Toast />
    </>
  )
}

const StatCard = ({ icon, value, label }: any) => (
  <div class="stat-card fade-in">
    <div class="stat-icon">{icon}</div>
    <div class="stat-value">{value.toLocaleString('ar-EG')}</div>
    <div class="stat-label">{label}</div>
  </div>
)

const FeatureCard = ({ icon, title, desc }: any) => (
  <div class="feature-card">
    <div class="feature-icon">{icon}</div>
    <div class="feature-title">{title}</div>
    <div class="feature-desc">{desc}</div>
  </div>
)
