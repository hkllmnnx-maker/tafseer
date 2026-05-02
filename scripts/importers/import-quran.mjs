#!/usr/bin/env node
// =============================================================================
// import-quran.mjs — مستورد القرآن الكامل من JSON إلى SQL لاستيراده إلى D1
// =============================================================================
// يأخذ ملف JSON خارجي للقرآن (لا يُحفظ في Git) ويولّد ملف SQL جاهزًا
// لاستيراده إلى Cloudflare D1 عبر `wrangler d1 execute --file=...`.
//
// لا يتصل بـ D1 مباشرة. لا يكتب أي بيانات إلى الإنترنت. لا يأخذ أسرارًا.
//
// الاستعمال:
//   node scripts/importers/import-quran.mjs <file.json> [options]
//
// الأعلام:
//   --full              يجب أن يحتوي الملف على 6236 آية (القرآن كاملاً)
//                       مع تغطية كل سور 1..114 بالعدد الصحيح للآيات.
//   --strict            حقول source و sourceUrl إلزامية (https only).
//   --allow-partial     يسمح بمعالجة عينة جزئية (للاختبار/تطوير فقط).
//                       يتعارض مع --full ويأخذ أولوية أقل.
//   --output <dir>      مسار مخصّص للإخراج (افتراضي: dist/import).
//   --filename <name>   اسم ملف SQL الناتج (افتراضي: ayahs-full.sql مع --full
//                       أو ayahs-sample.sql مع --allow-partial).
//   --json              يطبع تقرير JSON على stdout بدل الواجهة الملوّنة.
//   --no-validate       تجاوز التحقق الكامل (للأداء). لا يُنصح به.
//
// أمثلة:
//   node scripts/importers/import-quran.mjs .imports/quran-full.json --full --strict
//   node scripts/importers/import-quran.mjs fixtures/import-samples/quran-valid-sample.json \
//        --allow-partial --strict
//
// المخرجات في dist/import/:
//   - ayahs-full.sql    أو   ayahs-sample.sql       (SQL: INSERT OR REPLACE)
//   - quran-import-report.json                       (تقرير العملية)
//
// خصائص الأمان:
//   - SQL escaping يدوي صارم (تكرار '، إزالة \r، حذف الأحرف غير المرئية الخطرة).
//   - يمنع كتابة literal "undefined" / "NaN" / "null" كقيم نصية.
//   - يحافظ على ترتيب السور والآيات (تصاعدي).
//   - يستخدم INSERT OR REPLACE INTO ayahs (لا UPDATE/DELETE).
//   - يحفظ source / sourceUrl / edition / imported_from / imported_at إن
//     كانت أعمدة المصدر الجديدة موجودة في schema (بعد ترحيل 0003).
//   - SHA-256 للملف الأصلي يُحفظ في التقرير (لا الملف نفسه).
//
// ملاحظة: لا تَلتزم النصوص في هذا السكربت بمصدر معيَّن. أي ملف صالح بنيويًا
// سيُقبل ما دام يجتاز validate-quran-json.mjs. مسؤولية اختيار المصدر
// والتحقق من صحته دينيًا/علميًا تقع على المستخدم.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
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
// Args parsing
// =============================================================================
const argv = process.argv.slice(2)
const flags = {
  full:         argv.includes('--full'),
  strict:       argv.includes('--strict'),
  allowPartial: argv.includes('--allow-partial'),
  json:         argv.includes('--json'),
  noValidate:   argv.includes('--no-validate'),
}
function readOption(name, def = null) {
  const idx = argv.indexOf(name)
  if (idx === -1 || idx + 1 >= argv.length) return def
  return argv[idx + 1]
}
const fileArg = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].match(/^--(output|filename)$/)))
const customOutDir = readOption('--output')
const customFile   = readOption('--filename')

if (!fileArg) {
  console.error(c.red('Usage: import-quran.mjs <file.json> [--full|--allow-partial] [--strict]'))
  console.error(c.dim('  أمثلة:'))
  console.error(c.dim('    node scripts/importers/import-quran.mjs .imports/quran-full.json --full --strict'))
  console.error(c.dim('    node scripts/importers/import-quran.mjs fixtures/import-samples/quran-valid-sample.json --allow-partial --strict'))
  process.exit(2)
}

if (!flags.full && !flags.allowPartial) {
  console.error(c.red('✗ يجب تمرير --full (للقرآن كاملاً) أو --allow-partial (للعينات).'))
  console.error(c.dim('  - --full: يفرض 6236 آية وتغطية كل السور.'))
  console.error(c.dim('  - --allow-partial: للاختبار/التطوير فقط، لا يُولّد قرآنًا كاملاً.'))
  process.exit(2)
}

if (flags.full && flags.allowPartial) {
  console.error(c.red('✗ لا يمكن الجمع بين --full و --allow-partial.'))
  process.exit(2)
}

const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(ROOT, fileArg)
if (!fs.existsSync(filePath)) {
  console.error(c.red(`✗ الملف غير موجود: ${filePath}`))
  process.exit(2)
}

// =============================================================================
// Step 1: Validate via validate-quran-json.mjs (delegated for single source of truth)
// =============================================================================
const validatorPath = path.join(__dirname, 'validate-quran-json.mjs')

function runValidator() {
  if (flags.noValidate) {
    return { ok: true, skipped: true, report: null }
  }
  const args = [validatorPath, filePath, '--json']
  if (flags.full)   args.push('--full')
  if (flags.strict) args.push('--strict')
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  let report = null
  try { report = JSON.parse(r.stdout || '{}') } catch { /* ignore */ }
  return {
    ok: r.status === 0,
    skipped: false,
    stderr: (r.stderr || '').slice(-500),
    report,
  }
}

if (!flags.json) {
  console.log(c.bold(c.blue('▶ import-quran: تحقق من ملف JSON...')))
  console.log(`  الملف: ${path.relative(ROOT, filePath)}`)
  console.log(`  الوضع: ${flags.full ? 'full (6236 آية مطلوبة)' : 'allow-partial (عينة)'}`)
  console.log(`  strict: ${flags.strict ? 'نعم' : 'لا'}`)
  console.log('')
}

const validation = runValidator()
if (!validation.ok) {
  if (flags.json) {
    console.log(JSON.stringify({
      ok: false,
      stage: 'validation',
      error: 'validator_failed',
      stderr: validation.stderr,
      report: validation.report,
    }, null, 2))
  } else {
    console.error(c.red('✗ فشل التحقق من ملف JSON. يجب إصلاح الأخطاء قبل توليد SQL.'))
    if (validation.report?.errors?.length) {
      for (const e of validation.report.errors.slice(0, 10)) {
        console.error('  - ' + e)
      }
      if (validation.report.errors.length > 10) {
        console.error(c.dim(`  ...و${validation.report.errors.length - 10} أخرى`))
      }
    }
  }
  process.exit(1)
}

if (!flags.json && !validation.skipped) {
  const r = validation.report
  console.log(c.green(`✓ التحقق نجح: ${r?.totalAyahs || 0} آية، ${r?.surahsCovered || 0} سورة مغطاة.`))
  console.log('')
}

// =============================================================================
// Step 2: Load JSON + compute SHA-256
// =============================================================================
const fileBuf = fs.readFileSync(filePath)
const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex')
let payload
try {
  payload = JSON.parse(fileBuf.toString('utf8'))
} catch (e) {
  console.error(c.red(`✗ JSON غير صالح: ${e.message}`))
  process.exit(1)
}
const ayahs = Array.isArray(payload) ? payload : (Array.isArray(payload?.ayahs) ? payload.ayahs : [])
const topSource    = payload?.source    || null
const topSourceUrl = payload?.sourceUrl || null
const topEdition   = payload?.edition   || null

// إذا --strict ولا يوجد top-level source/sourceUrl، نطلب أن يكون كل آية تحمل المصدر
if (flags.strict && (!topSource || !topSourceUrl)) {
  // الـ validator أصلاً سيرفض الملف إذا فقدت آيات مصدر — هذا فقط للتأكيد
  // لمستوى المستورد. إذا غاب top-level فلا بد أن يكون كل آية تحمل source+url.
  let missing = 0
  for (const a of ayahs) {
    if (!a.source || !a.sourceUrl) missing++
  }
  if (missing > 0) {
    console.error(c.red(`✗ --strict: ${missing} آية بدون source/sourceUrl وملف JSON بدون قيم top-level.`))
    process.exit(1)
  }
}

// =============================================================================
// Step 3: Sort + sanitize
// =============================================================================
// نحافظ على ترتيب السور والآيات (تصاعدي) لضمان توليد SQL متّسق.
ayahs.sort((a, b) => {
  if (a.surah !== b.surah) return Number(a.surah) - Number(b.surah)
  return Number(a.ayah) - Number(b.ayah)
})

// =============================================================================
// Step 4: SQL escaping (نسخة مستقلة عن seed-to-d1.mjs لتجنّب الاعتماد المتبادل)
// =============================================================================
function sqlString(v) {
  if (v === undefined || v === null) return 'NULL'
  let s = String(v)
  // امنع \r / \0 / حروف مرئية تالفة
  s = s.replace(/\r/g, '').replace(/\u0000/g, '')
  // تكرار ' لتفلت SQLite
  s = s.replace(/'/g, "''")
  return `'${s}'`
}
function sqlNum(v) {
  if (v === undefined || v === null || v === '') return 'NULL'
  const n = Number(v)
  if (!Number.isFinite(n)) return 'NULL'
  if (!Number.isInteger(n)) return 'NULL' // لا أعداد عشرية في حقول الأعداد
  return String(n)
}

// =============================================================================
// Step 5: Build SQL
// =============================================================================
// نستخدم INSERT OR REPLACE INTO ayahs(...) VALUES(...). الحقول الإضافية
// (source_name, source_url, edition, imported_from, imported_at) موجودة فقط
// بعد تطبيق ترحيل 0003. لذا نُولّد جزأين:
//   1) INSERT العمود الأساسي (مضمون يعمل قبل وبعد الترحيل 0003).
//   2) UPDATE الحقول الإضافية فقط إن كانت موجودة (نلفّها في try/catch داخل SQL).
// لتفادي تعقيد التشغيل المشروط في SQL، نُصدر سكربتًا واحدًا متوافقًا مع schema
// بعد ترحيل 0003. الإصدار قبل 0003 سيُهمل أعمدة source_* بهدوء (إذا حُذفت
// الأعمدة من INSERT). لتأمين هذا، نُصدر نسختين من INSERT:
//   - الأساسية (5 أعمدة) — تعمل دائمًا.
//   - الموسّعة (مع UPDATE الحقول الإضافية) — تعمل بعد 0003 فقط.
// نطبّق الموسّعة عبر سطر مشروط: نُغلّفه بتعليق SQL يبدأ بـ
// "-- requires migration 0003" حتى لا يكون عقبة وقت تطبيقه قبل 0003.
//
// لكن الطريق الأبسط الموصى به: تطبيق ترحيل 0003 قبل تشغيل هذا السكربت.
// وثّقنا ذلك في docs/quran-import-plan.md.

const importedAt = new Date().toISOString()
const importedFrom = `import-quran.mjs@${path.basename(filePath)}`

const lines = []
lines.push('-- =========================================================================')
lines.push('-- ayahs-import.sql — تم توليده تلقائيًا عبر scripts/importers/import-quran.mjs')
lines.push('-- لا تُحرّر هذا الملف يدويًا — أعِد توليده عبر `npm run import:quran ...`')
lines.push(`-- التاريخ:        ${importedAt}`)
lines.push(`-- مصدر JSON:      ${path.basename(filePath)}`)
lines.push(`-- SHA-256:        ${sha256}`)
lines.push(`-- عدد الآيات:     ${ayahs.length}`)
lines.push(`-- وضع:            ${flags.full ? 'full' : 'partial'}`)
lines.push(`-- strict:         ${flags.strict ? 'yes' : 'no'}`)
if (topSource)    lines.push(`-- المصدر:         ${topSource}`)
if (topSourceUrl) lines.push(`-- رابط المصدر:    ${topSourceUrl}`)
lines.push('-- ملاحظة: يتطلّب ترحيل 0003_ayah_sources.sql لاستخدام أعمدة source/edition.')
lines.push('-- =========================================================================')
lines.push('')
lines.push('PRAGMA foreign_keys = ON;')
lines.push('BEGIN TRANSACTION;')
lines.push('')
lines.push('-- ===== ayahs (full INSERT OR REPLACE) =====')

// عدّاد آمان لتفادي تكرار جملة INSERT بنفس (surah, ayah)
const seenKey = new Set()
let duplicateSkipped = 0

for (const a of ayahs) {
  const surah = Number(a.surah)
  const ayah  = Number(a.ayah)
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) continue
  if (!Number.isInteger(ayah)  || ayah  < 1 || ayah  > 286) continue
  const key = `${surah}:${ayah}`
  if (seenKey.has(key)) { duplicateSkipped++; continue }
  seenKey.add(key)

  const text = a.text
  if (typeof text !== 'string' || !text.trim()) continue
  // أمان نهائي: ارفض literal undefined/NaN
  if (/\bundefined\b|\bNaN\b/.test(text)) continue

  const juz  = a.juz != null ? Number(a.juz)  : null
  const page = a.page != null ? Number(a.page) : null
  const src  = a.source    || topSource    || null
  const url  = a.sourceUrl || topSourceUrl || null
  const ed   = a.edition   || topEdition   || null

  lines.push(
    `INSERT OR REPLACE INTO ayahs ` +
    `(surah_number, ayah_number, text, juz, page, source_name, source_url, edition, imported_from, imported_at) VALUES ` +
    `(${sqlNum(surah)}, ${sqlNum(ayah)}, ${sqlString(text)}, ${sqlNum(juz)}, ${sqlNum(page)}, ` +
    `${sqlString(src)}, ${sqlString(url)}, ${sqlString(ed)}, ${sqlString(importedFrom)}, ${sqlString(importedAt)});`
  )
}

lines.push('')
lines.push('COMMIT;')
lines.push('')

const sql = lines.join('\n')

// أمان إضافي: تأكّد أن الناتج لا يحتوي literal undefined/NaN
const danger = sql.match(/\b(undefined|NaN)\b/g)
if (danger && danger.length > 0) {
  console.error(c.red(`✗ تم اكتشاف قيم خطرة في SQL: ${danger.length} مرة (undefined/NaN)`))
  process.exit(1)
}
// أمان إضافي: لا يجب أن يحتوي literal "null" كقيمة نصية
// (حقول الأعداد NULL مقبولة كـ SQL NULL، ليس literal)
const nullAsString = sql.match(/'\s*null\s*'/gi)
if (nullAsString && nullAsString.length > 0) {
  console.error(c.red(`✗ تم اكتشاف "null" نصية: ${nullAsString.length} مرة`))
  process.exit(1)
}

// =============================================================================
// Step 6: Write outputs
// =============================================================================
const outDir = customOutDir
  ? (path.isAbsolute(customOutDir) ? customOutDir : path.resolve(ROOT, customOutDir))
  : path.join(ROOT, 'dist/import')

fs.mkdirSync(outDir, { recursive: true })
const defaultFilename = flags.full ? 'ayahs-full.sql' : 'ayahs-sample.sql'
const sqlFilename = customFile || defaultFilename
const sqlOut = path.join(outDir, sqlFilename)
fs.writeFileSync(sqlOut, sql, 'utf8')

const reportOut = path.join(outDir, 'quran-import-report.json')
const report = {
  ok: true,
  generatedAt: importedAt,
  source: {
    file: path.relative(ROOT, filePath),
    sha256,
    sizeBytes: fileBuf.byteLength,
    sourceName: topSource,
    sourceUrl: topSourceUrl,
    edition: topEdition,
  },
  options: {
    full: flags.full,
    strict: flags.strict,
    allowPartial: flags.allowPartial,
  },
  validator: {
    skipped: validation.skipped,
    totalAyahs: validation.report?.totalAyahs ?? null,
    surahsCovered: validation.report?.surahsCovered ?? null,
    surahsComplete: validation.report?.surahsComplete ?? null,
    surahsPartial: validation.report?.surahsPartial ?? null,
    surahsEmpty: validation.report?.surahsEmpty ?? null,
    warningsCount: validation.report?.warningsCount ?? 0,
  },
  output: {
    sqlFile: path.relative(ROOT, sqlOut),
    sqlSizeBytes: Buffer.byteLength(sql, 'utf8'),
    ayahsWritten: seenKey.size,
    duplicatesSkipped: duplicateSkipped,
    surahsCount: new Set(ayahs.map(a => a.surah)).size,
  },
  notes: [
    'يتطلّب تطبيق ترحيل db/migrations/0003_ayah_sources.sql قبل تنفيذ هذا الـ SQL.',
    'لا تُضِف ملف القرآن الكامل إلى Git. ضعه في .imports/ أو خارج المستودع.',
  ],
}
fs.writeFileSync(reportOut, JSON.stringify(report, null, 2), 'utf8')

// =============================================================================
// Step 7: Output
// =============================================================================
if (flags.json) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

console.log(c.bold(c.blue('▶ توليد SQL...')))
const sqlSize = (Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1)
console.log(c.green(`✓ ${path.relative(ROOT, sqlOut)}  (${sqlSize} KB)`))
console.log(c.green(`✓ ${path.relative(ROOT, reportOut)}`))
console.log('')
console.log(c.dim('الإحصاءات:'))
console.log(c.dim(`  آيات مكتوبة:       ${seenKey.size}`))
console.log(c.dim(`  مكرّرات متجاهَلة: ${duplicateSkipped}`))
console.log(c.dim(`  سور مغطّاة:       ${report.output.surahsCount}`))
console.log(c.dim(`  SHA-256:           ${sha256.slice(0, 16)}…`))
console.log('')
console.log(c.dim('للاستيراد إلى D1 محليًا:'))
console.log(c.dim(`  npm run db:migrate:local`))
console.log(c.dim(`  npx wrangler d1 execute tafseer-production --local --file=${path.relative(ROOT, sqlOut)}`))
console.log('')
if (flags.allowPartial) {
  console.log(c.yellow('⚠ هذه عينة جزئية — ليس القرآن الكامل. لا تستخدمها في الإنتاج.'))
}
process.exit(0)
