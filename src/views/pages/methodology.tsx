// Methodology page: explains scientific verification, source types, data status,
// and how the team curates / imports tafseer entries.
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconShield, IconBook, IconDatabase, IconSparkles, IconQuote } from '../icons'
import { SOURCE_TYPES, VERIFICATION_STATUSES, getSourceTypeMeta, getVerificationMeta } from '../../lib/scientific'
import { getOverallCoverage } from '../../lib/coverage'

export const MethodologyPage = () => {
  const cov = getOverallCoverage()
  return (
    <>
      <Header />
      <main class="container" style="padding-top:1.5rem;padding-bottom:2rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'منهجية التوثيق العلمي' },
        ]} />

        <article class="card card-elevated" style="padding:2rem">
          <h1><IconShield size={22} /> منهجية التوثيق العلمي</h1>
          <p style="font-size:1.05rem;line-height:1.95;margin-top:1rem">
            تحرص منصّة <strong>تفسير</strong> على التمييز الواضح بين النصوص الأصلية المنقولة
            من كتب التفسير وبين الصياغات والملخّصات والعيّنات. هذه الصفحة تشرح بالتفصيل
            كيف نعرض النصوص، وما تعنيه الشارات (Badges) التي تراها على كل بطاقة تفسير.
          </p>

          <h2 class="mt-6"><IconQuote size={18} /> أنواع المصادر (Source Types)</h2>
          <div class="methodology-grid">
            {SOURCE_TYPES.map(t => {
              const m = getSourceTypeMeta(t)
              return (
                <div class="card methodology-item">
                  <span class={`badge tafseer-badge ${m.cssClass}`}>{m.label}</span>
                  <p class="text-sm mt-2" style="line-height:1.8">{m.description}</p>
                </div>
              )
            })}
          </div>

          <h2 class="mt-6"><IconShield size={18} /> حالات التحقق (Verification Status)</h2>
          <div class="methodology-grid">
            {VERIFICATION_STATUSES.map(v => {
              const m = getVerificationMeta(v)
              return (
                <div class="card methodology-item">
                  <span class={`badge tafseer-badge ${m.cssClass}`}>{m.label}</span>
                  <p class="text-sm mt-2" style="line-height:1.8">{m.description}</p>
                </div>
              )
            })}
          </div>

          <h2 class="mt-6"><IconDatabase size={18} /> حالة البيانات الفعلية</h2>
          <div class="card" style="background:var(--bg-secondary);padding:1.25rem">
            <ul style="line-height:2;padding-inline-start:1rem">
              <li>عدد التفاسير المفهرسة: <strong>{cov.totalTafseerEntries.toLocaleString('ar-EG')}</strong></li>
              <li>الآيات التي يتوفّر لها تفسير: <strong>{cov.ayahsWithTafseer.toLocaleString('ar-EG')}</strong> من أصل {cov.totalCanonicalAyahs.toLocaleString('ar-EG')} آية ({cov.tafseerCoveragePercent}%)</li>
              <li>السور التي يوجد فيها تفسير لآية واحدة على الأقل: <strong>{cov.surahsWithTafseer}</strong> من 114 سورة</li>
              <li>نصوص الآيات المتوفرة: <strong>{cov.availableAyahs.toLocaleString('ar-EG')}</strong> آية ({cov.ayahCoveragePercent}%)</li>
            </ul>
            <p class="text-sm text-tertiary mt-3" style="line-height:1.8">
              هذه نسب تشغيل أوّلية. الهدف هو تغذية القاعدة من ملفات الاستيراد العلمي تدريجيًا
              عبر <a href="/about" class="text-accent">نظام الاستيراد</a> الموثّق.
            </p>
          </div>

          <h2 class="mt-6"><IconBook size={18} /> ضوابط الجودة</h2>
          <ol style="line-height:2;padding-inline-start:1rem">
            <li>لا تُعرض بطاقة بدون اسم كتاب ومصدر واضح.</li>
            <li>كل تفسير يحمل شارة نوع مصدر وشارة حالة تحقق.</li>
            <li>البطاقات «العيّنة» و«غير المحقق» مُمَيَّزة بصريًا، ولا تظهر افتراضيًا في وضع البحث الصارم (قريبًا).</li>
            <li>عند توفّر طبعة ومجلد وصفحة، تُعرض ضمن «المصدر» لتمكين القارئ من التحقق المباشر.</li>
            <li>أي بلاغ عن خطأ يُسجَّل في سجلّات المراجعة (Audit Logs) ويُعالَج قبل التحقّق النهائي.</li>
          </ol>

          <h2 class="mt-6"><IconSparkles size={18} /> كيف نُغذّي القاعدة؟</h2>
          <p style="line-height:1.95">
            يستقبل التطبيق ملفات JSON موثّقة عبر سكربت <code>scripts/importers/import-tafseers.mjs</code>
            مع فحص شامل (Dry-Run، تحقق المخطط، رفض السجلات الناقصة، تقرير أخطاء واضح).
            المخطط الكامل موثّق في <code>docs/importing-data.md</code>،
            وقواعد التوثيق العلمي في <code>docs/scientific-verification.md</code>.
          </p>

          <h2 class="mt-6">إخلاء مسؤولية</h2>
          <div class="card" style="background:var(--bg-secondary);border-style:dashed;padding:1.25rem">
            <p style="line-height:1.85">
              التطبيق أداة بحثية مساعدة. لا يُغني عن الرجوع لكتب التفسير الأصلية،
              ولا يُعتمد عليه وحده في الاحتجاج العلمي أو الفتيا.
            </p>
          </div>
        </article>
      </main>
      <Footer />
      <Toast />
    </>
  )
}
