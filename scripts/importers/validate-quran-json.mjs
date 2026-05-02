#!/usr/bin/env node
// =============================================================================
// validate-quran-json.mjs — مدقّق ملف JSON للقرآن الكامل قبل الاستيراد إلى D1
// =============================================================================
// يتحقّق من ملف JSON يحتوي على نصوص آيات القرآن، بالشكل التالي:
//   {
//     "source": "...",          // اختياري على المستوى العلوي
//     "sourceUrl": "...",       // اختياري
//     "ayahs": [
//       { "surah": 1, "ayah": 1, "text": "...", "juz": 1, "page": 1,
//         "source": "...", "sourceUrl": "..." }, ...
//     ]
//   }
// أو مصفوفة آيات مباشرة:
//   [ { "surah": 1, "ayah": 1, "text": "..." }, ... ]
//
// التحقّقات:
//   - أرقام السور 1..114 ضمن قائمة canonical_surahs (مدمجة).
//   - رقم الآية صحيح (integer)، لا عشري، ولا يتجاوز ayahCount لكل سورة.
//   - لا تكرار في زوج (surah, ayah).
//   - لا نصّ فارغ.
//   - النصّ لا يحتوي كلمة literal "undefined" أو "null".
//   - sourceUrl إن وُجد فيجب أن يبدأ بـ https://.
//   - في وضع --full: يجب أن يكون عدد الآيات == 6236 وكل سورة كاملة.
//   - في وضع --strict: حقول source و sourceUrl إلزامية.
//   - في وضع --json: يطبع تقرير قابل للقراءة آليًا مع coverage لكل سورة.
//
// لا يضيف بيانات. يطبع تقرير فقط، ويُخرج بكود 0 (نجاح) أو 1 (فشل).
//
// الاستعمال:
//   node scripts/importers/validate-quran-json.mjs <file.json>
//   node scripts/importers/validate-quran-json.mjs <file.json> --full
//   node scripts/importers/validate-quran-json.mjs <file.json> --strict
//   node scripts/importers/validate-quran-json.mjs <file.json> --json
//   npm run validate:quran-sample   # يستخدم العينة الصغيرة الافتراضية
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '../..')

const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

// =============================================================================
// Canonical Quran metadata: 114 surahs and their ayah counts.
// Source: تعريف القرآن الكريم الموحَّد (مصحف المدينة، رواية حفص عن عاصم).
// نضمّن البيانات هنا لتجنّب الاعتماد على src/data في وقت التحقق.
// =============================================================================
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
]
const TOTAL_AYAHS_FULL = SURAH_AYAH_COUNTS.reduce((a, b) => a + b, 0) // 6236

// =============================================================================
// Args
// =============================================================================
const args = process.argv.slice(2)
const flagFull   = args.includes('--full')
const flagStrict = args.includes('--strict')
const flagJson   = args.includes('--json')
const file = args.find(a => !a.startsWith('--'))

if (!file) {
  console.error(c.red('Usage: validate-quran-json.mjs <file.json> [--full] [--strict] [--json]'))
  process.exit(2)
}

const filePath = path.isAbsolute(file) ? file : path.resolve(ROOT, file)
if (!fs.existsSync(filePath)) {
  console.error(c.red(`✗ الملف غير موجود: ${filePath}`))
  process.exit(2)
}

// =============================================================================
// Load
// =============================================================================
let payload
try {
  payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
} catch (e) {
  console.error(c.red(`✗ JSON غير صالح: ${e.message}`))
  process.exit(1)
}

const ayahs = Array.isArray(payload)
  ? payload
  : Array.isArray(payload?.ayahs)
    ? payload.ayahs
    : null

if (!ayahs) {
  console.error(c.red('✗ يجب أن يكون الملف مصفوفة، أو كائنًا فيه ayahs[].'))
  process.exit(1)
}

const topSource    = payload?.source || null
const topSourceUrl = payload?.sourceUrl || null

// =============================================================================
// Helpers
// =============================================================================
function isHttpsUrl(u) {
  return typeof u === 'string' && /^https:\/\//i.test(u.trim())
}
// fast strict-integer check (rejects "3.0", 3.5, NaN, "3 ")
function isStrictPositiveInteger(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0
  if (typeof v === 'string') {
    if (!/^\d+$/.test(v.trim())) return false
    const n = Number(v)
    return Number.isInteger(n) && n > 0
  }
  return false
}

// =============================================================================
// Validate
// =============================================================================
const errors  = []
const warnings = []
const seen = new Set() // surah:ayah
const perSurah = new Map() // surah → Set of seen ayah numbers

// top-level sourceUrl check (https only when present)
if (topSourceUrl != null && !isHttpsUrl(topSourceUrl)) {
  errors.push(`top-level sourceUrl يجب أن يبدأ بـ https:// — وُجد: ${topSourceUrl}`)
}

for (let i = 0; i < ayahs.length; i++) {
  const a = ayahs[i]
  const idx = `[#${i}]`
  if (!a || typeof a !== 'object') { errors.push(`${idx} ليس كائنًا`); continue }

  // surah
  if (!isStrictPositiveInteger(a.surah)) {
    errors.push(`${idx} surah يجب أن يكون عددًا صحيحًا موجبًا (لا عشري): ${a.surah}`); continue
  }
  const surah = Number(a.surah)
  if (surah < 1 || surah > 114) {
    errors.push(`${idx} surah غير صالح (خارج 1..114): ${a.surah}`); continue
  }
  // ayah — strict integer (no decimals like 3.5)
  if (!isStrictPositiveInteger(a.ayah)) {
    errors.push(`${idx} ayah يجب أن يكون عددًا صحيحًا موجبًا (لا عشري): ${a.ayah}`); continue
  }
  const ayah = Number(a.ayah)
  const max = SURAH_AYAH_COUNTS[surah - 1]
  if (ayah > max) {
    errors.push(`${idx} surah=${surah} لا تحتوي على آية ${ayah} (max=${max})`)
    continue
  }
  // text
  if (typeof a.text !== 'string' || !a.text.trim()) {
    errors.push(`${idx} text فارغ في ${surah}:${ayah}`); continue
  }
  // text must NOT contain literal "undefined" / "null" tokens (often from broken templating)
  if (/\bundefined\b/i.test(a.text)) {
    errors.push(`${idx} ${surah}:${ayah} text يحتوي كلمة "undefined" — مؤشر بيانات تالفة`)
    continue
  }
  if (/\bnull\b/.test(a.text)) {
    warnings.push(`${idx} ${surah}:${ayah} text يحتوي كلمة "null" — تحقّق من المصدر`)
  }
  if (a.text.length > 2000) {
    warnings.push(`${idx} ${surah}:${ayah} نص آية طويل جدًا (${a.text.length} حرف)`)
  }
  // juz / page (اختيارية لكن إن وُجدت يجب أن تكون صحيحة)
  if (a.juz != null) {
    if (!isStrictPositiveInteger(a.juz)) {
      errors.push(`${idx} juz يجب أن يكون عددًا صحيحًا (لا عشري): ${a.juz}`); continue
    }
    const j = Number(a.juz)
    if (j < 1 || j > 30) {
      errors.push(`${idx} juz غير صالح: ${a.juz}`); continue
    }
  }
  if (a.page != null) {
    if (!isStrictPositiveInteger(a.page)) {
      errors.push(`${idx} page يجب أن يكون عددًا صحيحًا (لا عشري): ${a.page}`); continue
    }
    const p = Number(a.page)
    if (p < 1 || p > 700) {
      errors.push(`${idx} page غير صالح: ${a.page}`); continue
    }
  }
  // sourceUrl per-ayah (https only when present)
  if (a.sourceUrl != null && !isHttpsUrl(a.sourceUrl)) {
    errors.push(`${idx} ${surah}:${ayah} sourceUrl يجب أن يبدأ بـ https:// — وُجد: ${a.sourceUrl}`)
    continue
  }
  // source (في strict mode إلزامي إن لم يكن هناك source علوي)
  if (flagStrict) {
    const src = a.source || topSource
    const url = a.sourceUrl || topSourceUrl
    if (!src) errors.push(`${idx} source مفقود في strict mode (${surah}:${ayah})`)
    if (!url) errors.push(`${idx} sourceUrl مفقود في strict mode (${surah}:${ayah})`)
  }
  // duplicate
  const key = `${surah}:${ayah}`
  if (seen.has(key)) { errors.push(`${idx} مكرّر: ${key}`); continue }
  seen.add(key)
  // perSurah set
  let s = perSurah.get(surah)
  if (!s) { s = new Set(); perSurah.set(surah, s) }
  s.add(ayah)
}

// =============================================================================
// Full mode: total must equal 6236; per-surah must equal ayahCount.
// =============================================================================
if (flagFull) {
  if (ayahs.length !== TOTAL_AYAHS_FULL) {
    errors.push(`--full: عدد الآيات الكلي = ${ayahs.length}، المتوقَّع = ${TOTAL_AYAHS_FULL}`)
  }
  for (let i = 1; i <= 114; i++) {
    const expectedMax = SURAH_AYAH_COUNTS[i - 1]
    const seenSet = perSurah.get(i)
    const seenCount = seenSet ? seenSet.size : 0
    if (seenCount !== expectedMax) {
      errors.push(`--full: السورة ${i} ينقصها آيات (${seenCount}/${expectedMax})`)
    }
  }
}

// =============================================================================
// Coverage report (per-surah)
// =============================================================================
function buildCoverage() {
  const rows = []
  for (let i = 1; i <= 114; i++) {
    const expected = SURAH_AYAH_COUNTS[i - 1]
    const seenSet = perSurah.get(i)
    const have = seenSet ? seenSet.size : 0
    rows.push({
      surah: i,
      have,
      expected,
      complete: have === expected,
      percent: Number(((have / expected) * 100).toFixed(2)),
    })
  }
  const surahsComplete = rows.filter(r => r.complete).length
  const surahsPartial  = rows.filter(r => r.have > 0 && !r.complete).length
  const surahsEmpty    = rows.filter(r => r.have === 0).length
  return { rows, surahsComplete, surahsPartial, surahsEmpty }
}

const coverage = buildCoverage()

// =============================================================================
// Report
// =============================================================================
const ok = errors.length === 0

if (flagJson) {
  console.log(JSON.stringify({
    ok,
    file: path.relative(ROOT, filePath),
    mode: flagFull ? 'full' : 'partial',
    strict: flagStrict,
    totalAyahs: ayahs.length,
    expectedTotal: TOTAL_AYAHS_FULL,
    surahsCovered: perSurah.size,
    surahsComplete: coverage.surahsComplete,
    surahsPartial:  coverage.surahsPartial,
    surahsEmpty:    coverage.surahsEmpty,
    coverage: coverage.rows,
    source: topSource || null,
    sourceUrl: topSourceUrl || null,
    errors,
    warnings: warnings.slice(0, 50),
    warningsCount: warnings.length,
  }, null, 2))
  process.exit(ok ? 0 : 1)
}

console.log()
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(c.bold('              تقرير تحقق ملف القرآن JSON'))
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(`الملف:          ${path.relative(ROOT, filePath)}`)
console.log(`الوضع:          ${flagFull ? c.bold('full (6236 آية مطلوبة)') : 'partial'}`)
console.log(`strict:         ${flagStrict ? 'نعم' : 'لا'}`)
console.log(`عدد الآيات:     ${c.bold(String(ayahs.length))} / ${TOTAL_AYAHS_FULL}`)
console.log(`السور المغطاة:  ${c.bold(String(perSurah.size))} / 114`)
console.log(`سور كاملة:      ${c.green(String(coverage.surahsComplete))}`)
console.log(`سور جزئية:      ${c.yellow(String(coverage.surahsPartial))}`)
console.log(`سور فارغة:      ${c.dim(String(coverage.surahsEmpty))}`)
if (topSource)    console.log(`المصدر:         ${topSource}`)
if (topSourceUrl) console.log(`رابط المصدر:    ${topSourceUrl}`)
console.log(c.dim('───────────────────────────────────────────────────────────'))

if (warnings.length) {
  console.log(c.yellow(`⚠ تحذيرات: ${warnings.length}`))
  for (const w of warnings.slice(0, 10)) console.log('  - ' + w)
  if (warnings.length > 10) console.log(c.dim(`  ...و${warnings.length - 10} أخرى`))
}

if (!ok) {
  console.log(c.red(`✗ أخطاء: ${errors.length}`))
  for (const e of errors.slice(0, 30)) console.log('  - ' + e)
  if (errors.length > 30) console.log(c.dim(`  ...و${errors.length - 30} أخرى`))
} else {
  console.log(c.green('✓ كل الآيات صالحة بنيويًا.'))
}

console.log(c.bold('═══════════════════════════════════════════════════════════'))
process.exit(ok ? 0 : 1)
