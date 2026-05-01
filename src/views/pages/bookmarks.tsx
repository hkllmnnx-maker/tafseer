// صفحة المفضلة - تعرض الآيات التي حفظها المستخدم في متصفّحه (LocalStorage)
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import {
  IconBookmark, IconQuote, IconArrowLeft, IconCompare, IconHash,
} from '../icons'

export const BookmarksPage = () => {
  return (
    <>
      <Header active="bookmarks" />
      <main class="container" style="padding-top:1.5rem;padding-bottom:3rem">
        <Breadcrumbs items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'المفضلة' },
        ]} />

        <div class="page-header" style="margin-bottom:1.5rem">
          <h1 class="page-title">
            <span class="icon-deco"><IconBookmark size={20} /></span>
            المفضلة
          </h1>
          <p class="page-subtitle">
            قائمة الآيات التي قمت بإضافتها للمفضلة. يتم حفظها محليًا في متصفّحك دون أي خادم.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-4" id="bookmarks-toolbar" style="display:none">
          <span class="text-sm text-tertiary" id="bookmarks-count"></span>
          <span style="margin-inline-start:auto"></span>
          <button class="btn btn-secondary btn-sm" id="export-bookmarks">تصدير JSON</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">
            استيراد JSON
            <input type="file" accept="application/json" id="import-bookmarks" style="display:none" />
          </label>
          <button class="btn btn-ghost btn-sm" id="clear-bookmarks" style="color:var(--error)">حذف الكل</button>
        </div>

        {/* Empty placeholder (hidden by JS if there are bookmarks) */}
        <div class="empty-state card" id="bookmarks-empty">
          <div class="empty-icon"><IconBookmark size={28} /></div>
          <h3>لا توجد آيات مفضّلة بعد</h3>
          <p>
            أضف الآيات التي تودّ مراجعتها لاحقًا بالضغط على أيقونة المفضلة في صفحة الآية.
            القائمة تُحفظ في متصفّحك ولا ترسل لأي خادم.
          </p>
          <a href="/surahs" class="btn btn-primary mt-4">
            تصفّح السور <IconArrowLeft size={16} />
          </a>
        </div>

        {/* List rendered by JS */}
        <div id="bookmarks-list" class="grid grid-cols-1 gap-3"></div>

        {/* Card template for JS */}
        <template id="bookmark-card-template">
          <article class="bookmark-card card">
            <div class="bookmark-meta">
              <span class="bookmark-surah-name"></span>
              <span class="bookmark-sep">·</span>
              <span class="bookmark-ayah-num"></span>
              <span class="bookmark-sep">·</span>
              <span class="bookmark-date text-tertiary"></span>
            </div>
            <div class="bookmark-text"></div>
            <div class="bookmark-note text-tertiary text-sm" style="display:none"></div>
            <div class="bookmark-actions flex flex-wrap gap-2 mt-3">
              <a class="btn btn-primary btn-sm bookmark-open" href="#">
                فتح الآية <IconArrowLeft size={14} />
              </a>
              <a class="btn btn-secondary btn-sm bookmark-compare" href="#">
                <IconCompare size={14} /> مقارنة
              </a>
              <button class="btn btn-ghost btn-sm bookmark-edit-note">إضافة ملاحظة</button>
              <button class="btn btn-ghost btn-sm bookmark-remove" style="color:var(--error);margin-inline-start:auto">حذف</button>
            </div>
          </article>
        </template>

        <p class="text-tertiary text-sm mt-6" style="line-height:1.8">
          <strong>ملاحظة عن الخصوصية:</strong> المفضلة تُخزَّن في متصفّحك (LocalStorage) فقط، ولا تُرسَل إلى أي خادم،
          ولن تظهر في أجهزة أخرى. لنقلها استخدم زر «تصدير JSON».
        </p>
      </main>
      <Footer />
      <Toast />
    </>
  )
}
