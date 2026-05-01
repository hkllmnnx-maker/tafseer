#!/usr/bin/env node
// =============================================================================
// validate-import.mjs — مدقّق ملفات استيراد تفاسير قبل الإدخال إلى قاعدة D1
//
// الاستعمال:
//   node scripts/importers/validate-import.mjs <file.json> [--dry-run] [--verbose]
//   node scripts/importers/validate-import.mjs fixtures/import-samples/*.json
//
// المخرجات:
//   - تقرير ملوّن في الطرفية + رمز خروج 0 (نجاح) / 1 (فشل) / 2 (تحذيرات).
//   - كل صف يجب أن يحتوي: id, bookId, surah, ayah, text, sourceType, verificationStatus.
// =============================================================================

import { readFileSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import process from 'node:process'

const ALLOWED_SOURCE_TYPES = new Set([
  'original-text', 'summary', 'sample', 'review-needed', 'curated',
])
const ALLOWED_VERIFICATION = new Set([
  'verified', 'partially-verified', 'unverified', 'flagged',
])
// أحجام السور (لتأكيد رقم الآية)؛ نحمّلها من src/data/surahs.ts عبر import ديناميكي مبسّط
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
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
}

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const files = args.filter(a => !a.startsWith('--'))
const isDryRun = flags.has('--dry-run')
const isVerbose = flags.has('--verbose')

if (!files.length) {
  console.error(C.red('✖ لم تُحدَّد ملفات للتحقّق.'))
  console.error('الاستعمال: node scripts/importers/validate-import.mjs <file.json> [--dry-run] [--verbose]')
  process.exit(1)
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
  console.log(`${status}  ${C.bold(basename(s.file))}  —  مقبول ${s.accepted} | مرفوض ${s.rejected} | تحذيرات ${s.warnings.length}`)
}
console.log(C.dim('───────────────────────────────────────────────────────────'))
console.log(`الإجمالي: مقبول ${C.green(String(totalAccepted))} · مرفوض ${C.red(String(totalRejected))} · تحذيرات ${C.yellow(String(totalWarnings))} · أخطاء ${C.red(String(totalErrors))}`)
if (isDryRun) console.log(C.blue('وضع dry-run: لم تُعدَّل أي قاعدة بيانات.'))
console.log(C.bold('═══════════════════════════════════════════════════════════'))

if (totalErrors > 0) process.exit(1)
if (totalWarnings > 0) process.exit(2)
process.exit(0)

// ============= منطق التحقق =============

function validateFile(file) {
  const summary = {
    file, errors: [], warnings: [], accepted: 0, rejected: 0,
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

  const seenIds = new Set()
  data.forEach((row, idx) => {
    const ctx = `[#${idx + 1}]`
    const errs = validateRow(row, idx, seenIds)
    if (errs.length) {
      summary.rejected++
      errs.forEach(e => summary.errors.push(`${ctx} ${e}`))
    } else {
      summary.accepted++
      // تحذيرات اختيارية
      if (!row.sourceUrl && row.sourceType === 'original-text') {
        summary.warnings.push(`${ctx} نص أصلي بدون sourceUrl — يُستحسن إضافة رابط للمصدر.`)
      }
      if (row.text && row.text.length < 30) {
        summary.warnings.push(`${ctx} نص قصير جدًا (${row.text.length} حرف).`)
      }
    }
  })

  print(summary)
  return summary
}

function validateRow(row, idx, seenIds) {
  const errs = []
  if (!row || typeof row !== 'object') {
    errs.push('الإدخال ليس كائنًا.')
    return errs
  }
  if (!row.id || typeof row.id !== 'string') {
    errs.push('الحقل id إلزامي وسلسلة نصّية.')
  } else if (seenIds.has(row.id)) {
    errs.push(`id مكرّر داخل نفس الملف: ${row.id}`)
  } else {
    seenIds.add(row.id)
  }
  if (!row.bookId || typeof row.bookId !== 'string') errs.push('bookId إلزامي.')
  if (!Number.isInteger(row.surah) || row.surah < 1 || row.surah > 114) {
    errs.push(`surah غير صالح (1..114): ${row.surah}`)
  }
  if (!Number.isInteger(row.ayah) || row.ayah < 1) {
    errs.push(`ayah غير صالح: ${row.ayah}`)
  }
  if (Number.isInteger(row.surah) && Number.isInteger(row.ayah)) {
    const max = SURAH_AYAH_COUNTS[row.surah]
    if (max && row.ayah > max) {
      errs.push(`ayah=${row.ayah} يتجاوز عدد آيات السورة ${row.surah} (=${max}).`)
    }
  }
  if (!row.text || typeof row.text !== 'string' || row.text.trim().length < 5) {
    errs.push('text إلزامي ولا يقل عن 5 أحرف.')
  }
  if (!row.sourceType || !ALLOWED_SOURCE_TYPES.has(row.sourceType)) {
    errs.push(`sourceType إلزامي من القائمة: ${[...ALLOWED_SOURCE_TYPES].join(' | ')}`)
  }
  if (!row.verificationStatus || !ALLOWED_VERIFICATION.has(row.verificationStatus)) {
    errs.push(`verificationStatus إلزامي من القائمة: ${[...ALLOWED_VERIFICATION].join(' | ')}`)
  }
  // حقول اختيارية لكنها يجب أن تكون من النوع الصحيح إن وُجدت
  if (row.volume != null && !Number.isInteger(row.volume)) errs.push('volume يجب أن يكون عددًا صحيحًا.')
  if (row.page != null && !Number.isInteger(row.page)) errs.push('page يجب أن يكون عددًا صحيحًا.')
  if (row.sourceUrl != null && typeof row.sourceUrl !== 'string') errs.push('sourceUrl يجب أن يكون نصًا.')
  if (row.isOriginalText != null && typeof row.isOriginalText !== 'boolean') {
    errs.push('isOriginalText يجب أن يكون boolean.')
  }
  return errs
}

function print(summary) {
  const head = C.bold(basename(summary.file))
  console.log()
  console.log(`▸ ${head}`)
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
    if (isVerbose) summary.warnings.forEach(w => console.log('    - ' + w))
  }
  console.log(`  ${C.green('مقبول: ' + summary.accepted)} · ${C.red('مرفوض: ' + summary.rejected)}`)
}
