#!/usr/bin/env node
// =============================================================================
// validate-import.mjs — مدقّق ملفات استيراد متعدّد الأنواع لمشروع تفسير
//
// يدعم 4 أنواع من ملفات الاستيراد:
//   1) tafseers — إدخالات تفسير لآيات (الأكثر استعمالًا)
//   2) ayahs    — نصوص آيات
//   3) books    — كتب تفسير
//   4) authors  — مؤلفون
//
// نوع الملف يُكتشف تلقائيًا من اسم الملف ومحتواه، أو يُحدَّد صراحةً عبر:
//   --type=tafseers | ayahs | books | authors
//
// الاستعمال:
//   node scripts/importers/validate-import.mjs <file.json> [--dry-run] [--verbose]
//   node scripts/importers/validate-import.mjs <file.json> --type=tafseers
//   node scripts/importers/validate-import.mjs file1.json file2.json ...
//
// المخرجات:
//   - تقرير ملوّن في الطرفية + رمز خروج 0 (نجاح) / 1 (فشل) / 2 (تحذيرات).
// =============================================================================

import { readFileSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import process from 'node:process'

// =============== قوائم بيضاء ===============
const ALLOWED_SOURCE_TYPES = new Set([
  'original-text', 'summary', 'sample', 'review-needed', 'curated',
])
const ALLOWED_VERIFICATION = new Set([
  'verified', 'partially-verified', 'unverified', 'flagged',
])
const ALLOWED_SCHOOLS = new Set([
  'بالمأثور', 'بالرأي', 'فقهي', 'لغوي', 'بلاغي', 'معاصر', 'ميسر', 'موسوعي',
])
const ALLOWED_SURAH_TYPES = new Set(['مكية', 'مدنية'])

// أحجام السور (لتأكيد رقم الآية)
const SURAH_AYAH_COUNTS = {
  1:7,2:286,3:200,4:176,5:120,6:165,7:206,8:75,9:129,10:109,
  11:123,12:111,13:43,14:52,15:99,16:128,17:111,18:110,19:98,20:135,
  21:112,22:78,23:118,24:64,25:77,26:227,27:93,28:88,29:69,30:60,
  31:34,32:30,33:73,34:54,35:45,36:83,37:182,38:88,39:75,40:85,
  41:54,42:53,43:89,44:59,45:37,46:35,47:38,48:29,49:18,50:45,
  51:60,52:49,53:62,54:55,55:78,56:96,57:29,58:22,59:24,60:13,
  61:14,62:11,63:11,64:18,65:12,66:12,67:30,68:52,69:52,70:44,
  71:28,72:28,73:20,74:56,75:40,76:31,77:50,78:40,79:46,80:42,
  81:29,82:19,83:36,84:25,85:22,86:17,87:19,88:26,89:30,90:20,
  91:15,92:21,93:11,94:8,95:8,96:19,97:5,98:8,99:8,100:11,
  101:11,102:8,103:3,104:9,105:5,106:4,107:7,108:3,109:6,110:3,
  111:5,112:4,113:5,114:6,
}

const C = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue: s => `\x1b[34m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
}

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--') && !a.startsWith('--type=')))
const typeFlag = args.find(a => a.startsWith('--type='))
const explicitType = typeFlag ? typeFlag.split('=')[1] : null
const files = args.filter(a => !a.startsWith('--'))
const isDryRun = flags.has('--dry-run')
const isVerbose = flags.has('--verbose')

if (!files.length) {
  console.error(C.red('✖ لم تُحدَّد ملفات للتحقّق.'))
  console.error('الاستعمال:')
  console.error('  node scripts/importers/validate-import.mjs <file.json> [--dry-run] [--verbose]')
  console.error('  node scripts/importers/validate-import.mjs <file.json> --type=tafseers|ayahs|books|authors')
  process.exit(1)
}

// خريطة المدقّقات (تُعرَّف هنا قبل أي استدعاء لـ validateFile لتجنّب TDZ).
const ROW_VALIDATORS = {
  tafseers: validateTafseerRow,
  ayahs: validateAyahRow,
  books: validateBookRow,
  authors: validateAuthorRow,
}

let totalErrors = 0
let totalWarnings = 0
let totalAccepted = 0
let totalRejected = 0
const fileSummaries = []

for (const file of files) {
  const summary = validateFile(file)
  fileSummaries.push(summary)
  totalErrors += summary.errors.length
  totalWarnings += summary.warnings.length
  totalAccepted += summary.accepted
  totalRejected += summary.rejected
}

// ============= تقرير نهائي =============
console.log()
console.log(C.bold('═══════════════════════════════════════════════════════════'))
console.log(C.bold('                    تقرير التحقق النهائي'))
console.log(C.bold('═══════════════════════════════════════════════════════════'))
for (const s of fileSummaries) {
  const status = s.errors.length === 0
    ? (s.warnings.length === 0 ? C.green('✓ ناجح') : C.yellow('⚠ تحذيرات'))
    : C.red('✖ فاشل')
  const typeTag = C.cyan(`[${s.detectedType || '?'}]`)
  console.log(`${status} ${typeTag} ${C.bold(basename(s.file))} — مقبول ${s.accepted} | مرفوض ${s.rejected} | تحذيرات ${s.warnings.length}`)
}
console.log(C.dim('───────────────────────────────────────────────────────────'))
console.log(`الإجمالي: مقبول ${C.green(String(totalAccepted))} · مرفوض ${C.red(String(totalRejected))} · تحذيرات ${C.yellow(String(totalWarnings))} · أخطاء ${C.red(String(totalErrors))}`)
if (isDryRun) console.log(C.blue('وضع dry-run: لم تُعدَّل أي قاعدة بيانات.'))
console.log(C.bold('═══════════════════════════════════════════════════════════'))

if (totalErrors > 0) process.exit(1)
if (totalWarnings > 0) process.exit(2)
process.exit(0)

// =============================================================================
// منطق التحقق العام
// =============================================================================

function validateFile(file) {
  const summary = {
    file, errors: [], warnings: [], accepted: 0, rejected: 0,
    detectedType: null,
  }
  const fp = resolve(process.cwd(), file)
  let stat
  try { stat = statSync(fp) } catch (e) {
    summary.errors.push(`الملف غير موجود: ${file}`)
    print(summary)
    return summary
  }
  if (!stat.isFile()) {
    summary.errors.push(`ليس ملفًا: ${file}`)
    print(summary)
    return summary
  }
  let raw
  try { raw = readFileSync(fp, 'utf8') } catch (e) {
    summary.errors.push(`تعذّر القراءة: ${e.message}`)
    print(summary)
    return summary
  }
  let data
  try { data = JSON.parse(raw) } catch (e) {
    summary.errors.push(`JSON غير صالح: ${e.message}`)
    print(summary)
    return summary
  }
  if (!Array.isArray(data)) {
    summary.errors.push('الملف يجب أن يكون مصفوفة JSON من الإدخالات.')
    print(summary)
    return summary
  }

  // اكتشاف النوع
  const detected = explicitType || detectType(file, data)
  if (!detected) {
    summary.errors.push(
      'تعذّر اكتشاف نوع الملف. استخدم --type=tafseers|ayahs|books|authors أو سمِّ الملف بـ valid-tafseers* أو ضمّن حقولًا مميّزة.'
    )
    print(summary)
    return summary
  }
  summary.detectedType = detected

  const validator = ROW_VALIDATORS[detected]
  if (!validator) {
    summary.errors.push(`نوع غير مدعوم: ${detected}`)
    print(summary)
    return summary
  }

  const seenIds = new Set()
  const seenKeys = new Set() // لإدخالات بدون id (مثل ayahs)
  data.forEach((row, idx) => {
    const ctx = `[#${idx + 1}]`
    const result = validator(row, idx, seenIds, seenKeys)
    const errs = result.errors || []
    const warns = result.warnings || []
    if (errs.length) {
      summary.rejected++
      errs.forEach(e => summary.errors.push(`${ctx} ${e}`))
    } else {
      summary.accepted++
    }
    warns.forEach(w => summary.warnings.push(`${ctx} ${w}`))
  })

  print(summary)
  return summary
}

/**
 * يكتشف نوع الملف من اسمه أولًا ثم من حقوله.
 */
function detectType(file, data) {
  const name = basename(file).toLowerCase()
  if (name.includes('tafseer') || name.includes('tafsir')) return 'tafseers'
  if (name.includes('ayah') || name.includes('verse')) return 'ayahs'
  if (name.includes('book')) return 'books'
  if (name.includes('author')) return 'authors'
  // fallback: من الحقول
  if (!data.length) return null
  const first = data[0] || {}
  if ('text' in first && 'sourceType' in first && 'bookId' in first) return 'tafseers'
  if ('text' in first && 'surah' in first && 'number' in first && !('bookId' in first)) return 'ayahs'
  if ('title' in first && 'authorId' in first) return 'books'
  if ('deathYear' in first || 'fullName' in first) return 'authors'
  return null
}

// =============================================================================
// مدقّقات لكل نوع (ROW_VALIDATORS مُعرَّف في الأعلى لتجنّب TDZ)
// =============================================================================

// ---------- tafseers ----------
function validateTafseerRow(row, idx, seenIds /*, seenKeys */) {
  const errors = []
  const warnings = []
  if (!row || typeof row !== 'object') {
    errors.push('الإدخال ليس كائنًا.')
    return { errors, warnings }
  }
  if (!row.id || typeof row.id !== 'string') {
    errors.push('الحقل id إلزامي وسلسلة نصّية.')
  } else if (seenIds.has(row.id)) {
    errors.push(`id مكرّر داخل نفس الملف: ${row.id}`)
  } else {
    seenIds.add(row.id)
  }
  if (!row.bookId || typeof row.bookId !== 'string') errors.push('bookId إلزامي.')
  if (!Number.isInteger(row.surah) || row.surah < 1 || row.surah > 114) {
    errors.push(`surah غير صالح (1..114): ${row.surah}`)
  }
  if (!Number.isInteger(row.ayah) || row.ayah < 1) {
    errors.push(`ayah غير صالح: ${row.ayah}`)
  }
  if (Number.isInteger(row.surah) && Number.isInteger(row.ayah)) {
    const max = SURAH_AYAH_COUNTS[row.surah]
    if (max && row.ayah > max) {
      errors.push(`ayah=${row.ayah} يتجاوز عدد آيات السورة ${row.surah} (=${max}).`)
    }
  }
  if (!row.text || typeof row.text !== 'string' || row.text.trim().length < 5) {
    errors.push('text إلزامي ولا يقل عن 5 أحرف.')
  }
  if (!row.sourceType || !ALLOWED_SOURCE_TYPES.has(row.sourceType)) {
    errors.push(`sourceType إلزامي من القائمة: ${[...ALLOWED_SOURCE_TYPES].join(' | ')}`)
  }
  if (!row.verificationStatus || !ALLOWED_VERIFICATION.has(row.verificationStatus)) {
    errors.push(`verificationStatus إلزامي من القائمة: ${[...ALLOWED_VERIFICATION].join(' | ')}`)
  }
  // قيود تماسك علمي
  if (row.sourceType === 'original-text' && row.isOriginalText === false) {
    errors.push('تعارض: sourceType="original-text" مع isOriginalText=false.')
  }
  if (row.verificationStatus === 'verified') {
    if (!row.sourceName) errors.push('verified يستلزم sourceName صريحًا.')
    if (!row.edition && row.page == null) {
      warnings.push('verified بدون edition أو page — يُستحسن إضافتهما.')
    }
  }
  // قيود اختيارية على الأنواع
  if (row.volume != null && !Number.isInteger(row.volume)) errors.push('volume يجب أن يكون عددًا صحيحًا.')
  if (row.page != null && !Number.isInteger(row.page)) errors.push('page يجب أن يكون عددًا صحيحًا.')
  if (row.sourceUrl != null && typeof row.sourceUrl !== 'string') errors.push('sourceUrl يجب أن يكون نصًا.')
  if (row.isOriginalText != null && typeof row.isOriginalText !== 'boolean') {
    errors.push('isOriginalText يجب أن يكون boolean.')
  }
  // تحذيرات أسلوبية
  if (errors.length === 0) {
    if (!row.sourceUrl && row.sourceType === 'original-text') {
      warnings.push('نص أصلي بدون sourceUrl — يُستحسن إضافة رابط للمصدر.')
    }
    if (row.text && row.text.length < 30) {
      warnings.push(`نص قصير جدًا (${row.text.length} حرف).`)
    }
  }
  return { errors, warnings }
}

// ---------- ayahs ----------
function validateAyahRow(row, idx, seenIds, seenKeys) {
  const errors = []
  const warnings = []
  if (!row || typeof row !== 'object') {
    errors.push('الإدخال ليس كائنًا.')
    return { errors, warnings }
  }
  if (!Number.isInteger(row.surah) || row.surah < 1 || row.surah > 114) {
    errors.push(`surah غير صالح (1..114): ${row.surah}`)
  }
  if (!Number.isInteger(row.number) || row.number < 1) {
    errors.push(`number غير صالح: ${row.number}`)
  }
  if (Number.isInteger(row.surah) && Number.isInteger(row.number)) {
    const max = SURAH_AYAH_COUNTS[row.surah]
    if (max && row.number > max) {
      errors.push(`number=${row.number} يتجاوز عدد آيات السورة ${row.surah} (=${max}).`)
    }
    const key = `${row.surah}:${row.number}`
    if (seenKeys.has(key)) errors.push(`آية مكرّرة داخل نفس الملف: ${key}`)
    else seenKeys.add(key)
  }
  if (!row.text || typeof row.text !== 'string' || row.text.trim().length < 1) {
    errors.push('text إلزامي وسلسلة نصّية غير فارغة.')
  }
  if (row.juz != null && (!Number.isInteger(row.juz) || row.juz < 1 || row.juz > 30)) {
    errors.push('juz يجب أن يكون 1..30.')
  }
  if (row.page != null && (!Number.isInteger(row.page) || row.page < 1 || row.page > 700)) {
    errors.push('page يجب أن يكون 1..700.')
  }
  if (errors.length === 0 && row.text && row.text.length < 3) {
    warnings.push(`نص الآية قصير جدًا (${row.text.length} حرف) — تأكّد من سلامة البيانات.`)
  }
  return { errors, warnings }
}

// ---------- books ----------
function validateBookRow(row, idx, seenIds /*, seenKeys */) {
  const errors = []
  const warnings = []
  if (!row || typeof row !== 'object') {
    errors.push('الإدخال ليس كائنًا.')
    return { errors, warnings }
  }
  if (!row.id || typeof row.id !== 'string') errors.push('id إلزامي.')
  else if (seenIds.has(row.id)) errors.push(`id مكرّر: ${row.id}`)
  else seenIds.add(row.id)
  if (!row.title || typeof row.title !== 'string') errors.push('title إلزامي.')
  if (!row.authorId || typeof row.authorId !== 'string') errors.push('authorId إلزامي.')
  if (row.fullTitle != null && typeof row.fullTitle !== 'string') errors.push('fullTitle نص.')
  if (row.description != null && typeof row.description !== 'string') errors.push('description نص.')
  if (row.popularity != null && (!Number.isInteger(row.popularity) || row.popularity < 1 || row.popularity > 10)) {
    errors.push('popularity 1..10.')
  }
  if (row.volumes != null && (!Number.isInteger(row.volumes) || row.volumes < 1)) {
    errors.push('volumes عدد صحيح موجب.')
  }
  if (row.featured != null && typeof row.featured !== 'boolean') errors.push('featured boolean.')
  if (row.schools != null) {
    if (!Array.isArray(row.schools)) errors.push('schools مصفوفة.')
    else {
      for (const s of row.schools) {
        if (!ALLOWED_SCHOOLS.has(s)) {
          errors.push(`مدرسة غير معروفة: "${s}". المسموح: ${[...ALLOWED_SCHOOLS].join(' | ')}`)
        }
      }
    }
  }
  return { errors, warnings }
}

// ---------- authors ----------
function validateAuthorRow(row, idx, seenIds /*, seenKeys */) {
  const errors = []
  const warnings = []
  if (!row || typeof row !== 'object') {
    errors.push('الإدخال ليس كائنًا.')
    return { errors, warnings }
  }
  if (!row.id || typeof row.id !== 'string') errors.push('id إلزامي.')
  else if (seenIds.has(row.id)) errors.push(`id مكرّر: ${row.id}`)
  else seenIds.add(row.id)
  if (!row.name || typeof row.name !== 'string') errors.push('name إلزامي.')
  if (row.fullName != null && typeof row.fullName !== 'string') errors.push('fullName نص.')
  if (!Number.isInteger(row.deathYear) || row.deathYear < 1 || row.deathYear > 1500) {
    errors.push('deathYear 1..1500 (هجري).')
  }
  if (row.birthYear != null && (!Number.isInteger(row.birthYear) || row.birthYear < 0 || row.birthYear > 1500)) {
    errors.push('birthYear 0..1500 (هجري).')
  }
  if (!Number.isInteger(row.century) || row.century < 1 || row.century > 15) {
    errors.push('century 1..15 (هجري).')
  }
  if (row.bio != null && typeof row.bio !== 'string') errors.push('bio نص.')
  if (row.origin != null && typeof row.origin !== 'string') errors.push('origin نص.')
  if (Number.isInteger(row.birthYear) && Number.isInteger(row.deathYear) && row.birthYear > row.deathYear) {
    errors.push('تعارض: birthYear بعد deathYear.')
  }
  return { errors, warnings }
}

// =============================================================================
// طباعة تقرير ملف واحد
// =============================================================================
function print(summary) {
  const head = C.bold(basename(summary.file))
  const tag = summary.detectedType ? C.cyan(` [${summary.detectedType}]`) : ''
  console.log()
  console.log(`▸ ${head}${tag}`)
  if (summary.errors.length === 0 && summary.warnings.length === 0) {
    console.log(C.green(`  ✓ ${summary.accepted} إدخال صالح`))
    return
  }
  if (summary.errors.length) {
    console.log(C.red(`  ✖ ${summary.errors.length} خطأ`))
    if (isVerbose || summary.errors.length <= 10) {
      summary.errors.forEach(e => console.log('    - ' + e))
    } else {
      summary.errors.slice(0, 10).forEach(e => console.log('    - ' + e))
      console.log(C.dim(`    … (${summary.errors.length - 10} إضافية، استخدم --verbose)`))
    }
  }
  if (summary.warnings.length) {
    console.log(C.yellow(`  ⚠ ${summary.warnings.length} تحذير`))
    if (isVerbose || summary.warnings.length <= 5) {
      summary.warnings.forEach(w => console.log('    - ' + w))
    } else {
      summary.warnings.slice(0, 5).forEach(w => console.log('    - ' + w))
      console.log(C.dim(`    … (${summary.warnings.length - 5} إضافية، استخدم --verbose)`))
    }
  }
  console.log(`  ${C.green('مقبول: ' + summary.accepted)} · ${C.red('مرفوض: ' + summary.rejected)}`)
}
