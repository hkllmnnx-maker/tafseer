// المكونات الأساسية للتخطيط: الترويسة، التذييل، breadcrumbs
import {
  IconSearch, IconBookOpen, IconLayers, IconCompare, IconHome,
  IconMenu, IconMoon, IconSun, IconHash, IconBook, IconBookmark, IconCalendar,
} from '../icons'

export const Header = ({ active }: { active?: string }) => (
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo" aria-label="تفسير - الصفحة الرئيسية">
        <span class="logo-icon">
          <img src="/static/app-icon.png" alt="تفسير" />
        </span>
        <span class="logo-text">تفسير</span>
      </a>

      <nav class="nav nav-desktop" aria-label="القائمة الرئيسية">
        <a href="/" class={`nav-link ${active === 'home' ? 'active' : ''}`}>
          <IconHome size={16} /> الرئيسية
        </a>
        <a href="/search" class={`nav-link ${active === 'search' ? 'active' : ''}`}>
          <IconSearch size={16} /> البحث المتقدم
        </a>
        <a href="/books" class={`nav-link ${active === 'books' ? 'active' : ''}`}>
          <IconBook size={16} /> الكتب
        </a>
        <a href="/authors" class={`nav-link ${active === 'authors' ? 'active' : ''}`}>
          <IconBookOpen size={16} /> المؤلفون
        </a>
        <a href="/categories" class={`nav-link ${active === 'categories' ? 'active' : ''}`}>
          <IconLayers size={16} /> موضوعات
        </a>
        <a href="/compare" class={`nav-link ${active === 'compare' ? 'active' : ''}`}>
          <IconCompare size={16} /> المقارنة
        </a>
        <a href="/bookmarks" class={`nav-link ${active === 'bookmarks' ? 'active' : ''}`}>
          <IconBookmark size={16} /> المفضلة
          <span id="bookmark-count-badge" class="badge-count" style="display:none"></span>
        </a>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" id="theme-toggle" aria-label="تبديل الوضع الليلي" title="تبديل الوضع الليلي">
          <span class="theme-icon-light"><IconMoon /></span>
          <span class="theme-icon-dark hidden"><IconSun /></span>
        </button>
        <button class="icon-btn mobile-menu-btn" id="mobile-menu-btn" aria-label="القائمة">
          <IconMenu />
        </button>
      </div>
    </div>

    <div id="mobile-drawer" class="mobile-drawer" aria-hidden="true">
      <a href="/" class={`nav-link ${active === 'home' ? 'active' : ''}`}>
        <IconHome size={18} /> الرئيسية
      </a>
      <a href="/search" class={`nav-link ${active === 'search' ? 'active' : ''}`}>
        <IconSearch size={18} /> البحث المتقدم
      </a>
      <a href="/books" class={`nav-link ${active === 'books' ? 'active' : ''}`}>
        <IconBook size={18} /> كتب التفسير
      </a>
      <a href="/authors" class={`nav-link ${active === 'authors' ? 'active' : ''}`}>
        <IconBookOpen size={18} /> المؤلفون
      </a>
      <a href="/categories" class={`nav-link ${active === 'categories' ? 'active' : ''}`}>
        <IconLayers size={18} /> الموضوعات
      </a>
      <a href="/compare" class={`nav-link ${active === 'compare' ? 'active' : ''}`}>
        <IconCompare size={18} /> المقارنة
      </a>
      <a href="/bookmarks" class={`nav-link ${active === 'bookmarks' ? 'active' : ''}`}>
        <IconBookmark size={18} /> المفضلة
      </a>
      <a href="/history" class={`nav-link ${active === 'history' ? 'active' : ''}`}>
        <IconCalendar size={18} /> سجل التصفح
      </a>
    </div>
  </header>
)

export const Footer = () => (
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div class="logo mb-4">
            <span class="logo-icon">
              <img src="/static/app-icon.png" alt="تفسير" />
            </span>
            <span class="logo-text">تفسير</span>
          </div>
          <p class="text-tertiary text-sm" style="line-height:1.8">
            تطبيق ويب علمي متقدم لطلاب العلم والباحثين، يجمع كتب التفسير في مكان واحد
            ويتيح البحث الدقيق في معاني القرآن الكريم بأدوات حديثة وواجهة عربية أصيلة.
          </p>
        </div>
        <div class="footer-col">
          <h4>روابط سريعة</h4>
          <ul>
            <li><a href="/">الرئيسية</a></li>
            <li><a href="/search">البحث المتقدم</a></li>
            <li><a href="/books">كتب التفسير</a></li>
            <li><a href="/compare">المقارنة بين التفاسير</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>أدوات</h4>
          <ul>
            <li><a href="/categories">البحث الموضوعي</a></li>
            <li><a href="/authors">المؤلفون</a></li>
            <li><a href="/bookmarks">المفضلة</a></li>
            <li><a href="/history">سجل التصفح</a></li>
            <li><a href="/about">عن التطبيق</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>تنبيه</h4>
          <p class="text-tertiary text-sm" style="line-height:1.8">
            النصوص المعروضة معاني مستفادة من كتب التفسير المذكورة وقد تكون عينة، يجب الرجوع إلى الأصل عند الاحتجاج.
          </p>
        </div>
      </div>
      <div class="footer-bottom">
        © {new Date().getFullYear()} تطبيق <strong>تفسير</strong> · صُنع بعناية لطلاب العلم
      </div>
    </div>
  </footer>
)

export type Crumb = { label: string; href?: string }
export const Breadcrumbs = ({ items }: { items: Crumb[] }) => (
  <nav class="breadcrumbs" aria-label="مسار التنقل">
    {items.map((it, i) => (
      <>
        {it.href && i < items.length - 1 ? (
          <a href={it.href}>{it.label}</a>
        ) : (
          <span class="current">{it.label}</span>
        )}
        {i < items.length - 1 && <span class="sep">/</span>}
      </>
    ))}
  </nav>
)

export const Toast = () => (
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
)
