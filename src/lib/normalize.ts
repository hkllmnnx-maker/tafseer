// تطبيع النص العربي للبحث - معالجة الهمزات والتشكيل و ة/ه و ى/ي
export function normalizeArabic(input: string): string {
  if (!input) return ''
  let s = input
  // إزالة التشكيل
  s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  // إزالة التطويل
  s = s.replace(/\u0640/g, '')
  // توحيد الألف
  s = s.replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, '\u0627')
  // توحيد الياء
  s = s.replace(/[\u0649\u064A]/g, '\u064A')
  // توحيد الواو
  s = s.replace(/[\u0624]/g, '\u0648')
  // توحيد الهاء/التاء المربوطة
  s = s.replace(/[\u0629]/g, '\u0647')
  // إزالة الهمزة المنفصلة
  s = s.replace(/[\u0621]/g, '')
  // إزالة العلامات غير العربية المتنوعة
  s = s.replace(/[\u200F\u200E\u202B\u202A\u202C]/g, '')
  // اختزال المسافات
  s = s.replace(/\s+/g, ' ').trim()
  return s.toLowerCase()
}

// تمييز الكلمات المطابقة في النص
export function highlightText(text: string, query: string): string {
  if (!query || !query.trim()) return escapeHtml(text)
  const normalizedQuery = normalizeArabic(query)
  const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 1)
  if (tokens.length === 0) return escapeHtml(text)

  // نبني خريطة بين فهرس النص الأصلي وفهرس النص المطبع
  const escapedText = escapeHtml(text)
  // تقسيم النص إلى أجزاء على أساس الكلمات
  const parts = escapedText.split(/(\s+)/)
  return parts
    .map(part => {
      if (/^\s+$/.test(part)) return part
      const normPart = normalizeArabic(part)
      const isMatch = tokens.some(t => normPart.includes(t))
      return isMatch ? `<mark>${part}</mark>` : part
    })
    .join('')
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// مسافة Levenshtein البسيطة لـ fuzzy search
export function fuzzyMatch(haystack: string, needle: string, threshold = 0.7): boolean {
  const a = normalizeArabic(haystack)
  const b = normalizeArabic(needle)
  if (!b) return true
  if (a.includes(b)) return true
  if (b.length < 3) return false
  // كلمات قريبة
  const words = a.split(/\s+/)
  for (const w of words) {
    if (w.length < 2) continue
    const dist = levenshtein(w, b)
    const score = 1 - dist / Math.max(w.length, b.length)
    if (score >= threshold) return true
  }
  return false
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

// تجزئة آمنة لـ HTML escape فقط
export function safeText(s: string): string {
  return escapeHtml(s)
}
