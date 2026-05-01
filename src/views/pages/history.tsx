// صفحة سجل التصفح - تعرض آخر الآيات التي شاهدها المستخدم (LocalStorage)
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconCalendar, IconArrowLeft, IconCompare,
} from '../icons'

export const HistoryPage = () => {
  return (
    <>
      <Header active="history" />
      <main class="container" style="padding-top:1.5rem;padding-bottom:3rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'سجل التصفح' },
        ]} />

        <div class="page-header" style="margin-bottom:1.5rem">
          <h1 class="page-title">
            <span class="icon-deco"><IconCalendar size={20} /></span>
            سجل التصفح
          </h1>
          <p class="page-subtitle">
            آخر الآيات التي تصفّحتها مؤخّرًا. يُحفظ السجل محليًا في متصفّحك فقط، ويتم الاحتفاظ بآخر 50 آية.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-4" id="history-toolbar" style="display:none">
          <span class="text-sm text-tertiary" id="history-count"></span>
          <span style="margin-inline-start:auto"></span>
          <button class="btn btn-ghost btn-sm" id="clear-history" style="color:var(--error)">مسح السجل</button>
        </div>

        <div class="empty-state card" id="history-empty">
          <div class="empty-icon"><IconCalendar size={28} /></div>
          <h3>لا يوجد سجل تصفح بعد</h3>
          <p>
            ابدأ بتصفّح الآيات وسيتم تسجيل آخر الآيات التي شاهدتها هنا تلقائيًا.
            السجل يبقى محليًا في متصفّحك ولا يُرسَل لأي خادم.
          </p>
          <a href="/surahs" class="btn btn-primary mt-4">
            تصفّح السور <IconArrowLeft size={16} />
          </a>
        </div>

        <div id="history-list" class="grid grid-cols-1 gap-3"></div>

        <template id="history-card-template">
          <article class="bookmark-card card">
            <div class="bookmark-meta">
              <span class="bookmark-surah-name"></span>
              <span class="bookmark-sep">·</span>
              <span class="bookmark-ayah-num"></span>
              <span class="bookmark-sep">·</span>
              <span class="history-date text-tertiary"></span>
            </div>
            <div class="bookmark-text"></div>
            <div class="bookmark-actions flex flex-wrap gap-2 mt-3">
              <a class="btn btn-primary btn-sm history-open" href="#">
                فتح الآية <IconArrowLeft size={14} />
              </a>
              <a class="btn btn-secondary btn-sm history-compare" href="#">
                <IconCompare size={14} /> مقارنة
              </a>
              <button class="btn btn-ghost btn-sm history-remove" style="color:var(--error);margin-inline-start:auto">إزالة</button>
            </div>
          </article>
        </template>

        <p class="text-tertiary text-sm mt-6" style="line-height:1.8">
          <strong>ملاحظة عن الخصوصية:</strong> سجل التصفح يُخزَّن في متصفّحك (LocalStorage) فقط، ولا يُرسَل لأي خادم.
          يمكنك مسحه في أي وقت من زر «مسح السجل» أعلاه.
        </p>
      </main>
      <Footer />
      <Toast />
    </>
  )
}
