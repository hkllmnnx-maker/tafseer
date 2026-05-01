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

  // ============== Bookmarks (LocalStorage) ==============
  const BOOKMARKS_KEY = 'tafseer-bookmarks'

  function readBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY)
      if (!raw) return []
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr : []
    } catch (e) { return [] }
  }
  function writeBookmarks(list) {
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list)) } catch (e) {}
    updateBookmarkBadge()
  }
  function bookmarkKey(surah, ayah) { return Number(surah) + ':' + Number(ayah) }
  function findBookmark(list, surah, ayah) {
    const key = bookmarkKey(surah, ayah)
    return list.findIndex(b => bookmarkKey(b.surah, b.ayah) === key)
  }
  function isBookmarked(surah, ayah) {
    return findBookmark(readBookmarks(), surah, ayah) > -1
  }
  function addBookmark(item) {
    const list = readBookmarks()
    if (findBookmark(list, item.surah, item.ayah) > -1) return false
    list.unshift({
      surah: Number(item.surah),
      ayah: Number(item.ayah),
      surahName: item.surahName || '',
      ayahText: item.ayahText || '',
      note: item.note || '',
      addedAt: Date.now(),
    })
    writeBookmarks(list)
    return true
  }
  function removeBookmark(surah, ayah) {
    const list = readBookmarks()
    const i = findBookmark(list, surah, ayah)
    if (i === -1) return false
    list.splice(i, 1)
    writeBookmarks(list)
    return true
  }
  function updateBookmarkNote(surah, ayah, note) {
    const list = readBookmarks()
    const i = findBookmark(list, surah, ayah)
    if (i === -1) return false
    list[i].note = note
    writeBookmarks(list)
    return true
  }

  function updateBookmarkBadge() {
    const badge = document.getElementById('bookmark-count-badge')
    if (!badge) return
    const count = readBookmarks().length
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count)
      badge.style.display = ''
    } else {
      badge.style.display = 'none'
    }
  }

  function applyBookmarkToggleState(btn, on) {
    if (!btn) return
    const label = btn.querySelector('.bookmark-toggle-label')
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.classList.toggle('is-bookmarked', !!on)
    if (label) label.textContent = on ? 'محفوظة في المفضلة' : 'حفظ في المفضلة'
  }

  function initBookmarkToggle() {
    const btn = document.getElementById('bookmark-toggle')
    if (!btn) return
    const surah = btn.getAttribute('data-surah')
    const ayah = btn.getAttribute('data-ayah')
    if (!surah || !ayah) return
    applyBookmarkToggleState(btn, isBookmarked(surah, ayah))
    btn.addEventListener('click', () => {
      if (isBookmarked(surah, ayah)) {
        removeBookmark(surah, ayah)
        applyBookmarkToggleState(btn, false)
        showToast('تمت إزالتها من المفضلة')
      } else {
        addBookmark({
          surah,
          ayah,
          surahName: btn.getAttribute('data-surah-name') || '',
          ayahText: btn.getAttribute('data-ayah-text') || '',
        })
        applyBookmarkToggleState(btn, true)
        showToast('تمت الإضافة إلى المفضلة')
      }
    })
  }

  function formatDateAr(ts) {
    try {
      const d = new Date(ts)
      const opts = { year: 'numeric', month: 'long', day: 'numeric' }
      return d.toLocaleDateString('ar', opts)
    } catch (e) { return '' }
  }

  function renderBookmarksList() {
    const list = document.getElementById('bookmarks-list')
    const empty = document.getElementById('bookmarks-empty')
    const toolbar = document.getElementById('bookmarks-toolbar')
    const counter = document.getElementById('bookmarks-count')
    const tpl = document.getElementById('bookmark-card-template')
    if (!list || !empty || !tpl) return
    const items = readBookmarks()
    list.innerHTML = ''
    if (!items.length) {
      empty.style.display = ''
      if (toolbar) toolbar.style.display = 'none'
      return
    }
    empty.style.display = 'none'
    if (toolbar) toolbar.style.display = 'flex'
    if (counter) counter.textContent = `${items.length} آية محفوظة`

    items.forEach(b => {
      const node = tpl.content.cloneNode(true)
      const card = node.querySelector('.bookmark-card')
      const url = `/ayah/${b.surah}/${b.ayah}`
      card.setAttribute('data-surah', String(b.surah))
      card.setAttribute('data-ayah', String(b.ayah))
      const surahNameEl = node.querySelector('.bookmark-surah-name')
      if (surahNameEl) surahNameEl.textContent = `سورة ${b.surahName || ''}`.trim()
      const ayahNumEl = node.querySelector('.bookmark-ayah-num')
      if (ayahNumEl) ayahNumEl.textContent = `الآية ${b.ayah}`
      const dateEl = node.querySelector('.bookmark-date')
      if (dateEl) dateEl.textContent = b.addedAt ? formatDateAr(b.addedAt) : ''
      const textEl = node.querySelector('.bookmark-text')
      if (textEl) textEl.textContent = b.ayahText || '(نص الآية غير متوفر في العيّنة)'
      const noteEl = node.querySelector('.bookmark-note')
      if (noteEl && b.note) {
        noteEl.textContent = '📝 ' + b.note
        noteEl.style.display = ''
      }
      const openA = node.querySelector('.bookmark-open')
      if (openA) openA.setAttribute('href', url)
      const cmpA = node.querySelector('.bookmark-compare')
      if (cmpA) cmpA.setAttribute('href', `/compare?surah=${b.surah}&ayah=${b.ayah}`)

      const removeBtn = node.querySelector('.bookmark-remove')
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          if (!confirm('هل تريد حذف هذه الآية من المفضلة؟')) return
          removeBookmark(b.surah, b.ayah)
          renderBookmarksList()
          showToast('تم الحذف')
        })
      }
      const editBtn = node.querySelector('.bookmark-edit-note')
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const cur = b.note || ''
          const next = prompt('أضف ملاحظة لهذه الآية:', cur)
          if (next === null) return
          updateBookmarkNote(b.surah, b.ayah, next.trim())
          renderBookmarksList()
          showToast('تم الحفظ')
        })
      }

      list.appendChild(node)
    })
  }

  function initBookmarksPage() {
    if (!document.getElementById('bookmarks-list')) return
    renderBookmarksList()
    const exportBtn = document.getElementById('export-bookmarks')
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const data = JSON.stringify(readBookmarks(), null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'tafseer-bookmarks-' + new Date().toISOString().slice(0, 10) + '.json'
        document.body.appendChild(a); a.click(); a.remove()
        URL.revokeObjectURL(url)
        showToast('تم تصدير ' + readBookmarks().length + ' عنصر')
      })
    }
    const importInput = document.getElementById('import-bookmarks')
    if (importInput) {
      importInput.addEventListener('change', e => {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const arr = JSON.parse(String(reader.result || '[]'))
            if (!Array.isArray(arr)) throw new Error('format')
            const cur = readBookmarks()
            let added = 0
            arr.forEach(item => {
              if (!item || typeof item.surah !== 'number' || typeof item.ayah !== 'number') return
              if (findBookmark(cur, item.surah, item.ayah) > -1) return
              cur.push({
                surah: item.surah,
                ayah: item.ayah,
                surahName: String(item.surahName || ''),
                ayahText: String(item.ayahText || ''),
                note: String(item.note || ''),
                addedAt: Number(item.addedAt) || Date.now(),
              })
              added++
            })
            // sort newest first
            cur.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
            writeBookmarks(cur)
            renderBookmarksList()
            showToast('تم استيراد ' + added + ' عنصر جديد')
          } catch (err) {
            showToast('ملف غير صالح')
          }
          importInput.value = ''
        }
        reader.readAsText(f)
      })
    }
    const clearBtn = document.getElementById('clear-bookmarks')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!readBookmarks().length) return
        if (!confirm('حذف كل الآيات من المفضلة؟ لا يمكن التراجع.')) return
        writeBookmarks([])
        renderBookmarksList()
        showToast('تم حذف الكل')
      })
    }
  }

  // ============== History (LocalStorage) ==============
  const HISTORY_KEY = 'tafseer-history'
  const HISTORY_LIMIT = 50

  function readHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (!raw) return []
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr : []
    } catch (e) { return [] }
  }
  function writeHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch (e) {}
  }
  function pushHistory(item) {
    if (!item || !item.surah || !item.ayah) return
    const list = readHistory()
    const key = Number(item.surah) + ':' + Number(item.ayah)
    const filtered = list.filter(h => (Number(h.surah) + ':' + Number(h.ayah)) !== key)
    filtered.unshift({
      surah: Number(item.surah),
      ayah: Number(item.ayah),
      surahName: String(item.surahName || ''),
      ayahText: String(item.ayahText || ''),
      visitedAt: Date.now(),
    })
    if (filtered.length > HISTORY_LIMIT) filtered.length = HISTORY_LIMIT
    writeHistory(filtered)
  }
  function removeHistory(surah, ayah) {
    const key = Number(surah) + ':' + Number(ayah)
    const list = readHistory().filter(h => (Number(h.surah) + ':' + Number(h.ayah)) !== key)
    writeHistory(list)
  }

  // Auto-track visit on ayah pages (uses bookmark-toggle data attributes already on page)
  function trackAyahVisit() {
    const btn = document.getElementById('bookmark-toggle')
    if (!btn) return
    const surah = btn.getAttribute('data-surah')
    const ayah = btn.getAttribute('data-ayah')
    if (!surah || !ayah) return
    pushHistory({
      surah,
      ayah,
      surahName: btn.getAttribute('data-surah-name') || '',
      ayahText: btn.getAttribute('data-ayah-text') || '',
    })
  }

  function renderHistoryList() {
    const list = document.getElementById('history-list')
    const empty = document.getElementById('history-empty')
    const toolbar = document.getElementById('history-toolbar')
    const counter = document.getElementById('history-count')
    const tpl = document.getElementById('history-card-template')
    if (!list || !empty || !tpl) return
    const items = readHistory()
    list.innerHTML = ''
    if (!items.length) {
      empty.style.display = ''
      if (toolbar) toolbar.style.display = 'none'
      return
    }
    empty.style.display = 'none'
    if (toolbar) toolbar.style.display = 'flex'
    if (counter) counter.textContent = `${items.length} زيارة محفوظة`

    items.forEach(h => {
      const node = tpl.content.cloneNode(true)
      const surahNameEl = node.querySelector('.bookmark-surah-name')
      if (surahNameEl) surahNameEl.textContent = `سورة ${h.surahName || ''}`.trim()
      const ayahNumEl = node.querySelector('.bookmark-ayah-num')
      if (ayahNumEl) ayahNumEl.textContent = `الآية ${h.ayah}`
      const dateEl = node.querySelector('.history-date')
      if (dateEl) dateEl.textContent = h.visitedAt ? formatDateAr(h.visitedAt) : ''
      const textEl = node.querySelector('.bookmark-text')
      if (textEl) textEl.textContent = h.ayahText || '(نص الآية غير متوفر في العيّنة)'
      const openA = node.querySelector('.history-open')
      if (openA) openA.setAttribute('href', `/ayah/${h.surah}/${h.ayah}`)
      const cmpA = node.querySelector('.history-compare')
      if (cmpA) cmpA.setAttribute('href', `/compare?surah=${h.surah}&ayah=${h.ayah}`)
      const removeBtn = node.querySelector('.history-remove')
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          removeHistory(h.surah, h.ayah)
          renderHistoryList()
          showToast('تمت الإزالة')
        })
      }
      list.appendChild(node)
    })
  }

  function initHistoryPage() {
    if (!document.getElementById('history-list')) return
    renderHistoryList()
    const clearBtn = document.getElementById('clear-history')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!readHistory().length) return
        if (!confirm('مسح كل سجل التصفح؟')) return
        writeHistory([])
        renderHistoryList()
        showToast('تم مسح السجل')
      })
    }
  }

  // Render recent on home page (last 5)
  function renderRecentOnHome() {
    const slot = document.getElementById('home-recent-list')
    const section = document.getElementById('home-recent-section')
    if (!slot || !section) return
    const items = readHistory().slice(0, 5)
    if (!items.length) { section.style.display = 'none'; return }
    section.style.display = ''
    slot.innerHTML = ''
    items.forEach(h => {
      const a = document.createElement('a')
      a.className = 'recent-chip'
      a.href = `/ayah/${h.surah}/${h.ayah}`
      a.innerHTML = `<span class="recent-chip-surah">سورة ${escapeHtmlClient(h.surahName || '')}</span>` +
        `<span class="recent-chip-ayah">آية ${h.ayah}</span>`
      slot.appendChild(a)
    })
  }
  function escapeHtmlClient(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
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
    updateBookmarkBadge()
    initBookmarkToggle()
    initBookmarksPage()
    trackAyahVisit()
    initHistoryPage()
    renderRecentOnHome()
  })

  // ============== Service Worker (basic) ==============
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
})()
