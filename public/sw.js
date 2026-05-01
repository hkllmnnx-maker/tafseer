// خدمة عامل بسيط للتطبيق (PWA basic offline fallback)
const CACHE = 'tafseer-v1'
const ASSETS = ['/', '/static/style.css', '/static/app.js', '/static/app-icon.png', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  // Network-first for HTML, cache-first for static assets
  const url = new URL(req.url)
  if (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json') {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        return res
      }).catch(() => cached))
    )
  } else {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        return res
      }).catch(() => caches.match(req).then(c => c || caches.match('/')))
    )
  }
})
