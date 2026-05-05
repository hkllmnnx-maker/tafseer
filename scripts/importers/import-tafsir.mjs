#!/usr/bin/env node
// =============================================================================
// import-tafsir.mjs — مستورد كتاب تفسير من JSON إلى SQL لاستيراده إلى D1
// =============================================================================
// يأخذ ملف JSON يصف كتاب تفسير واحدًا (book + author + entries[]) ويولّد ملف
// SQL جاهزًا لتنفيذه على Cloudflare D1 عبر:
//   wrangler d1 execute tafseer-production --local --file=dist/import/tafsir-import.sql
//
// لا يتصل بـ D1 مباشرة. لا يأخذ أسرارًا. يولّد INSERT OR REPLACE فقط
// (لا UPDATE/DELETE) لتأمين أن إعادة التشغيل آمنة (idempotent).
//
// الاستعمال:
//   node scripts/importers/import-tafsir.mjs <file.json> [options]
//
// الأعلام:
//   --strict              يفرض وجود sourceUrl لكل entry و edition للكتاب،
//                         ولا يسمح بـ verificationStatus === 'unverified'.
//   --output <dir>        مسار مخصّص للإخراج (افتراضي: dist/import).
//   --filename <name>     اسم ملف SQL الناتج (افتراضي: tafsir-import.sql).
//   --json                يطبع تقرير JSON على stdout بدل الواجهة الملوّنة.
//   --no-validate         يتجاوز التحقق (لا يُنصح به).
//
// أمثلة:
//   node scripts/importers/import-tafsir.mjs .imports/ibn-kathir.json --strict
//   node scripts/importers/import-tafsir.mjs fixtures/import-samples/tafsir-valid-sample.json
//
// المخرجات في dist/import/:
//   - tafsir-import.sql                 (SQL: INSERT OR REPLACE)
//   - tafsir-import-report.json         (تقرير العملية)
//
// خصائص الأمان:
//   - SQL escaping يدوي صارم (تكرار '، إزالة \r، حذف الأحرف غير المرئية).
//   - يمنع كتابة literal "undefined" / "NaN" / "null" كقيم نصية.
//   - يستخدم INSERT OR REPLACE INTO على authors / tafsir_books / tafsir_entries.
//   - يحافظ على ترتيب (surah, ayah) تصاعديًا لاستقرار الـ diff.
//   - SHA-256 للملف الأصلي يُحفظ في التقرير (لا الملف نفسه).
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

// -----------------------------------------------------------------------------
// Args
// -----------------------------------------------------------------------------
const argv = process.argv.slice(2)
const flags = {
  strict:     argv.includes('--strict'),
  json:       argv.includes('--json'),
  noValidate: argv.includes('--no-validate'),
}
function readOption(name, def = null) {
  const idx = argv.indexOf(name)
  if (idx === -1 || idx + 1 >= argv.length) return def
  return argv[idx + 1]
}
const fileArg = argv.find((a, i) =>
  !a.startsWith('--') && (i === 0 || !argv[i - 1].match(/^--(output|filename)$/))
)
const customOutDir = readOption('--output')
const customFile   = readOption('--filename')

if (!fileArg) {
  console.error(c.red('Usage: import-tafsir.mjs <file.json> [--strict] [--json]'))
  console.error(c.dim('  أمثلة:'))
  console.error(c.dim('    node scripts/importers/import-tafsir.mjs .imports/ibn-kathir.json --strict'))
  console.error(c.dim('    node scripts/importers/import-tafsir.mjs fixtures/import-samples/tafsir-valid-sample.json'))
  process.exit(2)
}

const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(ROOT, fileArg)
if (!fs.existsSync(filePath)) {
  console.error(c.red(`✗ الملف غير موجود: ${filePath}`))
  process.exit(2)
}

// -----------------------------------------------------------------------------
// Step 1: validate via validate-tafsir-json.mjs
// -----------------------------------------------------------------------------
const validatorPath = path.join(__dirname, 'validate-tafsir-json.mjs')

function runValidator() {
  if (flags.noValidate) {
    return { ok: true, skipped: true, report: null, stderr: '' }
  }
  const args = [validatorPath, filePath, '--json']
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
  console.log(c.bold(c.blue('▶ import-tafsir: تحقق من ملف JSON...')))
  console.log(`  الملف:  ${path.relative(ROOT, filePath)}`)
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
        console.error('  - ' + (typeof e === 'string' ? e : JSON.stringify(e)))
      }
      if (validation.report.errors.length > 10) {
        console.error(c.dim(`  ...و${validation.report.errors.length - 10} أخرى`))
      }
    }
  }
  process.exit(1)
}

if (!flags.json && !validation.skipped) {
  const r = validation.report || {}
  const total = r.totalEntries ?? r.entriesCount ?? r.totalAyahs ?? 0
  console.log(c.green(`✓ التحقق نجح: ${total} مدخلة تفسير.`))
  console.log('')
}

// -----------------------------------------------------------------------------
// Step 2: load JSON + SHA-256
// -----------------------------------------------------------------------------
const fileBuf = fs.readFileSync(filePath)
const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex')
let payload
try {
  payload = JSON.parse(fileBuf.toString('utf8'))
} catch (e) {
  console.error(c.red(`✗ JSON غير صالح: ${e.message}`))
  process.exit(1)
}

const book    = payload?.book    || null
const author  = payload?.author  || null
const meta    = payload?.meta    || {}
const entries = Array.isArray(payload?.entries) ? payload.entries : []

if (!book || !book.id) {
  console.error(c.red('✗ payload.book.id مفقود.'))
  process.exit(1)
}
if (!author || !author.id) {
  console.error(c.red('✗ payload.author.id مفقود.'))
  process.exit(1)
}
if (entries.length === 0) {
  console.error(c.red('✗ payload.entries فارغ.'))
  process.exit(1)
}

// -----------------------------------------------------------------------------
// Step 3: SQL escape helpers
// -----------------------------------------------------------------------------
function sqlString(v) {
  if (v === undefined || v === null) return 'NULL'
  let s = String(v)
  s = s.replace(/\r/g, '').replace(/\u0000/g, '')
  s = s.replace(/'/g, "''")
  return `'${s}'`
}
function sqlNum(v) {
  if (v === undefined || v === null || v === '') return 'NULL'
  const n = Number(v)
  if (!Number.isFinite(n)) return 'NULL'
  if (!Number.isInteger(n)) return 'NULL'
  return String(n)
}
function sqlBool(v) {
  return v ? '1' : '0'
}
function sqlJsonArray(arr) {
  if (!Array.isArray(arr)) return 'NULL'
  // نخزّن JSON كنص (TEXT) داخل العمود — متوافق مع كل صفوف schools.
  return sqlString(JSON.stringify(arr))
}

// تحويل popularity من نطاق 0..100 (شائع في عيّنات الكتب) إلى 1..10 (CHECK في schema)
function normalizePopularity(p) {
  if (p === undefined || p === null) return 5
  const n = Number(p)
  if (!Number.isFinite(n)) return 5
  if (n >= 1 && n <= 10) return Math.round(n)
  if (n > 10 && n <= 100) return Math.max(1, Math.min(10, Math.round(n / 10)))
  return 5
}

// =============== century من deathYear (هجري) ===============
function centuryFromDeathYear(year) {
  if (!Number.isFinite(Number(year))) return 1
  const n = Number(year)
  return Math.max(1, Math.min(15, Math.ceil(n / 100)))
}

// -----------------------------------------------------------------------------
// Step 4: Build SQL
// -----------------------------------------------------------------------------
const importedAt = new Date().toISOString()
const importedFrom = `import-tafsir.mjs@${path.basename(filePath)}`

const lines = []
lines.push('-- =========================================================================')
lines.push('-- tafsir-import.sql — تم توليده تلقائيًا عبر scripts/importers/import-tafsir.mjs')
lines.push('-- لا تُحرّر هذا الملف يدويًا — أعِد توليده عبر `npm run import:tafsir <file.json>`')
lines.push(`-- التاريخ:        ${importedAt}`)
lines.push(`-- مصدر JSON:      ${path.basename(filePath)}`)
lines.push(`-- SHA-256:        ${sha256}`)
lines.push(`-- معرّف الكتاب:    ${book.id}`)
lines.push(`-- معرّف المؤلف:   ${author.id}`)
lines.push(`-- عدد الإدخالات:  ${entries.length}`)
lines.push(`-- strict:         ${flags.strict ? 'yes' : 'no'}`)
lines.push('-- =========================================================================')
lines.push('')
lines.push('PRAGMA foreign_keys = ON;')
lines.push('BEGIN TRANSACTION;')
lines.push('')

// ----- (a) author -----
lines.push('-- ===== authors =====')
{
  const a = author
  const deathYear = Number.isFinite(Number(a.deathYear)) ? Number(a.deathYear) : null
  const birthYear = Number.isFinite(Number(a.birthYear)) ? Number(a.birthYear) : null
  const century   = a.century ?? centuryFromDeathYear(deathYear)
  // ملاحظة: deathYear قد يكون null إذا كان "المؤلِّف" مؤسسة (مثل مجمع الملك فهد)
  // وليس شخصًا. في هذه الحالة نستخدم a.isInstitution أو غياب deathYear كإشارة
  // مقبولة، ولا نُفشل الاستيراد. عمود death_year يقبل NULL في schema.
  const isInstitution = a.isInstitution === true || a.type === 'institution'
  if (deathYear === null && !isInstitution) {
    console.error(c.red('✗ author.deathYear مطلوب وغير صحيح (للأشخاص). إن كان "المؤلِّف" مؤسسة، أضف "isInstitution": true.'))
    process.exit(1)
  }
  lines.push(
    `INSERT OR REPLACE INTO authors ` +
    `(id, name, full_name, birth_year, death_year, century, biography, schools, popularity) VALUES ` +
    `(${sqlString(a.id)}, ${sqlString(a.name || a.id)}, ${sqlString(a.fullName || a.full_name || null)}, ` +
    `${sqlNum(birthYear)}, ${sqlNum(deathYear)}, ${sqlNum(century)}, ` +
    `${sqlString(a.biography || null)}, ${sqlJsonArray(a.schools || [])}, ` +
    `${sqlNum(normalizePopularity(a.popularity))});`
  )
}
lines.push('')

// ----- (b) book -----
lines.push('-- ===== tafsir_books =====')
{
  const b = book
  if (flags.strict && !b.edition) {
    console.error(c.red('✗ --strict: book.edition مطلوب.'))
    process.exit(1)
  }
  lines.push(
    `INSERT OR REPLACE INTO tafsir_books ` +
    `(id, title, full_title, author_id, schools, volumes, description, published_year, edition, popularity, featured) VALUES ` +
    `(${sqlString(b.id)}, ${sqlString(b.title || b.shortTitle || b.id)}, ` +
    `${sqlString(b.fullTitle || b.full_title || null)}, ${sqlString(author.id)}, ` +
    `${sqlJsonArray(b.schools || [])}, ${sqlNum(b.volumes ?? null)}, ` +
    `${sqlString(b.description || null)}, ${sqlNum(b.publishedYear ?? b.published_year ?? null)}, ` +
    `${sqlString(b.edition || null)}, ${sqlNum(normalizePopularity(b.popularity))}, ` +
    `${sqlBool(b.featured)});`
  )
}
lines.push('')

// ----- (c) entries -----
lines.push('-- ===== tafsir_entries =====')

// تأكيد ترتيب (surah, ayah)
entries.sort((x, y) => {
  if (x.surah !== y.surah) return Number(x.surah) - Number(y.surah)
  return Number(x.ayah) - Number(y.ayah)
})

const seenIds = new Set()
const seenKey = new Set()
let duplicateIdSkipped = 0
let duplicateKeySkipped = 0
let written = 0

const ALLOWED_SOURCE_TYPES = new Set([
  'original-text', 'summary', 'sample', 'curated', 'review-needed',
])
const ALLOWED_VERIFICATION = new Set([
  'verified', 'partially-verified', 'unverified', 'flagged',
])

for (const e of entries) {
  if (!e || typeof e !== 'object') continue
  if (!e.id || seenIds.has(e.id)) { duplicateIdSkipped++; continue }
  const surah = Number(e.surah)
  const ayah  = Number(e.ayah)
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) continue
  if (!Number.isInteger(ayah)  || ayah  < 1 || ayah  > 286) continue

  const text = e.text
  if (typeof text !== 'string' || text.trim().length < 5) continue
  if (/\bundefined\b|\bNaN\b/.test(text)) continue

  const sourceType = ALLOWED_SOURCE_TYPES.has(e.sourceType) ? e.sourceType : 'sample'
  let verification = ALLOWED_VERIFICATION.has(e.verificationStatus) ? e.verificationStatus : 'unverified'
  if (flags.strict && verification === 'unverified') {
    console.error(c.red(`✗ --strict: ${e.id} verificationStatus = unverified غير مسموح.`))
    process.exit(1)
  }
  if (flags.strict && (!e.sourceUrl || !/^https:\/\//.test(e.sourceUrl))) {
    console.error(c.red(`✗ --strict: ${e.id} sourceUrl إلزامي ويبدأ بـ https://`))
    process.exit(1)
  }

  // unique tuple per schema: (book_id, surah, ayah, source_name)
  const sourceName = e.sourceName || null
  const key = `${book.id}::${surah}:${ayah}::${sourceName || ''}`
  if (seenKey.has(key)) { duplicateKeySkipped++; continue }
  seenKey.add(key)
  seenIds.add(e.id)

  lines.push(
    `INSERT OR REPLACE INTO tafsir_entries ` +
    `(id, book_id, author_id, surah_number, ayah_number, text, ` +
    `source_type, verification_status, is_original_text, ` +
    `source_name, edition, volume, page, source_url, reviewer_note, ` +
    `is_sample, imported_from, imported_at) VALUES ` +
    `(${sqlString(e.id)}, ${sqlString(book.id)}, ${sqlString(author.id)}, ` +
    `${sqlNum(surah)}, ${sqlNum(ayah)}, ${sqlString(text)}, ` +
    `${sqlString(sourceType)}, ${sqlString(verification)}, ` +
    `${sqlBool(e.isOriginalText)}, ${sqlString(sourceName)}, ` +
    `${sqlString(e.edition || book.edition || null)}, ${sqlNum(e.volume ?? null)}, ` +
    `${sqlNum(e.page ?? null)}, ${sqlString(e.sourceUrl || null)}, ` +
    `${sqlString(e.reviewerNote || null)}, ${sqlBool(e.isSample)}, ` +
    `${sqlString(importedFrom)}, ${sqlString(importedAt)});`
  )
  written++
}

lines.push('')
lines.push('COMMIT;')
lines.push('')

const sql = lines.join('\n')

// -----------------------------------------------------------------------------
// Step 5: safety scan
// -----------------------------------------------------------------------------
const danger = sql.match(/\b(undefined|NaN)\b/g)
if (danger && danger.length > 0) {
  console.error(c.red(`✗ تم اكتشاف قيم خطرة في SQL: ${danger.length} مرة (undefined/NaN)`))
  process.exit(1)
}
const nullAsString = sql.match(/'\s*null\s*'/gi)
if (nullAsString && nullAsString.length > 0) {
  console.error(c.red(`✗ تم اكتشاف "null" نصية: ${nullAsString.length} مرة`))
  process.exit(1)
}

// -----------------------------------------------------------------------------
// Step 6: write outputs
// -----------------------------------------------------------------------------
const outDir = customOutDir
  ? (path.isAbsolute(customOutDir) ? customOutDir : path.resolve(ROOT, customOutDir))
  : path.join(ROOT, 'dist/import')

fs.mkdirSync(outDir, { recursive: true })
const sqlOut = path.join(outDir, customFile || 'tafsir-import.sql')
fs.writeFileSync(sqlOut, sql, 'utf8')

const reportOut = path.join(outDir, 'tafsir-import-report.json')
const surahsCovered = new Set(entries.map(e => Number(e.surah))).size
const report = {
  ok: true,
  generatedAt: importedAt,
  source: {
    file: path.relative(ROOT, filePath),
    sha256,
    sizeBytes: fileBuf.byteLength,
    bookId:   book.id,
    bookTitle: book.title || null,
    authorId: author.id,
    authorName: author.name || null,
    license:  book.license || null,
    edition:  book.edition || null,
    schemaVersion: meta?.schemaVersion || null,
  },
  options: {
    strict: flags.strict,
  },
  validator: {
    skipped: validation.skipped,
    totalEntries: validation.report?.totalEntries ?? validation.report?.entriesCount ?? null,
    warningsCount: validation.report?.warningsCount ?? 0,
  },
  output: {
    sqlFile: path.relative(ROOT, sqlOut),
    sqlSizeBytes: Buffer.byteLength(sql, 'utf8'),
    entriesWritten: written,
    duplicateIdsSkipped: duplicateIdSkipped,
    duplicateKeysSkipped: duplicateKeySkipped,
    surahsCovered,
  },
  notes: [
    'يتطلّب أن تكون السور (surahs) موجودة قبل تنفيذ هذا الـ SQL — طبّق ترحيلاً يحتوي بذور السور أوّلًا.',
    'لا تُضِف ملفات التفسير الخام إلى Git. ضعها في .imports/ أو خارج المستودع.',
  ],
}
fs.writeFileSync(reportOut, JSON.stringify(report, null, 2), 'utf8')

// -----------------------------------------------------------------------------
// Step 7: output
// -----------------------------------------------------------------------------
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
console.log(c.dim(`  مدخلات مكتوبة:        ${written}`))
console.log(c.dim(`  مكرّرات IDs متجاهَلة: ${duplicateIdSkipped}`))
console.log(c.dim(`  مكرّرات مفتاح:         ${duplicateKeySkipped}`))
console.log(c.dim(`  سور مغطّاة:            ${surahsCovered}`))
console.log(c.dim(`  SHA-256:                ${sha256.slice(0, 16)}…`))
console.log('')
console.log(c.dim('للاستيراد إلى D1 محليًا:'))
console.log(c.dim(`  npm run db:migrate:local`))
console.log(c.dim(`  npx wrangler d1 execute tafseer-production --local --file=${path.relative(ROOT, sqlOut)}`))
console.log('')
process.exit(0)
