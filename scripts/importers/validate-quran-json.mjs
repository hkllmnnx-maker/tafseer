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
//   - أرقام السور 1..114 ضمن قائمة canonical_surahs.json (مدمجة).
//   - رقم الآية لا يتجاوز ayahCount لكل سورة.
//   - لا تكرار في زوج (surah, ayah).
//   - لا نصّ فارغ.
//   - في وضع --full: يجب أن يكون عدد الآيات == 6236.
//   - في وضع --strict: حقول source و sourceUrl إلزامية.
//
// لا يضيف بيانات. يطبع تقرير فقط، ويُخرج بكود 0 (نجاح) أو 1 (فشل).
//
// الاستعمال:
//   node scripts/importers/validate-quran-json.mjs <file.json>
//   node scripts/importers/validate-quran-json.mjs <file.json> --full
//   node scripts/importers/validate-quran-json.mjs <file.json> --strict
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
// Validate
// =============================================================================
const errors  = []
const warnings = []
const seen = new Set() // surah:ayah
const perSurah = new Map() // surah → max ayah seen

for (let i = 0; i < ayahs.length; i++) {
  const a = ayahs[i]
  const idx = `[#${i}]`
  if (!a || typeof a !== 'object') { errors.push(`${idx} ليس كائنًا`); continue }

  // surah
  const surah = Number(a.surah)
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    errors.push(`${idx} surah غير صالح: ${a.surah}`); continue
  }
  // ayah
  const ayah = Number(a.ayah)
  if (!Number.isInteger(ayah) || ayah < 1) {
    errors.push(`${idx} ayah غير صالح: ${a.ayah}`); continue
  }
  const max = SURAH_AYAH_COUNTS[surah - 1]
  if (ayah > max) {
    errors.push(`${idx} surah=${surah} لا تحتوي على آية ${ayah} (max=${max})`)
    continue
  }
  // text
  if (typeof a.text !== 'string' || !a.text.trim()) {
    errors.push(`${idx} text فارغ في ${surah}:${ayah}`); continue
  }
  if (a.text.length > 2000) {
    warnings.push(`${idx} ${surah}:${ayah} نص آية طويل جدًا (${a.text.length} حرف)`)
  }
  // juz / page (اختيارية لكن إن وُجدت يجب أن تكون صحيحة)
  if (a.juz != null) {
    const j = Number(a.juz)
    if (!Number.isInteger(j) || j < 1 || j > 30) {
      errors.push(`${idx} juz غير صالح: ${a.juz}`); continue
    }
  }
  if (a.page != null) {
    const p = Number(a.page)
    if (!Number.isInteger(p) || p < 1 || p > 700) {
      errors.push(`${idx} page غير صالح: ${a.page}`); continue
    }
  }
  // source (في strict mode إلزامي إن لم يكن هناك source علوي)
  if (flagStrict) {
    const src = a.source || topSource
    const url = a.sourceUrl || topSourceUrl
    if (!src) errors.push(`${idx} source مفقود في strict mode (${surah}:${ayah})`)
    if (!url) warnings.push(`${idx} sourceUrl مفقود (${surah}:${ayah})`)
  }
  // duplicate
  const key = `${surah}:${ayah}`
  if (seen.has(key)) { errors.push(`${idx} مكرّر: ${key}`); continue }
  seen.add(key)
  // perSurah max
  perSurah.set(surah, Math.max(perSurah.get(surah) || 0, ayah))
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
    const seenMax = perSurah.get(i) || 0
    if (seenMax !== expectedMax) {
      errors.push(`--full: السورة ${i} ينقصها آيات (${seenMax}/${expectedMax})`)
    }
  }
}

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
    surahsCovered: perSurah.size,
    errors,
    warnings: warnings.slice(0, 30),
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
console.log(`عدد الآيات:     ${c.bold(String(ayahs.length))}`)
console.log(`السور المغطاة:  ${c.bold(String(perSurah.size))} / 114`)
if (topSource)   console.log(`المصدر:         ${topSource}`)
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
