#!/usr/bin/env node
// =============================================================================
// verify-tafsir-d1.mjs — التحقق من سلامة بيانات تفسير معيَّن في D1 بعد الاستيراد
// =============================================================================
// الهدف:
//   فحص أن قاعدة بيانات D1 (محلية أو بعيدة) تحتوي على كتاب تفسير معيَّن
//   (book id) مع المؤلف، وأن جميع الإدخالات لها sourceType + verificationStatus
//   صالحان، ولا توجد نصوص فارغة، وأن إدخالات original-text لها sourceName +
//   sourceUrl + edition (أو page/volume).
//
// لا يتصل بمصادر خارجية. لا يأخذ أسرارًا. يدعم --dry-run لطباعة الأوامر فقط.
//
// الاستعمال:
//   node scripts/importers/verify-tafsir-d1.mjs --book muyassar --strict
//   node scripts/importers/verify-tafsir-d1.mjs --local --book muyassar --strict --json
//   node scripts/importers/verify-tafsir-d1.mjs --dry-run --book muyassar
//
// الأعلام:
//   --book <id>       (مطلوب) معرّف الكتاب المستهدف.
//   --local           استخدام D1 المحلي (افتراضي).
//   --remote          D1 البعيد.
//   --database <name> اسم قاعدة D1 (يحلّ محل قراءة wrangler.jsonc).
//   --strict          يفشل بـ exit 1 عند أي إخفاق ويفرض:
//                       - وجود الكتاب والمؤلف.
//                       - عدد إدخالات > 0.
//                       - 0 نص فارغ.
//                       - 0 source_type غير صالح.
//                       - 0 verification_status غير صالح.
//                       - كل original-text له sourceName + sourceUrl + edition.
//   --dry-run         طباعة الأوامر فقط دون تنفيذ.
//   --json            إخراج JSON بدلًا من النص الملوَّن.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..', '..')

const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

const args = process.argv.slice(2)
const flagJson    = args.includes('--json')
const flagDry     = args.includes('--dry-run')
const flagRemote  = args.includes('--remote')
const flagStrict  = args.includes('--strict')

function readOpt(name) {
  const i = args.indexOf(name)
  if (i === -1 || i + 1 >= args.length) return null
  const v = args[i + 1]
  return (v && !v.startsWith('--')) ? v : null
}
const cliDatabase = readOpt('--database')
const bookId      = readOpt('--book')

if (!bookId) {
  if (flagJson) {
    console.log(JSON.stringify({ ok: false, error: 'missing --book <id>' }, null, 2))
  } else {
    console.error(c.red('Usage: verify-tafsir-d1.mjs --book <id> [--local|--remote] [--strict] [--json] [--dry-run]'))
  }
  process.exit(2)
}

const ALLOWED_SOURCE_TYPES = ['original-text', 'summary', 'sample', 'curated', 'review-needed']
const ALLOWED_VERIFICATION = ['verified', 'partially-verified', 'unverified', 'flagged']

// =============== قراءة wrangler.jsonc ===============
const WRANGLER  = path.join(ROOT, 'wrangler.jsonc')
let databaseName = cliDatabase || 'tafseer-production'
let bindingActive = false
if (!cliDatabase && fs.existsSync(WRANGLER)) {
  const raw = fs.readFileSync(WRANGLER, 'utf8')
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  try {
    const parsed = JSON.parse(stripped)
    if (Array.isArray(parsed.d1_databases) && parsed.d1_databases[0]) {
      databaseName = parsed.d1_databases[0].database_name || databaseName
      bindingActive = true
    }
  } catch { /* ignore */ }
} else if (cliDatabase) {
  bindingActive = true
}

// =============== استعلامات SQL ===============
function escSql(s) {
  // نعرف أن bookId قادم من CLI، نقصره على [a-zA-Z0-9_-]
  return String(s).replace(/'/g, "''")
}
const safeBook = bookId.replace(/[^a-zA-Z0-9_-]/g, '')
if (safeBook !== bookId) {
  // في حالة وجود محارف غير آمنة، نقتطعها
  // لكن نعتمد على safeBook فقط للسلامة.
}

const SQL = {
  bookExists:        `SELECT id, title, author_id, edition FROM tafsir_books WHERE id = '${escSql(safeBook)}' LIMIT 1;`,
  authorExists:      `SELECT a.id, a.name, a.death_year FROM authors a JOIN tafsir_books b ON b.author_id = a.id WHERE b.id = '${escSql(safeBook)}' LIMIT 1;`,
  entriesCount:      `SELECT COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}';`,
  surahsCovered:     `SELECT COUNT(DISTINCT surah_number) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}';`,
  emptyText:         `SELECT COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' AND (text IS NULL OR TRIM(text) = '');`,
  invalidSourceType: `SELECT COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' AND source_type NOT IN ('${ALLOWED_SOURCE_TYPES.join("','")}');`,
  invalidVerif:      `SELECT COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' AND verification_status NOT IN ('${ALLOWED_VERIFICATION.join("','")}');`,
  originalMissing:   `SELECT COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' AND source_type = 'original-text' AND (source_name IS NULL OR TRIM(source_name) = '' OR source_url IS NULL OR TRIM(source_url) = '' OR ((edition IS NULL OR TRIM(edition) = '') AND (page IS NULL) AND (volume IS NULL)));`,
  byType:            `SELECT source_type, COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' GROUP BY source_type;`,
  byVerif:           `SELECT verification_status, COUNT(*) AS c FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' GROUP BY verification_status;`,
  sample1_1:         `SELECT surah_number, ayah_number, source_type, verification_status FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' AND surah_number = 1 AND ayah_number = 1 LIMIT 1;`,
  sample114_6:       `SELECT surah_number, ayah_number, source_type, verification_status FROM tafsir_entries WHERE book_id = '${escSql(safeBook)}' AND surah_number = 114 AND ayah_number = 6 LIMIT 1;`,
}

function buildCommand(sql) {
  const parts = ['wrangler', 'd1', 'execute', databaseName]
  parts.push(flagRemote ? '--remote' : '--local')
  parts.push('--json')
  parts.push('--command', JSON.stringify(sql))
  return 'npx ' + parts.join(' ')
}

const cmdList = Object.entries(SQL).map(([key, sql]) => ({
  key, label: key, cmd: buildCommand(sql),
}))

const report = {
  ok: true,
  mode: flagDry ? 'dry-run' : (flagRemote ? 'remote' : 'local'),
  strict: flagStrict,
  bookId: safeBook,
  databaseName,
  bindingActive,
  results: {
    bookExists: null,
    authorExists: null,
    entriesCount: null,
    surahsCovered: null,
    emptyText: null,
    invalidSourceType: null,
    invalidVerif: null,
    originalMissing: null,
    byType: {},
    byVerif: {},
    sample1_1: null,
    sample114_6: null,
  },
  checks: [],
  commands: cmdList,
  status: 'unknown',
  nextStep: null,
}

function add(name, ok, info = '') {
  report.checks.push({ name, ok, info })
  if (!ok) report.ok = false
}

// =============== dry-run ===============
if (flagDry) {
  report.status = 'dry-run'
  report.nextStep = 'Run again without --dry-run to execute against D1'
  if (flagJson) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }
  console.log()
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.bold(`  verify-tafsir-d1 — DRY RUN (book=${safeBook})`))
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.dim(`database_name: ${databaseName}`))
  console.log(c.dim(`mode:          dry-run${flagStrict ? ' (strict)' : ''}`))
  for (const cmd of cmdList) {
    console.log()
    console.log(`  ${c.yellow('▸')} ${cmd.label}`)
    console.log(`    ${c.blue(cmd.cmd)}`)
  }
  console.log()
  console.log(c.green('✓ أوامر جاهزة. شغّل دون --dry-run لتنفيذها.'))
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  process.exit(0)
}

// =============== التنفيذ ===============
function runWrangler(sql) {
  const wArgs = ['wrangler', 'd1', 'execute', databaseName]
  wArgs.push(flagRemote ? '--remote' : '--local')
  wArgs.push('--json', '--command', sql)
  const r = spawnSync('npx', wArgs, {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (r.status !== 0) return { ok: false, results: [], stderr: (r.stderr || '').slice(-500) }
  try {
    // قد يطبع wrangler نصًّا قبل الـ JSON؛ نلتقط أول مصفوفة JSON.
    const out = r.stdout || ''
    const m = out.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/m) || out.match(/\[[\s\S]*\]\s*$/m)
    const arr = JSON.parse(m ? m[0] : out)
    const first = Array.isArray(arr) ? arr[0] : arr
    return { ok: true, results: first?.results || [] }
  } catch {
    return { ok: false, results: [], stderr: 'parse-error' }
  }
}

function getCount(sql) {
  const r = runWrangler(sql)
  if (!r.ok) return null
  return r.results.length ? Number(r.results[0].c || 0) : 0
}

// 1) Book exists
const bookRes = runWrangler(SQL.bookExists)
const bookRow = bookRes.results?.[0] || null
report.results.bookExists = !!bookRow
add('book exists in tafsir_books', !!bookRow, bookRow ? `id=${bookRow.id} title=${bookRow.title}` : 'not found')

// 2) Author exists
const authorRes = runWrangler(SQL.authorExists)
const authorRow = authorRes.results?.[0] || null
report.results.authorExists = !!authorRow
add('author exists', !!authorRow, authorRow ? `id=${authorRow.id} name=${authorRow.name}` : 'not found')

// 3) entries count
const ec = getCount(SQL.entriesCount)
report.results.entriesCount = ec
add('entries count > 0', (ec || 0) > 0, `entries=${ec}`)

// 4) surahs covered
const sc = getCount(SQL.surahsCovered)
report.results.surahsCovered = sc
add('surahs covered', (sc || 0) > 0, `surahs=${sc}`)

// 5) empty text
const empty = getCount(SQL.emptyText)
report.results.emptyText = empty
add('no empty text', (empty || 0) === 0, `empty=${empty}`)

// 6) invalid source_type
const badSt = getCount(SQL.invalidSourceType)
report.results.invalidSourceType = badSt
add('all source_type valid', (badSt || 0) === 0, `invalid=${badSt}`)

// 7) invalid verification_status
const badV = getCount(SQL.invalidVerif)
report.results.invalidVerif = badV
add('all verification_status valid', (badV || 0) === 0, `invalid=${badV}`)

// 8) original-text missing source metadata
const origMissing = getCount(SQL.originalMissing)
report.results.originalMissing = origMissing
add('original-text has full source metadata', (origMissing || 0) === 0, `missing=${origMissing}`)

// 9) byType / byVerif
{
  const r = runWrangler(SQL.byType)
  for (const row of (r.results || [])) {
    report.results.byType[row.source_type] = Number(row.c || 0)
  }
}
{
  const r = runWrangler(SQL.byVerif)
  for (const row of (r.results || [])) {
    report.results.byVerif[row.verification_status] = Number(row.c || 0)
  }
}

// 10) sample ayahs
report.results.sample1_1   = (runWrangler(SQL.sample1_1).results || [])[0] || null
report.results.sample114_6 = (runWrangler(SQL.sample114_6).results || [])[0] || null
add('sample 1:1 present',   !!report.results.sample1_1,   report.results.sample1_1 ? 'OK' : 'missing')
add('sample 114:6 present', !!report.results.sample114_6, report.results.sample114_6 ? 'OK' : 'missing')

// =============== status ===============
if (report.ok) {
  report.status = 'ok'
  report.nextStep = `✓ كتاب التفسير "${safeBook}" موجود وصالح في D1`
} else {
  report.status = 'failed'
  report.nextStep = 'فشل أحد الفحوصات — راجع تفاصيل النتائج'
}

if (flagJson) {
  console.log(JSON.stringify(report, null, 2))
  process.exit((flagStrict && !report.ok) ? 1 : 0)
}

console.log()
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(c.bold(`  verify-tafsir-d1 — book=${safeBook}`))
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(c.dim(`database:      ${databaseName}`))
console.log(c.dim(`mode:          ${flagRemote ? 'remote' : 'local'}${flagStrict ? ' (strict)' : ''}`))
console.log(c.dim('───────────────────────────────────────────────────────────'))
for (const ck of report.checks) {
  const sym = ck.ok ? c.green('✓') : c.red('✗')
  console.log(`  ${sym} ${ck.name}  ${c.dim(ck.info || '')}`)
}
console.log(c.dim('───────────────────────────────────────────────────────────'))
console.log(c.bold('Distribution:'))
console.log('  byType:  ' + JSON.stringify(report.results.byType))
console.log('  byVerif: ' + JSON.stringify(report.results.byVerif))
console.log(c.dim('───────────────────────────────────────────────────────────'))
if (report.ok) {
  console.log(c.green(report.nextStep))
} else {
  console.log(c.red(report.nextStep))
}
console.log(c.bold('═══════════════════════════════════════════════════════════'))
process.exit((flagStrict && !report.ok) ? 1 : 0)
