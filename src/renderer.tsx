import { jsxRenderer } from 'hono/jsx-renderer'

interface RendererProps {
  title?: string
  description?: string
  ogImage?: string
  canonical?: string
  active?: string
}

export const renderer = jsxRenderer(({ children, title, description }: any) => {
  const pageTitle = title ? `${title} · تفسير` : 'تفسير - تطبيق البحث في كتب تفسير القرآن الكريم'
  const desc = description || 'تطبيق ويب بحثي متقدم في كتب التفسير: ابحث في الآيات، قارن بين كبار المفسرين، واكتشف معاني القرآن الكريم بأدوات علمية دقيقة.'
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#0f5c3e" />
        <title>{pageTitle}</title>
        <meta name="description" content={desc} />
        <meta name="keywords" content="تفسير, قرآن, آيات, تفسير الطبري, ابن كثير, القرطبي, السعدي, البحث في القرآن" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content="/static/app-icon.png" />
        <meta property="og:locale" content="ar_AR" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* Icons */}
        <link rel="icon" type="image/png" href="/static/app-icon.png" />
        <link rel="apple-touch-icon" href="/static/app-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Styles */}
        <link href="/static/style.css" rel="stylesheet" />

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
