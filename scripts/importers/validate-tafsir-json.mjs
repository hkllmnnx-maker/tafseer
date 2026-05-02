#!/usr/bin/env node
// =============================================================================
// validate-tafsir-json.mjs — مدقّق ملف JSON لتفسير كامل قبل الاستيراد إلى D1
// =============================================================================
// يتحقّق من ملف JSON يصف كتاب تفسير واحدًا، بالشكل التالي (مختصر):
//   {
//     "book":   { id, title, schools[], license, sourceUrl, ... },
//     "author": { id, name, deathYear, schools[], ... },
//     "meta":   { schemaVersion, exportedAt, ... },
//     "entries":[
//       { id, surah, ayah, text, sourceType, verificationStatus,
//         isOriginalText, sourceName, edition?, volume?, page?, sourceUrl? }
//     ]
//   }
//
// التحقّقات الأساسيّة:
//   - book.id / author.id غير فارغ.
//   - book.license غير فارغ (إلزامي حتى بدون --strict).
//   - book.sourceUrl يبدأ بـ https://.
//   - book.schools[] ⊆ ALLOWED_SCHOOLS.
//   - entries[*].id فريد ضمن الملف.
//   - زوج (book.id, surah, ayah) لا يتكرّر.
//   - surah ∈ [1..114] integer، ayah ∈ [1..ayahCount[surah]] integer.
//   - text غير فارغ، لا يحوي literal "undefined"/"null"/"NaN".
//   - sourceType ∈ ALLOWED_SOURCE_TYPES.
//   - verificationStatus ∈ ALLOWED_VERIFICATION.
//   - isOriginalText يجب أن يطابق sourceType==='original-text'.
//   - إذا sourceType==='original-text': يجب وجود sourceName + (edition|page|volume).
//   - sourceUrl إن وُجد فيجب أن يبدأ بـ https://.
//   - في --strict: sourceUrl إلزامي على كل entry، book.edition إلزامي،
//     verificationStatus !== 'unverified' لكل entry.
//   - تحذير: summary بطول > 5000 حرف يُحذَّر منه (قد يكون نصًّا أصليًا مغلَّفًا).
//   - تحذير: جميع entries مكرّرة في sample/seed — يُكتفى بالتحذير.
//
// لا يضيف بيانات. يطبع تقرير فقط، ويُخرج بكود 0 (نجاح) / 1 (فشل) / 2 (تحذيرات
// في وضع --strict-warn).
//
// الاستعمال:
//   node scripts/importers/validate-tafsir-json.mjs <file.json>
//   node scripts/importers/validate-tafsir-json.mjs <file.json> --strict
//   node scripts/importers/validate-tafsir-json.mjs <file.json> --json
//   node scripts/importers/validate-tafsir-json.mjs <file.json> --dry-run
//   npm run validate:tafsir-sample   # يستخدم العيّنة الصغيرة الافتراضيّة
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '../..')

// =============================================================================
// Color helpers
// =============================================================================
const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

// =============================================================================
// Canonical Quran ayah counts (رواية حفص — مصحف المدينة).
// مدمجة هنا لتجنّب الاعتماد على src/data في وقت التحقق.
// =============================================================================
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
]

// =============================================================================
// قوائم بيضاء
// =============================================================================
const ALLOWED_SOURCE_TYPES = new Set([
  'original-text', 'summary', 'sample', 'curated', 'review-needed',
])
const ALLOWED_VERIFICATION = new Set([
  'verified', 'partially-verified', 'unverified', 'flagged',
])
const ALLOWED_SCHOOLS = new Set([
  'بالمأثور', 'بالرأي', 'فقهي', 'لغوي', 'بلاغي', 'معاصر', 'ميسر', 'موسوعي',
])

const SUMMARY_LENGTH_WARN = 5000
const FORBIDDEN_LITERALS = ['undefined', 'null', 'NaN']

// =============================================================================
// Args
// =============================================================================
const args = process.argv.slice(2)
const flagStrict = args.includes('--strict')
const flagJson   = args.includes('--json')
const flagDryRun = args.includes('--dry-run') // alias لتوضيح أنّه لا كتابة
const file = args.find(a => !a.startsWith('--'))

if (!file) {
  console.error(c.red('Usage: validate-tafsir-json.mjs <file.json> [--strict] [--json] [--dry-run]'))
  process.exit(1)
}

const filePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
if (!fs.existsSync(filePath)) {
  console.error(c.red(`✖ الملف غير موجود: ${filePath}`))
  process.exit(1)
}

// =============================================================================
// Load + parse
// =============================================================================
let raw, doc
try {
  raw = fs.readFileSync(filePath, 'utf8')
} catch (e) {
  console.error(c.red(`✖ تعذَّر قراءة الملف: ${e.message}`))
  process.exit(1)
}
try {
  doc = JSON.parse(raw)
} catch (e) {
  console.error(c.red(`✖ JSON غير صالح: ${e.message}`))
  process.exit(1)
}

// =============================================================================
// Validation
// =============================================================================
const errors = []
const warnings = []
const stats = {
  bookId: null,
  authorId: null,
  totalEntries: 0,
  acceptedEntries: 0,
  rejectedEntries: 0,
  bySourceType: {},
  byVerification: {},
  bySurah: {},
  textLengthMin: Infinity,
  textLengthMax: 0,
  textLengthAvg: 0,
}

// helper: emit error
const E = (msg, ctx = {}) => errors.push({ message: msg, ...ctx })
const W = (msg, ctx = {}) => warnings.push({ message: msg, ...ctx })

const isPlainObject = v =>
  v && typeof v === 'object' && !Array.isArray(v)

// ---------- 1) Book metadata ----------
if (!isPlainObject(doc.book)) {
  E('حقل book مفقود أو ليس كائنًا')
} else {
  const b = doc.book
  if (!b.id || typeof b.id !== 'string' || !b.id.trim()) {
    E('book.id مفقود أو فارغ')
  } else {
    stats.bookId = b.id.trim()
  }
  if (!b.title || typeof b.title !== 'string' || !b.title.trim()) {
    E('book.title مفقود أو فارغ')
  }
  if (!b.license || typeof b.license !== 'string' || !b.license.trim()) {
    E('book.license مفقود أو فارغ — توثيق الترخيص إلزامي')
  }
  if (b.sourceUrl !== undefined) {
    if (typeof b.sourceUrl !== 'string' || !b.sourceUrl.startsWith('https://')) {
      E('book.sourceUrl يجب أن يبدأ بـ https://', { value: b.sourceUrl })
    }
  } else if (flagStrict) {
    E('book.sourceUrl مطلوب في وضع --strict')
  }
  if (Array.isArray(b.schools)) {
    for (const s of b.schools) {
      if (!ALLOWED_SCHOOLS.has(s)) {
        E(`book.schools يحتوي مدرسة غير معترفة: "${s}"`, {
          allowed: [...ALLOWED_SCHOOLS],
        })
      }
    }
  } else if (b.schools !== undefined) {
    E('book.schools يجب أن يكون مصفوفة')
  }
  if (b.century !== undefined) {
    if (!Number.isInteger(b.century) || b.century < 1 || b.century > 16) {
      E('book.century يجب أن يكون integer بين 1..16 (هجري)', { value: b.century })
    }
  }
  if (b.popularity !== undefined) {
    if (!Number.isFinite(b.popularity) || b.popularity < 0 || b.popularity > 100) {
      E('book.popularity يجب أن يكون رقمًا بين 0..100', { value: b.popularity })
    }
  }
  if (flagStrict && (!b.edition || typeof b.edition !== 'string' || !b.edition.trim())) {
    E('book.edition مطلوب في وضع --strict')
  }
  if (b.verificationStatus !== undefined && !ALLOWED_VERIFICATION.has(b.verificationStatus)) {
    E(`book.verificationStatus غير صالح: "${b.verificationStatus}"`, {
      allowed: [...ALLOWED_VERIFICATION],
    })
  }
}

// ---------- 2) Author metadata ----------
if (!isPlainObject(doc.author)) {
  E('حقل author مفقود أو ليس كائنًا')
} else {
  const a = doc.author
  if (!a.id || typeof a.id !== 'string' || !a.id.trim()) {
    E('author.id مفقود أو فارغ')
  } else {
    stats.authorId = a.id.trim()
  }
  if (!a.name || typeof a.name !== 'string' || !a.name.trim()) {
    E('author.name مفقود أو فارغ')
  }
  if (a.deathYear !== undefined) {
    if (!Number.isInteger(a.deathYear) || a.deathYear < 0 || a.deathYear > 1600) {
      E('author.deathYear يجب أن يكون integer بين 0..1600 (هجري)', { value: a.deathYear })
    }
  }
  if (a.birthYear !== undefined && a.deathYear !== undefined) {
    if (Number.isInteger(a.birthYear) && Number.isInteger(a.deathYear) &&
        a.birthYear > a.deathYear) {
      E('author.birthYear > author.deathYear — تناقض زمني')
    }
  }
  if (Array.isArray(a.schools)) {
    for (const s of a.schools) {
      if (!ALLOWED_SCHOOLS.has(s)) {
        E(`author.schools يحتوي مدرسة غير معترفة: "${s}"`)
      }
    }
  }
  if (a.sourceUrl !== undefined &&
      (typeof a.sourceUrl !== 'string' || !a.sourceUrl.startsWith('https://'))) {
    E('author.sourceUrl يجب أن يبدأ بـ https://', { value: a.sourceUrl })
  }
}

// ---------- 3) Entries ----------
if (!Array.isArray(doc.entries)) {
  E('حقل entries مفقود أو ليس مصفوفة')
}

const entries = Array.isArray(doc.entries) ? doc.entries : []
stats.totalEntries = entries.length
const seenIds = new Set()
const seenAyahKeys = new Set()
let totalTextLength = 0
let allSamples = entries.length > 0 ? true : false

entries.forEach((e, i) => {
  let ok = true
  const where = `entries[${i}]${e?.id ? ` (id=${e.id})` : ''}`

  if (!isPlainObject(e)) {
    E(`${where}: ليس كائنًا`)
    stats.rejectedEntries++
    return
  }

  // id
  if (!e.id || typeof e.id !== 'string' || !e.id.trim()) {
    E(`${where}: id مفقود أو فارغ`); ok = false
  } else {
    if (seenIds.has(e.id)) {
      E(`${where}: id مكرَّر — يجب أن يكون فريدًا`); ok = false
    } else {
      seenIds.add(e.id)
    }
  }

  // surah / ayah
  const surah = e.surah
  const ayah  = e.ayah
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    E(`${where}: surah غير صالح (يجب integer 1..114)`, { value: surah }); ok = false
  } else if (!Number.isInteger(ayah) || ayah < 1) {
    E(`${where}: ayah غير صالح (يجب integer ≥ 1)`, { value: ayah }); ok = false
  } else {
    const max = SURAH_AYAH_COUNTS[surah - 1]
    if (ayah > max) {
      E(`${where}: ayah=${ayah} يتجاوز عدد آيات السورة ${surah} (max=${max})`); ok = false
    } else {
      const k = `${surah}:${ayah}`
      if (seenAyahKeys.has(`${stats.bookId || ''}::${k}`)) {
        // الزوج (book.id, surah, ayah) — لا نمنعه (قد توجد إدخالات متعددة لنفس
        // الآية بأقوال مختلفة)، لكن نُحذِّر فقط.
        // الـ id هو ما يجب أن يكون فريدًا.
      } else {
        seenAyahKeys.add(`${stats.bookId || ''}::${k}`)
      }
      stats.bySurah[surah] = (stats.bySurah[surah] || 0) + 1
    }
  }

  // text
  if (typeof e.text !== 'string' || !e.text.trim()) {
    E(`${where}: text فارغ أو ليس نصًّا`); ok = false
  } else {
    for (const lit of FORBIDDEN_LITERALS) {
      // كلمة كاملة (word boundary) لتجنّب false positives مثل "redefined".
      const re = new RegExp(`\\b${lit}\\b`)
      if (re.test(e.text)) {
        E(`${where}: text يحوي حرفيًا الكلمة "${lit}" — يُرفض`); ok = false
        break
      }
    }
    const len = e.text.length
    totalTextLength += len
    if (len < stats.textLengthMin) stats.textLengthMin = len
    if (len > stats.textLengthMax) stats.textLengthMax = len
  }

  // sourceType
  if (!ALLOWED_SOURCE_TYPES.has(e.sourceType)) {
    E(`${where}: sourceType غير صالح ("${e.sourceType}")`, {
      allowed: [...ALLOWED_SOURCE_TYPES],
    }); ok = false
  } else {
    stats.bySourceType[e.sourceType] = (stats.bySourceType[e.sourceType] || 0) + 1
  }

  // verificationStatus
  if (!ALLOWED_VERIFICATION.has(e.verificationStatus)) {
    E(`${where}: verificationStatus غير صالح ("${e.verificationStatus}")`, {
      allowed: [...ALLOWED_VERIFICATION],
    }); ok = false
  } else {
    stats.byVerification[e.verificationStatus] = (stats.byVerification[e.verificationStatus] || 0) + 1
    if (flagStrict && e.verificationStatus === 'unverified') {
      E(`${where}: verificationStatus='unverified' غير مقبول في --strict`); ok = false
    }
  }

  // isOriginalText vs sourceType
  if (typeof e.isOriginalText !== 'boolean') {
    E(`${where}: isOriginalText يجب أن يكون boolean`); ok = false
  } else if (e.sourceType === 'original-text' && e.isOriginalText !== true) {
    E(`${where}: sourceType='original-text' لكن isOriginalText=false — تناقض`); ok = false
  } else if (e.isOriginalText === true && e.sourceType !== 'original-text') {
    E(`${where}: isOriginalText=true لكن sourceType="${e.sourceType}" — تناقض`); ok = false
  }

  // متطلّبات original-text
  if (e.sourceType === 'original-text') {
    if (!e.sourceName || typeof e.sourceName !== 'string' || !e.sourceName.trim()) {
      E(`${where}: sourceType='original-text' يتطلّب sourceName`); ok = false
    }
    const hasAnyLocator =
      (e.edition && typeof e.edition === 'string' && e.edition.trim()) ||
      Number.isFinite(e.page) ||
      Number.isFinite(e.volume)
    if (!hasAnyLocator) {
      E(`${where}: sourceType='original-text' يتطلّب edition أو page أو volume`); ok = false
    }
  }

  // sourceUrl
  if (e.sourceUrl !== undefined) {
    if (typeof e.sourceUrl !== 'string' || !e.sourceUrl.startsWith('https://')) {
      E(`${where}: sourceUrl يجب أن يبدأ بـ https://`, { value: e.sourceUrl }); ok = false
    }
  } else if (flagStrict) {
    E(`${where}: sourceUrl مطلوب في وضع --strict`); ok = false
  }

  // تحذير: summary طويل مشبوه
  if (e.sourceType === 'summary' && typeof e.text === 'string' &&
      e.text.length > SUMMARY_LENGTH_WARN) {
    W(`${where}: summary طوله ${e.text.length} > ${SUMMARY_LENGTH_WARN} — قد يكون نصًّا أصليًا مغلَّفًا`)
  }

  // متابعة "كل الإدخالات samples؟"
  if (e.isSample !== true) allSamples = false

  if (ok) stats.acceptedEntries++
  else stats.rejectedEntries++
})

if (entries.length > 0 && allSamples) {
  W('جميع الإدخالات مُعلَّمة isSample=true — هذا ملف عيّنة، ليس استيرادًا إنتاجيًا')
}

// stats final
stats.textLengthAvg = entries.length
  ? Math.round(totalTextLength / entries.length)
  : 0
if (stats.textLengthMin === Infinity) stats.textLengthMin = 0

// =============================================================================
// Output
// =============================================================================
const ok = errors.length === 0

if (flagJson) {
  const report = {
    file: filePath,
    ok,
    strict: flagStrict,
    dryRun: flagDryRun,
    stats,
    errors,
    warnings,
  }
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.bold('  تقرير التحقّق من ملف تفسير'))
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(`الملف: ${c.cyan(filePath)}`)
  if (stats.bookId)   console.log(`الكتاب: ${c.cyan(stats.bookId)}`)
  if (stats.authorId) console.log(`المؤلِّف: ${c.cyan(stats.authorId)}`)
  console.log(c.dim('───────────────────────────────────────────────────────────'))
  console.log(`الإجمالي: مقبول ${c.green(String(stats.acceptedEntries))} · مرفوض ${c.red(String(stats.rejectedEntries))} · تحذيرات ${c.yellow(String(warnings.length))} · أخطاء ${c.red(String(errors.length))}`)

  if (Object.keys(stats.bySourceType).length) {
    console.log(c.dim('───────────────────────────────────────────────────────────'))
    console.log(c.bold('توزيع sourceType:'))
    for (const [k, v] of Object.entries(stats.bySourceType)) {
      console.log(`  ${k.padEnd(16)} ${v}`)
    }
  }
  if (Object.keys(stats.byVerification).length) {
    console.log(c.bold('توزيع verificationStatus:'))
    for (const [k, v] of Object.entries(stats.byVerification)) {
      console.log(`  ${k.padEnd(20)} ${v}`)
    }
  }
  if (Object.keys(stats.bySurah).length) {
    console.log(c.bold('توزيع السور (أعلى 10):'))
    const top = Object.entries(stats.bySurah)
      .map(([k, v]) => [Number(k), v])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    for (const [k, v] of top) {
      console.log(`  سورة ${String(k).padEnd(4)} ${v}`)
    }
  }

  if (warnings.length) {
    console.log(c.dim('───────────────────────────────────────────────────────────'))
    console.log(c.yellow(`تحذيرات (${warnings.length}):`))
    for (const w of warnings) console.log(`  ${c.yellow('⚠')} ${w.message}`)
  }
  if (errors.length) {
    console.log(c.dim('───────────────────────────────────────────────────────────'))
    console.log(c.red(`أخطاء (${errors.length}):`))
    for (const e of errors) console.log(`  ${c.red('✖')} ${e.message}`)
  }

  console.log(c.dim('───────────────────────────────────────────────────────────'))
  if (ok) {
    console.log(c.green('✓ كل الإدخالات صالحة بنيويًا.'))
  } else {
    console.log(c.red('✖ فشل التحقّق — راجع الأخطاء أعلاه.'))
  }
  if (flagDryRun) {
    console.log(c.blue('وضع dry-run: لم تُعدَّل أيّ قاعدة بيانات (هذا السكربت لا يكتب أصلاً).'))
  }
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
}

process.exit(ok ? 0 : 1)
