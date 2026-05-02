#!/usr/bin/env node
// =============================================================================
// verify-quran-d1.mjs — التحقق من سلامة بيانات القرآن في D1 بعد الاستيراد
// =============================================================================
// الهدف:
//   فحص أن قاعدة بيانات D1 المحلية (أو البعيدة) تحتوي على القرآن كاملًا أو
//   جزئيًا بشكل صحيح. لا يحتاج أسرارًا بشكل افتراضي. يدعم وضع --dry-run الذي
//   يطبع الأوامر فقط دون تنفيذ.
//
// الاستعمال:
//   npm run verify:quran-d1                 # تنفيذ ضد D1 المحلي
//   npm run verify:quran-d1:dry             # طباعة الأوامر فقط
//   node scripts/importers/verify-quran-d1.mjs --json
//   node scripts/importers/verify-quran-d1.mjs --remote --strict
//
// الفحوصات:
//   1) عدد الآيات في جدول ayahs (المتوقع 6236 للقرآن الكامل).
//   2) عدد السور المغطّاة (يجب 114 لكامل القرآن).
//   3) عدم وجود تكرار (surah_number, ayah_number).
//   4) عدم وجود نصوص فارغة في عمود text.
//   5) وجود الآيات المرجعية: 1:1 و 2:255 (الكرسي) و 114:6.
//   6) (إن أمكن) وجود source_name و source_url من migration 0003.
//
// لا يفشل CI افتراضيًا إذا لم يكن wrangler/D1 متاحًا (يبقي القاعدة الفارغة
// تنبيهًا تشخيصيًا فقط). مع --strict ينهي بـ exit code 1 عند أي فشل جوهري.
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

// قيم التحقق المرجعية للقرآن الكامل
const EXPECTED_AYAHS_FULL = 6236
const EXPECTED_SURAHS = 114

// آيات مرجعية إلزامية في القرآن — يجب أن تكون موجودة في أي استيراد كامل
const REFERENCE_AYAHS = [
  { surah: 1,   ayah: 1,   label: 'الفاتحة:1 (بسم الله الرحمن الرحيم)' },
  { surah: 2,   ayah: 255, label: 'البقرة:255 (آية الكرسي)' },
  { surah: 114, ayah: 6,   label: 'الناس:6 (الآية الأخيرة من القرآن)' },
]

// ============== استعلامات SQL للفحص ==============
const SQL_QUERIES = {
  countAyahs:           'SELECT COUNT(*) AS c FROM ayahs;',
  countSurahsCovered:   'SELECT COUNT(DISTINCT surah_number) AS c FROM ayahs;',
  duplicates:           'SELECT surah_number, ayah_number, COUNT(*) AS c FROM ayahs GROUP BY surah_number, ayah_number HAVING c > 1 LIMIT 5;',
  emptyTexts:           "SELECT COUNT(*) AS c FROM ayahs WHERE text IS NULL OR TRIM(text) = '';",
  hasSourceColumn:      "SELECT name FROM pragma_table_info('ayahs') WHERE name IN ('source_name','source_url');",
  ayah_1_1:             'SELECT surah_number, ayah_number, text FROM ayahs WHERE surah_number = 1 AND ayah_number = 1;',
  ayah_2_255:           'SELECT surah_number, ayah_number, text FROM ayahs WHERE surah_number = 2 AND ayah_number = 255;',
  ayah_114_6:           'SELECT surah_number, ayah_number, text FROM ayahs WHERE surah_number = 114 AND ayah_number = 6;',
  sourceCounts:         'SELECT COUNT(*) AS total, SUM(CASE WHEN source_name IS NOT NULL AND TRIM(source_name) != \'\' THEN 1 ELSE 0 END) AS with_source FROM ayahs;',
}

// ============== تقرير ==============
const report = {
  ok: true,
  mode: flagDry ? 'dry-run' : (flagRemote ? 'remote' : 'local'),
  databaseName: null,
  expectedAyahs: EXPECTED_AYAHS_FULL,
  expectedSurahs: EXPECTED_SURAHS,
  checks: [],
  commands: [],
  // تجميع النتائج الفعلية إن جرى التنفيذ
  results: {
    ayahsCount: null,
    surahsCovered: null,
    duplicates: null,
    emptyTexts: null,
    hasSourceColumns: null,
    referenceAyahs: {},
    isComplete: null,
  },
  status: 'unknown',
  nextStep: null,
}

function add(name, ok, info = '', informational = false) {
  report.checks.push({ name, ok, info, ...(informational ? { informational: true } : {}) })
  if (!ok && !informational) report.ok = false
}

// ============== قراءة wrangler.jsonc ==============
const WRANGLER  = path.join(ROOT, 'wrangler.jsonc')
let databaseName = 'tafseer-production'
let bindingActive = false
if (fs.existsSync(WRANGLER)) {
  const raw = fs.readFileSync(WRANGLER, 'utf8')
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  try {
    const parsed = JSON.parse(stripped)
    if (Array.isArray(parsed.d1_databases) && parsed.d1_databases[0]) {
      databaseName = parsed.d1_databases[0].database_name || databaseName
      bindingActive = true
    }
  } catch { /* ignore */ }
  // اقرأ الاسم من النص الخام إن لم نستطع parse
  if (!bindingActive) {
    const m = raw.match(/"database_name"\s*:\s*"([^"]+)"/)
    if (m) databaseName = m[1]
    bindingActive = /"d1_databases"\s*:\s*\[/.test(raw) && !/\/\/\s*"d1_databases"/m.test(raw)
  }
}
report.databaseName = databaseName

// ============== بناء الأوامر ==============
function buildCommand(sql) {
  const parts = ['wrangler', 'd1', 'execute', databaseName]
  if (flagRemote) parts.push('--remote')
  else parts.push('--local')
  parts.push('--json')
  parts.push('--command', JSON.stringify(sql))
  return 'npx ' + parts.join(' ')
}

const cmdList = [
  { key: 'countAyahs',        label: 'عدد الآيات في جدول ayahs',                cmd: buildCommand(SQL_QUERIES.countAyahs) },
  { key: 'countSurahsCovered', label: 'عدد السور المغطّاة',                     cmd: buildCommand(SQL_QUERIES.countSurahsCovered) },
  { key: 'duplicates',        label: 'فحص التكرارات (surah,ayah)',              cmd: buildCommand(SQL_QUERIES.duplicates) },
  { key: 'emptyTexts',        label: 'فحص النصوص الفارغة',                      cmd: buildCommand(SQL_QUERIES.emptyTexts) },
  { key: 'hasSourceColumn',   label: 'فحص وجود source_name و source_url',       cmd: buildCommand(SQL_QUERIES.hasSourceColumn) },
  { key: 'ayah_1_1',          label: 'وجود آية 1:1 (الفاتحة)',                  cmd: buildCommand(SQL_QUERIES.ayah_1_1) },
  { key: 'ayah_2_255',        label: 'وجود آية 2:255 (الكرسي)',                 cmd: buildCommand(SQL_QUERIES.ayah_2_255) },
  { key: 'ayah_114_6',        label: 'وجود آية 114:6 (الناس)',                  cmd: buildCommand(SQL_QUERIES.ayah_114_6) },
  { key: 'sourceCounts',      label: 'إحصاء source_name الموجود',               cmd: buildCommand(SQL_QUERIES.sourceCounts) },
]
report.commands = cmdList

// ============== وضع dry-run: طباعة الأوامر فقط ==============
if (flagDry) {
  report.status = 'dry-run'
  report.nextStep = 'Run again without --dry-run to execute against D1'
  add('dry-run mode',     true, 'تم طباعة الأوامر فقط دون تنفيذ', true)
  add('database name',    !!databaseName, databaseName || '(missing)', !databaseName)
  add('binding configured', bindingActive, bindingActive ? 'D1 binding active' : 'D1 binding commented out', !bindingActive)
  add('reference ayahs ready',
      cmdList.filter(x => x.key.startsWith('ayah_')).length === REFERENCE_AYAHS.length,
      `${REFERENCE_AYAHS.length} reference ayahs included`, false)

  if (flagJson) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }
  console.log()
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.bold('  verify-quran-d1 — DRY RUN (no execution)'))
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.dim(`database_name: ${databaseName}`))
  console.log(c.dim(`mode:          dry-run`))
  console.log(c.dim('───────────────────────────────────────────────────────────'))
  console.log(c.bold('الأوامر التي سيتم تنفيذها:'))
  for (const cmd of cmdList) {
    console.log()
    console.log(`  ${c.yellow('▸')} ${cmd.label}`)
    console.log(`    ${c.blue(cmd.cmd)}`)
  }
  console.log()
  console.log(c.dim('───────────────────────────────────────────────────────────'))
  console.log(c.bold('الفحوصات المرجعية:'))
  for (const ref of REFERENCE_AYAHS) {
    console.log(`  ${c.yellow('▸')} ${ref.label} (${ref.surah}:${ref.ayah})`)
  }
  console.log()
  console.log(c.dim(`expected ayahs:  ${EXPECTED_AYAHS_FULL} (full Quran)`))
  console.log(c.dim(`expected surahs: ${EXPECTED_SURAHS}`))
  console.log(c.green('✓ أوامر التحقق جاهزة. شغّل دون --dry-run لتنفيذها.'))
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  process.exit(0)
}

// ============== التنفيذ الفعلي ==============
function runWrangler(sql) {
  const wranglerArgs = [
    '--no-install', 'wrangler', 'd1', 'execute',
    databaseName,
    flagRemote ? '--remote' : '--local',
    '--json',
    '--command', sql,
  ]
  const r = spawnSync('npx', wranglerArgs, {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
  })
  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || r.stdout || 'unknown error').slice(0, 400) }
  }
  try {
    const parsed = JSON.parse(r.stdout)
    const block = Array.isArray(parsed) ? parsed[0] : parsed
    return { ok: true, results: (block && block.results) || [] }
  } catch (e) {
    return { ok: false, error: 'JSON parse failed: ' + e.message }
  }
}

// تحقق من توفر wrangler
const v = spawnSync('npx', ['--no-install', 'wrangler', '--version'], {
  cwd: ROOT, encoding: 'utf8', timeout: 15000,
})
if (v.status !== 0) {
  add('wrangler CLI available', false, 'install via npm install', true)
  report.status = 'wrangler-missing'
  report.nextStep = 'npm install'
  if (flagJson) { console.log(JSON.stringify(report, null, 2)); process.exit(flagStrict ? 1 : 0) }
  console.log(c.yellow('⚠ wrangler غير مثبَّت — لا يمكن تنفيذ التحقق الفعلي.'))
  console.log(c.dim('شغّل أولًا: npm install ثم أعد المحاولة.'))
  process.exit(flagStrict ? 1 : 0)
}
add('wrangler CLI available', true, (v.stdout || v.stderr || '').trim(), true)

if (!bindingActive) {
  add('D1 binding configured', false, 'D1 binding commented out — see docs/d1-setup.md', true)
  report.status = 'binding-disabled'
  report.nextStep = 'Enable D1 binding in wrangler.jsonc'
  if (flagJson) { console.log(JSON.stringify(report, null, 2)); process.exit(flagStrict ? 1 : 0) }
  console.log(c.yellow('⚠ D1 binding غير مفعَّل في wrangler.jsonc — لا يمكن تنفيذ التحقق.'))
  process.exit(flagStrict ? 1 : 0)
}

// 1) عدد الآيات
const r1 = runWrangler(SQL_QUERIES.countAyahs)
let ayahsCount = null
if (r1.ok) {
  ayahsCount = Number(r1.results?.[0]?.c || 0)
  report.results.ayahsCount = ayahsCount
  const isFull = ayahsCount === EXPECTED_AYAHS_FULL
  add(`عدد الآيات في ayahs = ${ayahsCount}`, ayahsCount > 0,
      isFull ? `✓ القرآن كامل (${EXPECTED_AYAHS_FULL})` : `جزئي (${ayahsCount}/${EXPECTED_AYAHS_FULL})`,
      !isFull)
  report.results.isComplete = isFull
} else {
  add('عدد الآيات', false, r1.error)
  report.results.ayahsCount = 0
  report.results.isComplete = false
}

// 2) السور المغطّاة
const r2 = runWrangler(SQL_QUERIES.countSurahsCovered)
if (r2.ok) {
  const surahs = Number(r2.results?.[0]?.c || 0)
  report.results.surahsCovered = surahs
  add(`عدد السور المغطّاة = ${surahs}`, surahs > 0,
      surahs === EXPECTED_SURAHS ? '✓ كل السور مغطّاة' : `${surahs}/${EXPECTED_SURAHS}`,
      surahs !== EXPECTED_SURAHS)
} else {
  add('السور المغطّاة', false, r2.error)
}

// 3) التكرارات
const r3 = runWrangler(SQL_QUERIES.duplicates)
if (r3.ok) {
  const dups = (r3.results || []).length
  report.results.duplicates = dups
  add('لا توجد تكرارات (surah,ayah)', dups === 0,
      dups === 0 ? 'OK' : `وُجد ${dups} تكرار`)
} else {
  add('فحص التكرارات', false, r3.error)
}

// 4) النصوص الفارغة
const r4 = runWrangler(SQL_QUERIES.emptyTexts)
if (r4.ok) {
  const empty = Number(r4.results?.[0]?.c || 0)
  report.results.emptyTexts = empty
  add('لا توجد نصوص فارغة', empty === 0, empty === 0 ? 'OK' : `وُجد ${empty} نص فارغ`)
} else {
  add('فحص النصوص الفارغة', false, r4.error)
}

// 5) أعمدة المصدر (informational - migration 0003)
const r5 = runWrangler(SQL_QUERIES.hasSourceColumn)
if (r5.ok) {
  const cols = (r5.results || []).map(x => x.name)
  const has = cols.includes('source_name') || cols.includes('source_url')
  report.results.hasSourceColumns = has
  add('أعمدة source_name/source_url موجودة', has,
      has ? cols.join(', ') : 'migration 0003 not applied yet',
      !has)
} else {
  add('فحص أعمدة المصدر', false, r5.error, true)
}

// 6) الآيات المرجعية
for (const ref of REFERENCE_AYAHS) {
  const sql = `SELECT surah_number, ayah_number, text FROM ayahs WHERE surah_number = ${ref.surah} AND ayah_number = ${ref.ayah};`
  const rr = runWrangler(sql)
  const found = rr.ok && (rr.results || []).length > 0
  report.results.referenceAyahs[`${ref.surah}:${ref.ayah}`] = found
  add(`وجود الآية ${ref.surah}:${ref.ayah}`, found,
      found ? ref.label : 'مفقودة', !found && ayahsCount === EXPECTED_AYAHS_FULL ? false : !found)
}

// ============== الحالة النهائية ==============
if (ayahsCount === EXPECTED_AYAHS_FULL && report.ok) {
  report.status = 'complete'
  report.nextStep = '✓ القرآن الكامل في D1 — جاهز للإنتاج'
} else if (ayahsCount > 0) {
  report.status = 'partial'
  report.nextStep = 'استورد القرآن الكامل: راجع docs/quran-import-plan.md'
} else {
  report.status = 'empty'
  report.nextStep = 'npm run db:migrate:local && npm run import:quran'
}

// ============== الإخراج ==============
if (flagJson) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok || !flagStrict ? 0 : 1)
}

console.log()
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(c.bold('  verify-quran-d1 — تقرير التحقق'))
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(c.dim(`database:  ${databaseName}`))
console.log(c.dim(`mode:      ${flagRemote ? 'remote' : 'local'}`))
console.log(c.dim('───────────────────────────────────────────────────────────'))
for (const ch of report.checks) {
  const mark = ch.ok ? c.green('✓') : c.red('✗')
  console.log(`  ${mark} ${ch.name}${ch.info ? c.dim('  — ' + ch.info) : ''}`)
}
console.log(c.dim('───────────────────────────────────────────────────────────'))
console.log(c.bold('الحالة:        ') + (
  report.status === 'complete' ? c.green(report.status) :
  report.status === 'partial'  ? c.yellow(report.status) :
                                  c.red(report.status)
))
if (report.nextStep) {
  console.log(c.bold('الخطوة التالية: ') + c.blue(report.nextStep))
}
console.log(c.bold('═══════════════════════════════════════════════════════════'))

if (flagStrict && !report.ok) process.exit(1)
process.exit(0)
