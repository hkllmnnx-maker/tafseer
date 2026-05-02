import { jsxRenderer } from 'hono/jsx-renderer'

interface RendererProps {
  title?: string
  description?: string
  ogImage?: string
  canonical?: string
  active?: string
  noindex?: boolean
  ogType?: string
}

const SITE_NAME = 'تفسير'
const DEFAULT_TITLE = 'تفسير — البحث العلمي في كتب تفسير القرآن الكريم'
const DEFAULT_DESC =
  'منصّة ويب علميّة للبحث المتقدّم في كتب تفسير القرآن الكريم: ابحث في الآيات، قارن بين كبار المفسّرين، واكتشف معاني القرآن بأدوات علميّة دقيقة وشفافيّة كاملة في المصادر.'

export const renderer = jsxRenderer(({ children, title, description, canonical, ogImage, noindex, ogType }: any) => {
  const pageTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE
  const desc = description || DEFAULT_DESC
  const og  = ogImage || '/static/app-icon.png'
  const type = ogType || 'website'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: DEFAULT_DESC,
    inLanguage: 'ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: '/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#0f5c3e" />
        <title>{pageTitle}</title>
        <meta name="description" content={desc} />
        <meta name="keywords" content="تفسير, قرآن, آيات, تفسير الطبري, ابن كثير, القرطبي, السعدي, السعدي تفسير, البحث في القرآن, تفسير ميسّر, منهج علمي" />
        <meta name="application-name" content={SITE_NAME} />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
        {canonical ? <link rel="canonical" href={canonical} /> : null}

        {/* Open Graph */}
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:type" content={type} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content={og} />
        <meta property="og:locale" content="ar_AR" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={og} />

        {/* Icons & PWA */}
        <link rel="icon" type="image/png" href="/static/app-icon.png" />
        <link rel="apple-touch-icon" href="/static/app-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Performance hints — preconnect to font CDN */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />

        {/* Styles */}
        <link href="/static/style.css" rel="stylesheet" />

        {/* Structured data — site search */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Theme - applied early to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('tafseer-theme');
              var prefDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              var theme = saved || (prefDark ? 'dark' : 'light');
              document.documentElement.setAttribute('data-theme', theme);
            } catch(e){}
          })();
        ` }} />
      </head>
      <body>
        {children}
        <script src="/static/app.js" defer></script>
      </body>
    </html>
  )
})
