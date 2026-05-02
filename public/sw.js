// =============================================================================
// Service Worker — منصّة تفسير
// استراتيجية:
//   - الأصول الثابتة (/static/*, /manifest.json, الأيقونات): cache-first مع تحديث في الخلفية.
//   - صفحات HTML والـ API: network-first مع رجوع للكاش عند انقطاع الشبكة.
//   - عند نشر إصدار جديد (CACHE_VERSION): يُمسح الكاش القديم تلقائيًا، ويتم تفعيل
//     عامل الخدمة الجديد فورًا (skipWaiting + clients.claim) لمنع علوق المستخدم
//     على نسخة قديمة.
//   - يدعم رسالة 'SKIP_WAITING' حتى يستطيع الـ JS في الصفحة فرض التحديث الفوري.
// =============================================================================

// رفع الرقم في كل deploy لتجاهل الكاش القديم تلقائيًا.
const CACHE_VERSION = 'v3'
const STATIC_CACHE = `tafseer-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `tafseer-runtime-${CACHE_VERSION}`

// ملفات أساسية تُحمَّل عند التثبيت لتفعيل العمل الأوّلي بدون شبكة.
const PRECACHE_ASSETS = [
  '/',
  '/static/style.css',
  '/static/app.js',
  '/static/app-icon.png',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_ASSETS))
      .catch(() => { /* لا نُفشل التثبيت إذا تعذّر pre-cache */ })
  )
  // فعّل الإصدار الجديد فورًا بدون انتظار إغلاق التبويبات القديمة.
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // امسح كل الكاشات التي لا تخصّ هذا الإصدار.
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    )
    // اربط هذا الإصدار بكل العملاء الحاليين فورًا.
    await self.clients.claim()
  })())
})

// رسالة خارجيّة لإجبار التحديث الفوري (يستدعيها الـ app.js عند ظهور إصدار جديد).
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Helper: محاولة الشبكة مع timeout لتفادي علوق الصفحة على شبكة ضعيفة.
function networkWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(req).then(res => {
      clearTimeout(timer)
      resolve(res)
    }).catch(err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

self.addEventListener('fetch', e => {
  const req = e.request
  // لا نعالج إلا GET.
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // لا نعالج الطلبات عبر النطاقات.
  if (url.origin !== self.location.origin) return

  // لا نخزّن مسارات البيانات الديناميكيّة الحرجة (export/استيراد).
  if (url.pathname.startsWith('/api/export/')) return

  // الأصول الثابتة → cache-first + تحديث في الخلفية.
  const isStatic =
    url.pathname.startsWith('/static/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/sw.js'

  if (isStatic) {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cached = await cache.match(req)
      const fetchPromise = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {})
        return res
      }).catch(() => cached)
      return cached || fetchPromise
    })())
    return
  }

  // باقي المسارات (HTML, API ما عدا /export/*) → network-first مع fallback للكاش.
  e.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE)
    try {
      const res = await networkWithTimeout(req, 4000)
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone()).catch(() => {})
      }
      return res
    } catch (_) {
      const cached = await cache.match(req)
      if (cached) return cached
      // fallback نهائي للصفحة الرئيسية إن كانت الشبكة معطّلة كليًا.
      const home = await cache.match('/') || await caches.match('/')
      if (home) return home
      return new Response('Offline', { status: 503, statusText: 'Offline' })
    }
  })())
})
