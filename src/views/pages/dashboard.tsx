// لوحة الإحصاءات التفصيلية - عرض فقط (بدون مصادقة لكون البيانات غير حسّاسة)
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconDatabase, IconBook, IconUser, IconLayers, IconCalendar,
  IconQuote, IconBookOpen, IconArrowLeft, IconShield,
} from '../icons'
import { getDetailedStats } from '../../lib/search'
import { getSourceTypeMeta, getVerificationMeta } from '../../lib/scientific'
import { SourceTypeBadge, VerificationBadge } from '../components/badges'
import type { DetailedStatsLike, QuranCoverageSummary } from '../../lib/data/types'

/**
 * DashboardPage يقبل stats مُحسبة مسبقًا (من DataProvider — D1 أو seed).
 * إن لم تُمرَّر تقع على getDetailedStats() القديم (seed) — fallback آمن.
 *
 * الشارة العلوية:
 *  - "وضع D1" لون أخضر إذا dataMode === 'd1'
 *  - "وضع العيّنة (Seed)" لون ذهبي إذا seed
 */
export const DashboardPage = ({
  dataMode = 'seed',
  stats: statsProp,
  coverage: coverageProp,
}: {
  dataMode?: 'seed' | 'd1'
  stats?: DetailedStatsLike
  coverage?: QuranCoverageSummary
} = {}) => {
  const s = statsProp ?? (getDetailedStats() as unknown as DetailedStatsLike)
  // Coverage prop comes from DataProvider.getQuranCoverageSummary(); fallback for back-compat.
  const cov: QuranCoverageSummary = coverageProp ?? {
    ayahsCount: s.totals.ayahs,
    expectedAyahs: 6236,
    surahsCovered: s.topSurahs?.length || 0,
    isComplete: s.totals.ayahs === 6236,
    coveragePercent: +((s.totals.ayahs / 6236) * 100).toFixed(2),
    mode: dataMode,
  }
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
            المدارس التفسيرية، السور الأكثر تغطية، وحالة التوثيق العلمي. البيانات تُحسب وقت الطلب من الذاكرة.
          </p>
          <div class="flex flex-wrap gap-2 mt-3" style="align-items:center">
            <span
              class={`badge ${dataMode === 'd1' ? 'badge-success' : 'badge-gold'}`}
              title={dataMode === 'd1'
                ? 'مصدر البيانات: قاعدة Cloudflare D1 — متّصل'
                : 'مصدر البيانات: العيّنة المضمّنة (seed) — لم يتم ربط D1 بعد'}
            >
              <IconDatabase size={12} />
              {dataMode === 'd1' ? 'وضع البيانات: D1 (متّصل)' : 'وضع البيانات: عيّنة (Seed)'}
            </span>
            <span
              class={`badge ${dataMode === 'd1' ? 'badge-success' : 'badge-outline'}`}
              title={dataMode === 'd1'
                ? 'D1 binding مفعّل ومستجيب'
                : 'D1 binding غير متاح في هذه البيئة'}
            >
              {dataMode === 'd1' ? '● D1 متّصل' : '○ D1 غير مفعّل'}
            </span>
            <span class="badge" title="نسبة تغطية القرآن في العيّنة الحالية">
              تغطية القرآن: {s.scientific.quranCoveragePercent}%
            </span>
            <span class="badge" title="إجمالي النصوص التفسيرية المتوفرة">
              {s.totals.tafseers} تفسير
            </span>
            <a href="/methodology" class="text-accent text-xs" style="margin-inline-start:auto">
              منهجية التوثيق ↗
            </a>
          </div>

          {/* Quran Coverage Snapshot — from DataProvider.getQuranCoverageSummary() */}
          <div class="card mt-3" style="padding:1rem 1.25rem;background:var(--surface-2,#fafafa);border-inline-start:3px solid var(--accent,#1a8754)">
            <div class="flex flex-wrap gap-3" style="align-items:center">
              <strong style="font-size:.95rem">
                <IconBookOpen size={14} /> ملخّص تغطية القرآن
              </strong>
              <span class={`badge ${cov.isComplete ? 'badge-success' : 'badge-warn'}`}
                    title={cov.isComplete ? 'القرآن الكامل (6236 آية) مُحمَّل' : 'لم يُحمَّل القرآن الكامل بعد'}>
                {cov.isComplete ? '✓ مكتمل' : '⚠ غير مكتمل'}
              </span>
              <span class="badge" title="عدد الآيات الموجودة فعلًا">
                {cov.ayahsCount.toLocaleString('ar')} / {cov.expectedAyahs.toLocaleString('ar')} آية
              </span>
              <span class="badge" title="عدد السور التي تحوي آية واحدة على الأقل">
                {cov.surahsCovered} / 114 سورة
              </span>
              <span class="badge badge-gold" title="نسبة الاكتمال">
                {cov.coveragePercent}%
              </span>
              <a href="/api/quran/coverage" class="text-accent text-xs"
                 style="margin-inline-start:auto" target="_blank" rel="noopener">
                JSON API ↗
              </a>
            </div>
            <div class="coverage-bar mt-2" aria-label={`تغطية القرآن ${cov.coveragePercent}%`}>
              <span style={`width:${Math.max(2, Math.min(100, cov.coveragePercent))}%`}></span>
            </div>
            {!cov.isComplete ? (
              <p class="text-tertiary text-xs mt-2" style="margin-bottom:0">
                لاستيراد القرآن الكامل من مصدر موثوق، راجع
                {' '}<a href="https://github.com/hkllmnnx-maker/tafseer/blob/main/docs/quran-import-plan.md"
                       class="text-accent" target="_blank" rel="noopener">docs/quran-import-plan.md</a>.
              </p>
            ) : null}
          </div>
          {dataMode === 'seed' ? (
            <div class="mt-3 text-sm" style="background:var(--surface-2,#fff8e1);border-inline-start:3px solid var(--gold,#c9a45c);padding:.75rem 1rem;border-radius:var(--radius-sm,6px);line-height:1.7">
              <strong>توصية:</strong> لا تزال البيانات المعروضة عيّنةً مضمَّنةً
              في الكود. لتفعيل قاعدة البيانات الفعلية على Cloudflare D1، راجع
              {' '}<a href="/" class="text-accent">docs/d1-smoke-test.md</a>{' '}
              في المستودع.
            </div>
          ) : null}
        </div>

        {/* Totals */}
        <section class="dashboard-grid mb-6">
          <DashStat icon={<IconBook />} label="كتاب تفسير" value={s.totals.books} />
          <DashStat icon={<IconUser />} label="مؤلف ومفسر" value={s.totals.authors} />
          <DashStat icon={<IconBookOpen />} label="سورة" value={s.totals.surahs} />
          <DashStat icon={<IconQuote />} label="نص تفسير" value={s.totals.tafseers} />
          <DashStat icon={<IconLayers />} label="آية مغطّاة (في العينة)" value={`${s.ayahsCoveredCount} / ${s.totals.ayahs}`} sub={`نسبة العينة: ${(s.ayahsCoverageRatio * 100).toFixed(1)}%`} />
          <DashStat
            icon={<IconQuote />}
            label="آيات بتفسير / بدون تفسير"
            value={`${s.scientific.quranAyahsCovered.toLocaleString('ar')} / ${(s.scientific.quranAyahsTotal - s.scientific.quranAyahsCovered).toLocaleString('ar')}`}
            sub="مُغطّاة بتفسير واحد فأكثر / بانتظار التغطية"
          />
          <DashStat icon={<IconCalendar />} label="متوسط طول التفسير" value={`${s.totals.avgTafseerLength} حرف`} sub={`الإجمالي: ${s.totals.totalTafseerChars.toLocaleString('ar')} حرف`} />
        </section>

        {/* Scientific verification snapshot */}
        <section class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin:0 0 1rem 0;display:flex;align-items:center;gap:.5rem">
            <IconShield size={18} />
            ملخّص التوثيق العلمي
          </h3>
          <div class="dashboard-grid" style="margin-bottom:1rem">
            <DashStat icon={<IconQuote />} label="نصوص أصلية" value={s.scientific.originalTexts} sub="مأخوذة من المصدر مباشرةً" />
            <DashStat icon={<IconQuote />} label="ملخّصات" value={s.scientific.summaries} sub="صياغة موجزة من المصدر" />
            <DashStat icon={<IconQuote />} label="عيّنات" value={s.scientific.samples} sub="بيانات تجريبية للعرض" />
            <DashStat icon={<IconQuote />} label="بانتظار المراجعة" value={s.scientific.pendingReview} sub="تحتاج تدقيقًا قبل النشر" />
            <DashStat icon={<IconShield />} label="موثّق" value={s.scientific.verified} sub="يطابق المصدر الأصلي" />
            <DashStat icon={<IconShield />} label="موثّق جزئيًا" value={s.scientific.partiallyVerified} sub="جزء من النص دون مراجعة كاملة" />
            <DashStat icon={<IconShield />} label="غير موثّق" value={s.scientific.unverified} sub="لم تتم مراجعته بعد" />
            <DashStat
              icon={<IconBookOpen />}
              label="تغطية القرآن الكلية"
              value={`${s.scientific.quranCoveragePercent}%`}
              sub={`${s.scientific.quranAyahsCovered} / ${s.scientific.quranAyahsTotal} آية`}
            />
          </div>
          <div class="coverage-bar mb-4" aria-label={`تغطية القرآن ${s.scientific.quranCoveragePercent}%`}>
            <span style={`width:${Math.max(2, Math.min(100, s.scientific.quranCoveragePercent))}%`}></span>
          </div>

          <h4 style="margin:1rem 0 .5rem">توزيع نوع المصدر</h4>
          <div class="bar-list">
            {s.bySourceType.map(b => {
              const meta = getSourceTypeMeta(b.type)
              return (
                <div class="bar-row">
                  <div class="bar-label" title={meta.description}>
                    <SourceTypeBadge type={b.type} />
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill" style={`width:${b.percent}%`}></div>
                  </div>
                  <div class="bar-value">
                    <strong>{b.count}</strong>
                    <span class="text-tertiary text-xs"> · {b.percent}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <h4 style="margin:1.25rem 0 .5rem">توزيع حالة التحقق</h4>
          <div class="bar-list">
            {s.byVerification.map(b => {
              const meta = getVerificationMeta(b.status)
              return (
                <div class="bar-row">
                  <div class="bar-label" title={meta.description}>
                    <VerificationBadge status={b.status} />
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill bar-fill-gold" style={`width:${b.percent}%`}></div>
                  </div>
                  <div class="bar-value">
                    <strong>{b.count}</strong>
                    <span class="text-tertiary text-xs"> · {b.percent}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <p class="text-tertiary text-sm mt-4">
            ملاحظة: التغطية الكلية للقرآن تُحسب من أصل {s.scientific.quranAyahsTotal} آية في 114 سورة.
            الأرقام أعلاه تعكس العيّنة الحالية في التطبيق.
            <a href="/methodology" class="text-accent" style="margin-inline-start:.4rem">منهجيتنا في التوثيق ↗</a>
          </p>
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
