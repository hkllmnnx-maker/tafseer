// ============================================
// تطبيق تفسير - JavaScript للواجهة الأمامية
// ============================================
(function () {
  'use strict'

  // ============== Toast ==============
  function showToast(msg, duration) {
    const t = document.getElementById('toast')
    if (!t) return
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(t._timer)
    t._timer = setTimeout(() => t.classList.remove('show'), duration || 2200)
  }

  // ============== Theme Toggle ==============
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('tafseer-theme', theme) } catch (e) {}
    const lightIcon = document.querySelector('.theme-icon-light')
    const darkIcon = document.querySelector('.theme-icon-dark')
    if (lightIcon && darkIcon) {
      if (theme === 'dark') {
        lightIcon.classList.add('hidden')
        darkIcon.classList.remove('hidden')
      } else {
        lightIcon.classList.remove('hidden')
        darkIcon.classList.add('hidden')
      }
    }
  }
  function initTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light'
    applyTheme(cur)
    const btn = document.getElementById('theme-toggle')
    if (btn) {
      btn.addEventListener('click', () => {
        const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        showToast(next === 'dark' ? 'الوضع الليلي مفعّل' : 'الوضع النهاري مفعّل')
      })
    }
  }

  // ============== Mobile Menu ==============
  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn')
    const drawer = document.getElementById('mobile-drawer')
    if (!btn || !drawer) return
    btn.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open')
      drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true')
      document.body.style.overflow = isOpen ? 'hidden' : ''
    })
    // close on link click
    drawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        drawer.classList.remove('open')
        drawer.setAttribute('aria-hidden', 'true')
        document.body.style.overflow = ''
      })
    })
  }

  // ============== Copy buttons ==============
  function initCopy() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const target = document.querySelector(btn.getAttribute('data-copy-target') || '')
        if (!target) return
        const text = target.innerText.trim()
        try {
          await navigator.clipboard.writeText(text)
          showToast('تم النسخ بنجاح')
        } catch (e) {
          // fallback
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          try { document.execCommand('copy'); showToast('تم النسخ') } catch (er) { showToast('تعذر النسخ') }
          document.body.removeChild(ta)
        }
      })
    })
  }

  // ============== Share buttons ==============
  function initShare() {
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const surah = btn.getAttribute('data-surah')
        const ayah = btn.getAttribute('data-ayah')
        const url = window.location.origin + '/ayah/' + surah + '/' + ayah
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'تفسير الآية',
              text: 'اطّلع على تفسير الآية ' + ayah + ' من سورة ' + surah + ' في تطبيق تفسير',
              url: url,
            })
          } catch (e) { /* user cancelled */ }
        } else {
          try {
            await navigator.clipboard.writeText(url)
            showToast('تم نسخ الرابط')
          } catch (e) { showToast('تعذر النسخ') }
        }
      })
    })
  }

  // ============== Tafseer collapse/expand ==============
  function initTafseerCollapse() {
    const bodies = document.querySelectorAll('[data-collapsible="true"]')
    bodies.forEach(body => {
      // determine if it needs collapse (if too tall)
      requestAnimationFrame(() => {
        if (body.scrollHeight > 360) {
          body.classList.add('tafseer-collapsed')
          // add toggle button
          const wrap = body.parentElement
          const btn = document.createElement('button')
          btn.className = 'btn btn-ghost btn-sm'
          btn.style.margin = '0 1.5rem 1rem'
          btn.textContent = 'عرض المزيد'
          btn.addEventListener('click', () => {
            const collapsed = body.classList.toggle('tafseer-collapsed')
            btn.textContent = collapsed ? 'عرض المزيد' : 'عرض أقل'
          })
          if (wrap) wrap.appendChild(btn)
        }
      })
    })

    const expandAll = document.getElementById('expand-all')
    const collapseAll = document.getElementById('collapse-all')
    if (expandAll) {
      expandAll.addEventListener('click', () => {
        document.querySelectorAll('[data-collapsible="true"]').forEach(b => b.classList.remove('tafseer-collapsed'))
        showToast('تم توسيع كل التفاسير')
      })
    }
    if (collapseAll) {
      collapseAll.addEventListener('click', () => {
        document.querySelectorAll('[data-collapsible="true"]').forEach(b => {
          if (b.scrollHeight > 360) b.classList.add('tafseer-collapsed')
        })
        showToast('تم طيّ كل التفاسير')
      })
    }
  }

  // ============== Font Size ==============
  function initFontSize() {
    const sizes = ['', 'font-size-lg', 'font-size-xl']
    let cur = 0
    try {
      const saved = parseInt(localStorage.getItem('tafseer-font-size') || '0', 10)
      if (saved >= 0 && saved < sizes.length) cur = saved
    } catch (e) {}
    function apply() {
      sizes.forEach(s => { if (s) document.body.classList.remove(s) })
      if (sizes[cur]) document.body.classList.add(sizes[cur])
      try { localStorage.setItem('tafseer-font-size', String(cur)) } catch (e) {}
    }
    apply()
    const btn = document.getElementById('font-size-toggle')
    if (btn) {
      btn.addEventListener('click', () => {
        cur = (cur + 1) % sizes.length
        apply()
        const labels = ['الحجم الافتراضي', 'الحجم كبير', 'الحجم كبير جدًا']
        showToast(labels[cur])
      })
    }
  }

  // ============== Search debouncing on home ==============
  function initSearchSuggestions() {
    const input = document.querySelector('.hero-search input[name="q"]')
    if (!input) return
    let t
    input.addEventListener('input', e => {
      clearTimeout(t)
      t = setTimeout(() => {
        // could fetch suggestions; placeholder for future
      }, 250)
    })
  }

  // ============== Init ==============
  document.addEventListener('DOMContentLoaded', () => {
    initTheme()
    initMobileMenu()
    initCopy()
    initShare()
    initTafseerCollapse()
    initFontSize()
    initSearchSuggestions()
  })

  // ============== Service Worker (basic) ==============
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
})()
