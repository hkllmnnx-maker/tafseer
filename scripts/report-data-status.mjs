#!/usr/bin/env node
// =============================================================================
// scripts/report-data-status.mjs
// -----------------------------------------------------------------------------
// تقرير شامل عن حالة البيانات في تطبيق تفسير:
//   - حالة seed (داخل الكود): عدد السور، الآيات، الكتب، المؤلفين، التفاسير.
//   - حالة عينة استيراد القرآن إن وُجدت في dist/import/quran-import-report.json.
//   - حالة عينة استيراد التفسير إن وُجدت في dist/import/tafsir-import-report.json.
//   - حالة قاعدة D1 (محلية أو إنتاج) عبر استدعاء `wrangler d1 execute` بشرط
//     تمرير --local أو --database. مع --dry-run نطبع الأوامر فقط.
//
// الاستخدام:
//   node scripts/report-data-status.mjs                 # تقرير ملوّن للوحة
//   node scripts/report-data-status.mjs --json          # JSON صرف
//   node scripts/report-data-status.mjs --local         # افحص D1 محليًا
//   node scripts/report-data-status.mjs --database tafseer-production
//   node scripts/report-data-status.mjs --local --dry-run
//
// رمز الخروج:
//   0 — التقرير تولّد (حتى لو لم تُحقق كل البيانات الكاملة، فهذا تقرير لا
//       يفشل عمدًا حتى يمكن استخدامه كخطوة CI لمراقبة الحالة).
//   1 — خطأ تشغيلي (فشل قراءة wrangler.jsonc، خطأ JSON صريح، إلخ).
// =============================================================================

import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ---------------- CLI ----------------
const args = process.argv.slice(2)
function flag(name) { return args.includes(name) }
function value(name) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}
const wantJson  = flag('--json')
const useLocal  = flag('--local')
const dryRun    = flag('--dry-run')
const dbOverride = value('--database')

// ---------------- Helpers ----------------
const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

function readJsonSafe(p) {
  try {
    if (!existsSync(p)) return null
    const txt = readFileSync(p, 'utf8')
    return JSON.parse(txt.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))
  } catch { return null }
}

function fileSize(p) {
  try { return statSync(p).size } catch { return 0 }
}

// ============================================================
// Seed counts — استخراج بسيط من ملفات src/data/*.ts بدون runtime
// ============================================================
function countObjectsInArrayFile(path) {
  if (!existsSync(path)) return 0
  let src = readFileSync(path, 'utf8')
  // Strip block + line comments to avoid false positives.
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // Only count {...} blocks that live inside an exported array literal
  // (e.g. `export const FOO: Bar[] = [ ... ]`). This skips interface/type
  // definitions which would otherwise inflate the count by one.
  const startMatch = src.match(/export\s+const\s+\w+\s*(?::[^=]+)?=\s*\[/)
  if (!startMatch) return 0
  const startIdx = startMatch.index + startMatch[0].length
  let depth = 0, count = 0, bracket = 1
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') bracket++
    else if (ch === ']') {
      bracket--
      if (bracket === 0) break
    } else if (ch === '{') {
      if (depth === 0) count++
      depth++
    } else if (ch === '}') {
      depth--
    }
  }
  return count
}

function readSeedSummary() {
  return {
    surahs:     countObjectsInArrayFile(resolve(ROOT, 'src/data/surahs.ts')),
    ayahs:      countObjectsInArrayFile(resolve(ROOT, 'src/data/ayahs.ts')),
    authors:    countObjectsInArrayFile(resolve(ROOT, 'src/data/authors.ts')),
    books:      countObjectsInArrayFile(resolve(ROOT, 'src/data/books.ts')),
    tafseers:   countObjectsInArrayFile(resolve(ROOT, 'src/data/tafseers.ts')),
    categories: countObjectsInArrayFile(resolve(ROOT, 'src/data/categories.ts')),
  }
}

// ============================================================
// Quran/Tafsir import reports
// ============================================================
function readImportReports() {
  const quranReportPath  = resolve(ROOT, 'dist/import/quran-import-report.json')
  const tafsirReportPath = resolve(ROOT, 'dist/import/tafsir-import-report.json')
  const ayahsFullSql     = resolve(ROOT, 'dist/import/ayahs-full.sql')
  const ayahsSampleSql   = resolve(ROOT, 'dist/import/ayahs-sample.sql')
  const tafsirSql        = resolve(ROOT, 'dist/import/tafsir-import.sql')
  const seedSql          = resolve(ROOT, 'dist/import/seed-data.sql')

  return {
    quranReport:  readJsonSafe(quranReportPath),
    quranReportPath,
    quranReportExists: existsSync(quranReportPath),

    tafsirReport: readJsonSafe(tafsirReportPath),
    tafsirReportPath,
    tafsirReportExists: existsSync(tafsirReportPath),

    files: {
      'ayahs-full.sql':      { path: ayahsFullSql,    exists: existsSync(ayahsFullSql),    size: fileSize(ayahsFullSql) },
      'ayahs-sample.sql':    { path: ayahsSampleSql,  exists: existsSync(ayahsSampleSql),  size: fileSize(ayahsSampleSql) },
      'tafsir-import.sql':   { path: tafsirSql,       exists: existsSync(tafsirSql),       size: fileSize(tafsirSql) },
      'seed-data.sql':       { path: seedSql,         exists: existsSync(seedSql),         size: fileSize(seedSql) },
    },

    importsDirExists: existsSync(resolve(ROOT, '.imports')),
    quranFullJsonExists: existsSync(resolve(ROOT, '.imports/quran-full.json')),
  }
}

// ============================================================
// D1 inspection (optional)
// ============================================================
function readDatabaseName() {
  if (dbOverride) return dbOverride
  const wranglerPath = resolve(ROOT, 'wrangler.jsonc')
  if (!existsSync(wranglerPath)) return null
  const conf = readJsonSafe(wranglerPath)
  const dbs = conf?.d1_databases
  if (Array.isArray(dbs) && dbs[0] && dbs[0].database_name) return dbs[0].database_name
  return null
}

function buildD1Command(database, sql) {
  return [
    'npx', 'wrangler', 'd1', 'execute', database,
    useLocal ? '--local' : '--remote',
    '--json',
    '--command', sql,
  ]
}

function runD1Sql(database, sql) {
  if (!database) return { ok: false, error: 'no-database' }
  const cmd = buildD1Command(database, sql)
  if (dryRun) return { ok: true, dryRun: true, command: cmd.join(' ') }
  const r = spawnSync(cmd[0], cmd.slice(1), {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
  })
  if (r.status !== 0) {
    return { ok: false, error: 'wrangler-failed', stderr: (r.stderr || '').slice(0, 500), stdout: (r.stdout || '').slice(0, 500) }
  }
  // wrangler returns array of result objects in --json mode
  try {
    const parsed = JSON.parse(r.stdout)
    const first  = Array.isArray(parsed) ? parsed[0] : parsed
    const rows   = first?.results || []
    return { ok: true, rows }
  } catch (e) {
    return { ok: false, error: 'parse-failed', message: e?.message }
  }
}

function checkD1Status() {
  if (!useLocal && !dbOverride) return { mode: 'skipped', reason: 'no --local / --database flag' }
  const database = readDatabaseName()
  if (!database) return { mode: 'skipped', reason: 'no database name' }

  const checks = [
    { key: 'ayahs',         sql: 'SELECT COUNT(*) AS c FROM ayahs' },
    { key: 'surahs',        sql: 'SELECT COUNT(*) AS c FROM surahs' },
    { key: 'tafsir_books',  sql: 'SELECT COUNT(*) AS c FROM tafsir_books' },
    { key: 'authors',       sql: 'SELECT COUNT(*) AS c FROM authors' },
    { key: 'tafsir_entries',sql: 'SELECT COUNT(*) AS c FROM tafsir_entries' },
  ]
  const result = { mode: useLocal ? 'local' : 'remote', database, dryRun, counts: {}, errors: [] }
  for (const ch of checks) {
    const r = runD1Sql(database, ch.sql)
    if (dryRun && r.dryRun) {
      result.counts[ch.key] = { dryRunCommand: r.command }
      continue
    }
    if (!r.ok) {
      result.counts[ch.key] = null
      result.errors.push({ key: ch.key, error: r.error, stderr: r.stderr })
      continue
    }
    const row = (r.rows || [])[0] || {}
    result.counts[ch.key] = Number(row.c ?? row.count ?? 0)
  }
  return result
}

// ============================================================
// Build full report
// ============================================================
function buildReport() {
  const seed = readSeedSummary()
  const imports = readImportReports()
  const d1 = checkD1Status()

  const quran = imports.quranReport ? {
    versesWritten: imports.quranReport.versesWritten,
    duplicatesSkipped: imports.quranReport.duplicatesSkipped,
    surahsCovered: imports.quranReport.surahsCovered,
    isFull: imports.quranReport.versesWritten === 6236,
    sha256: imports.quranReport.sha256,
    sourceName: imports.quranReport.source?.name,
    sourceUrl:  imports.quranReport.source?.url,
    importedAt: imports.quranReport.importedAt,
    options:    imports.quranReport.options,
  } : null

  const tafsir = imports.tafsirReport ? (() => {
    const tr = imports.tafsirReport
    // Support both legacy flat format and the new nested format produced by
    // scripts/importers/import-tafsir.mjs (output.*, source.*).
    const out = tr.output || {}
    const src = tr.source || {}
    return {
      entriesWritten: tr.entriesWritten ?? out.entriesWritten ?? 0,
      duplicatesSkipped:
        tr.duplicatesSkipped ??
        ((out.duplicateIdsSkipped ?? 0) + (out.duplicateKeysSkipped ?? 0)),
      surahsCovered: tr.surahsCovered ?? out.surahsCovered ?? null,
      book: tr.book || (src.bookId ? { id: src.bookId, title: src.bookTitle } : null),
      author: tr.author || (src.authorId ? { id: src.authorId, name: src.authorName } : null),
      sourceTypes: tr.sourceTypes || null,
      verificationStatuses: tr.verificationStatuses || null,
      importedAt: tr.importedAt || tr.generatedAt || null,
      sha256: tr.sha256 || src.sha256 || null,
      license: src.license || null,
      edition: src.edition || null,
    }
  })() : null

  return {
    generatedAt: new Date().toISOString(),
    seed,
    imports: {
      hasImportsDir: imports.importsDirExists,
      hasQuranFullJson: imports.quranFullJsonExists,
      quranReportExists: imports.quranReportExists,
      tafsirReportExists: imports.tafsirReportExists,
      files: imports.files,
      quran,
      tafsir,
    },
    d1,
    summary: {
      seedAyahs: seed.ayahs,
      seedTafseers: seed.tafseers,
      quranImported: !!quran && quran.isFull,
      quranSampleImported: !!quran && !quran.isFull,
      tafsirImported: !!tafsir,
      d1Mode: d1.mode,
    },
  }
}

// ============================================================
// Print
// ============================================================
function pad(s, n) { return String(s).padEnd(n) }
function fmtBytes(n) {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function printPretty(r) {
  console.log()
  console.log(C.bold('═══════════════════════════════════════════════════════════'))
  console.log(C.bold('              تقرير حالة بيانات تطبيق تفسير'))
  console.log(C.bold('═══════════════════════════════════════════════════════════'))
  console.log(C.dim(`generatedAt: ${r.generatedAt}`))
  console.log()

  console.log(C.bold('▌ بيانات seed (في الكود):'))
  console.log(`  ${pad('السور:', 14)} ${C.bold(r.seed.surahs)}`)
  console.log(`  ${pad('الآيات:', 14)} ${C.bold(r.seed.ayahs)}`)
  console.log(`  ${pad('المؤلفون:', 14)} ${C.bold(r.seed.authors)}`)
  console.log(`  ${pad('الكتب:', 14)} ${C.bold(r.seed.books)}`)
  console.log(`  ${pad('التفاسير:', 14)} ${C.bold(r.seed.tafseers)}`)
  console.log(`  ${pad('الموضوعات:', 14)} ${C.bold(r.seed.categories)}`)
  console.log()

  console.log(C.bold('▌ ملفات الاستيراد المُولَّدة:'))
  for (const [name, info] of Object.entries(r.imports.files)) {
    const mark = info.exists ? C.green('✓') : C.dim('—')
    console.log(`  ${mark} ${pad(name, 22)} ${info.exists ? fmtBytes(info.size) : 'غير موجود'}`)
  }
  console.log()

  console.log(C.bold('▌ تقرير استيراد القرآن:'))
  if (!r.imports.quran) {
    console.log(`  ${C.dim('— لا يوجد quran-import-report.json بعد.')}`)
    if (!r.imports.hasQuranFullJson) {
      console.log(`  ${C.yellow('⚠')} ملف .imports/quran-full.json غير موجود (لم يُستورد القرآن الكامل بعد).`)
      console.log(`     راجع docs/quran-import-plan.md لخطة الاستيراد.`)
    }
  } else {
    const q = r.imports.quran
    const okFull = q.isFull
    console.log(`  ${pad('الآيات المستوردة:', 22)} ${C.bold(q.versesWritten)} / 6236 ${okFull ? C.green('(كامل ✓)') : C.yellow('(عيّنة)')}`)
    console.log(`  ${pad('السور المغطّاة:', 22)} ${C.bold(q.surahsCovered)} / 114`)
    console.log(`  ${pad('المكرّرات المتجاهَلة:', 22)} ${q.duplicatesSkipped}`)
    if (q.sourceName) console.log(`  ${pad('المصدر:', 22)} ${q.sourceName}`)
    if (q.sourceUrl)  console.log(`  ${pad('رابط المصدر:', 22)} ${q.sourceUrl}`)
    if (q.sha256)     console.log(`  ${pad('SHA-256:', 22)} ${C.dim(q.sha256.slice(0, 16) + '…')}`)
    if (q.importedAt) console.log(`  ${pad('وقت الاستيراد:', 22)} ${C.dim(q.importedAt)}`)
  }
  console.log()

  console.log(C.bold('▌ تقرير استيراد التفسير:'))
  if (!r.imports.tafsir) {
    console.log(`  ${C.dim('— لا يوجد tafsir-import-report.json بعد.')}`)
  } else {
    const t = r.imports.tafsir
    console.log(`  ${pad('عدد التفاسير:', 22)} ${C.bold(t.entriesWritten)}`)
    if (t.book?.title)   console.log(`  ${pad('الكتاب:', 22)} ${t.book.title} (${t.book.id})`)
    if (t.author?.name)  console.log(`  ${pad('المؤلف:', 22)} ${t.author.name} (${t.author.id})`)
    if (t.sourceTypes)   console.log(`  ${pad('أنواع المصادر:', 22)} ${JSON.stringify(t.sourceTypes)}`)
    if (t.verificationStatuses) console.log(`  ${pad('حالات التحقّق:', 22)} ${JSON.stringify(t.verificationStatuses)}`)
    if (t.sha256)        console.log(`  ${pad('SHA-256:', 22)} ${C.dim(t.sha256.slice(0, 16) + '…')}`)
  }
  console.log()

  console.log(C.bold('▌ حالة Cloudflare D1:'))
  if (r.d1.mode === 'skipped') {
    console.log(`  ${C.dim('— تم التخطي (' + r.d1.reason + ')')}`)
    console.log(`     استعمل ${C.cyan('--local')} أو ${C.cyan('--database <name>')} لفحص D1.`)
  } else {
    console.log(`  ${pad('قاعدة البيانات:', 22)} ${C.bold(r.d1.database)}  (${r.d1.mode}${r.d1.dryRun ? ', dry-run' : ''})`)
    for (const [k, v] of Object.entries(r.d1.counts)) {
      const display = v && typeof v === 'object' && v.dryRunCommand
        ? C.dim('(dry-run) ' + v.dryRunCommand)
        : v == null ? C.red('فشل') : C.bold(String(v))
      console.log(`  ${pad(k + ':', 22)} ${display}`)
    }
    if (r.d1.errors.length) {
      console.log(C.yellow(`  أخطاء: ${r.d1.errors.length}`))
      for (const e of r.d1.errors) console.log(`    - ${e.key}: ${e.error}`)
    }
  }
  console.log()

  console.log(C.bold('▌ الخلاصة:'))
  console.log(`  ${r.summary.quranImported       ? C.green('✓') : r.summary.quranSampleImported ? C.yellow('~') : C.dim('—')} استيراد القرآن: ${r.summary.quranImported ? 'كامل (6236 آية)' : r.summary.quranSampleImported ? 'عيّنة فقط' : 'لم يُنفَّذ'}`)
  console.log(`  ${r.summary.tafsirImported      ? C.green('✓') : C.dim('—')} استيراد التفسير: ${r.summary.tafsirImported ? 'متوفّر' : 'لم يُنفَّذ'}`)
  console.log(`  ${r.d1.mode !== 'skipped'       ? C.green('✓') : C.dim('—')} فحص D1: ${r.d1.mode}`)
  console.log(C.bold('═══════════════════════════════════════════════════════════'))
}

// ============================================================
// Main
// ============================================================
const report = buildReport()
if (wantJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  printPretty(report)
}
process.exit(0)
