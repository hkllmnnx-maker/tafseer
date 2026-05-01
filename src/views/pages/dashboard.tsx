// لوحة الإحصاءات التفصيلية - عرض فقط (بدون مصادقة لكون البيانات غير حسّاسة)
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconDatabase, IconBook, IconUser, IconLayers, IconCalendar,
  IconQuote, IconBookOpen, IconArrowLeft,
} from '../icons'
import { getDetailedStats } from '../../lib/search'

export const DashboardPage = () => {
  const s = getDetailedStats()
  const maxBookCount = Math.max(1, ...s.perBook.map(b => b.tafseersCount))
  const maxSchoolCount = Math.max(1, ...s.bySchool.map(b => b.tafseersCount))
  const maxCenturyCount = Math.max(1, ...s.byCentury.map(b => b.tafseersCount))
  const maxSurahCount = Math.max(1, ...s.topSurahs.map(b => b.tafseersCount))

  return (
    <>
      <Header active="dashboard" />
      <main class="container" style="padding-top:1.5rem;padding-bottom:3rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'لوحة الإحصاءات' },
        ]} />

        <div class="page-header" style="margin-bottom:1.5rem">
          <h1 class="page-title">
            <span class="icon-deco"><IconDatabase size={20} /></span>
            لوحة الإحصاءات
          </h1>
          <p class="page-subtitle">
            نظرة شاملة على محتوى التطبيق: عدد التفاسير لكل كتاب، توزيع المؤلفين بالقرون،
            المدارس التفسيرية، والسور الأكثر تغطية. البيانات تُحسب وقت الطلب من الذاكرة.
          </p>
        </div>

        {/* Totals */}
        <section class="dashboard-grid mb-6">
          <DashStat icon={<IconBook />} label="كتاب تفسير" value={s.totals.books} />
          <DashStat icon={<IconUser />} label="مؤلف ومفسر" value={s.totals.authors} />
          <DashStat icon={<IconBookOpen />} label="سورة" value={s.totals.surahs} />
          <DashStat icon={<IconQuote />} label="نص تفسير" value={s.totals.tafseers} />
          <DashStat icon={<IconLayers />} label="آية مغطّاة" value={`${s.ayahsCoveredCount} / ${s.totals.ayahs}`} sub={`نسبة التغطية: ${(s.ayahsCoverageRatio * 100).toFixed(1)}%`} />
          <DashStat icon={<IconCalendar />} label="متوسط طول التفسير" value={`${s.totals.avgTafseerLength} حرف`} sub={`الإجمالي: ${s.totals.totalTafseerChars.toLocaleString('ar')} حرف`} />
        </section>

        {/* Export */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 .5rem 0;display:flex;align-items:center;gap:.5rem">
            <IconDatabase size={18} />
            تصدير البيانات (JSON)
          </h3>
          <p class="text-tertiary text-sm mb-4">
            يمكنك تنزيل أي مجموعة من بيانات التطبيق لاستخدامها خارجيًا أو لأخذ نسخة احتياطية.
          </p>
          <div class="flex flex-wrap gap-2">
            <a href="/api/export/all" class="btn btn-primary btn-sm" download>تصدير الكل</a>
            <a href="/api/export/books" class="btn btn-secondary btn-sm" download>الكتب</a>
            <a href="/api/export/authors" class="btn btn-secondary btn-sm" download>المؤلفون</a>
            <a href="/api/export/surahs" class="btn btn-secondary btn-sm" download>السور</a>
            <a href="/api/export/ayahs" class="btn btn-secondary btn-sm" download>الآيات</a>
            <a href="/api/export/tafseers" class="btn btn-secondary btn-sm" download>التفاسير</a>
            <a href="/api/export/categories" class="btn btn-secondary btn-sm" download>الموضوعات</a>
          </div>
        </section>

        {/* Per Book */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 1rem 0;display:flex;align-items:center;gap:.5rem">
            <IconBook size={18} />
            عدد النصوص المفهرسة لكل كتاب
          </h3>
          <div class="bar-list">
            {s.perBook.map(b => (
              <div class="bar-row">
                <a href={`/books/${b.id}`} class="bar-label">
                  <strong>{b.title}</strong>
                  <span class="text-tertiary text-xs">· {b.authorName}</span>
                </a>
                <div class="bar-track">
                  <div class="bar-fill" style={`width:${(b.tafseersCount / maxBookCount * 100).toFixed(1)}%`}></div>
                </div>
                <div class="bar-value">
                  <strong>{b.tafseersCount}</strong>
                  <span class="text-tertiary text-xs"> · ~{b.avgLength} حرف</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* By School */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 1rem 0;display:flex;align-items:center;gap:.5rem">
            <IconLayers size={18} />
            توزيع التفاسير على المدارس التفسيرية
          </h3>
          <div class="bar-list">
            {s.bySchool.map(b => (
              <div class="bar-row">
                <div class="bar-label"><strong>{b.school}</strong></div>
                <div class="bar-track">
                  <div class="bar-fill bar-fill-gold" style={`width:${(b.tafseersCount / maxSchoolCount * 100).toFixed(1)}%`}></div>
                </div>
                <div class="bar-value">
                  <strong>{b.tafseersCount}</strong>
                  <span class="text-tertiary text-xs"> · {b.booksCount} كتاب</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* By Century */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 1rem 0;display:flex;align-items:center;gap:.5rem">
            <IconCalendar size={18} />
            توزيع المؤلفين والتفاسير بالقرون الهجرية
          </h3>
          <div class="bar-list">
            {s.byCentury.map(b => (
              <div class="bar-row">
                <div class="bar-label">
                  <strong>القرن {toArabicNumber(b.century)}هـ</strong>
                </div>
                <div class="bar-track">
                  <div class="bar-fill bar-fill-info" style={`width:${(b.tafseersCount / maxCenturyCount * 100).toFixed(1)}%`}></div>
                </div>
                <div class="bar-value">
                  <strong>{b.tafseersCount}</strong>
                  <span class="text-tertiary text-xs"> · {b.authorsCount} مؤلف</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Surahs */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 1rem 0;display:flex;align-items:center;gap:.5rem">
            <IconBookOpen size={18} />
            السور الأكثر تغطية بالتفاسير
          </h3>
          <div class="bar-list">
            {s.topSurahs.map(b => (
              <div class="bar-row">
                <a href={`/surahs/${b.surah}`} class="bar-label">
                  <strong>سورة {b.surahName}</strong>
                </a>
                <div class="bar-track">
                  <div class="bar-fill" style={`width:${(b.tafseersCount / maxSurahCount * 100).toFixed(1)}%`}></div>
                </div>
                <div class="bar-value">
                  <strong>{b.tafseersCount}</strong>
                  <span class="text-tertiary text-xs"> · {b.ayahsCovered} آية</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Authors */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 1rem 0;display:flex;align-items:center;gap:.5rem">
            <IconUser size={18} />
            المؤلفون مرتّبون بعدد النصوص
          </h3>
          <div class="dashboard-table-wrap">
            <table class="dashboard-table">
              <thead>
                <tr>
                  <th>المؤلف</th>
                  <th>القرن</th>
                  <th>الوفاة</th>
                  <th>عدد الكتب</th>
                  <th>عدد النصوص</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {s.perAuthor.map(a => (
                  <tr>
                    <td><strong>{a.name}</strong></td>
                    <td>{toArabicNumber(a.century)}هـ</td>
                    <td>{toArabicNumber(a.deathYear)}هـ</td>
                    <td>{a.booksCount}</td>
                    <td><strong>{a.tafseersCount}</strong></td>
                    <td><a href={`/authors/${a.id}`} class="text-accent">عرض <IconArrowLeft size={12} /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p class="text-tertiary text-sm mt-6" style="line-height:1.8">
          <strong>ملاحظة:</strong> الإحصاءات أعلاه تعكس البيانات المضمَّنة حاليًا في التطبيق (عيّنة).
          عند ترقية مصدر البيانات إلى Cloudflare D1 أو محرك بحث خارجي ستُحدَّث الأرقام تلقائيًا.
        </p>
      </main>
      <Footer />
      <Toast />
    </>
  )
}

function DashStat({ icon, label, value, sub }: { icon: any; label: string; value: any; sub?: string }) {
  return (
    <div class="dash-stat-card">
      <div class="dash-stat-icon">{icon}</div>
      <div class="dash-stat-meta">
        <div class="dash-stat-value">{value}</div>
        <div class="dash-stat-label">{label}</div>
        {sub ? <div class="dash-stat-sub text-tertiary text-xs">{sub}</div> : null}
      </div>
    </div>
  )
}

function toArabicNumber(n: number | string): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)])
}
