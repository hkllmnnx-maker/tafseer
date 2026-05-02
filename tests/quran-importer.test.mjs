// =============================================================================
// quran-importer.test.mjs — اختبارات سكربت import-quran.mjs
// =============================================================================
// يختبر:
//   - عينة صحيحة → ينتج SQL + تقرير JSON.
//   - --full --strict على عينة جزئية → يفشل (exit code 1).
//   - --allow-partial --strict على عينة صحيحة → ينجح.
//   - عينة خاطئة → يفشل.
//   - الناتج لا يحتوي literal undefined / NaN.
//   - الناتج يحتوي INSERT OR REPLACE INTO ayahs.
//   - التقرير يحتوي SHA-256 + counts صحيحة.
//   - لا --full ولا --allow-partial → يفشل.
// =============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const SCRIPT     = path.join(ROOT, 'scripts/importers/import-quran.mjs')
const VALID      = path.join(ROOT, 'fixtures/import-samples/quran-valid-sample.json')
const INVALID    = path.join(ROOT, 'fixtures/import-samples/quran-invalid-sample.json')

function run(args, opts = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  })
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  }
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quran-import-test-'))
}

// -----------------------------------------------------------------------------

test('quran-importer: missing required flag fails (no --full and no --allow-partial)', () => {
  const r = run([VALID, '--strict'])
  assert.notEqual(r.status, 0)
  // الرسالة على stderr
  const both = r.stdout + r.stderr
  assert.match(both, /--full|--allow-partial/)
})

test('quran-importer: --full + --allow-partial together fails', () => {
  const r = run([VALID, '--full', '--allow-partial', '--strict'])
  assert.notEqual(r.status, 0)
})

test('quran-importer: --full --strict rejects partial sample', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--full', '--strict', '--output', tmp])
  // يجب أن يفشل (exit !=0) لأن العينة فيها 5 آيات فقط
  assert.notEqual(r.status, 0, 'expected non-zero exit for --full on partial sample')
  // لا يجب أن يولّد SQL (الفشل في مرحلة validation قبل الكتابة)
  const sqlPath = path.join(tmp, 'ayahs-full.sql')
  assert.equal(fs.existsSync(sqlPath), false)
})

test('quran-importer: --allow-partial --strict accepts valid small sample', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--allow-partial', '--strict', '--output', tmp])
  assert.equal(r.status, 0, `expected success, got: ${r.stderr || r.stdout}`)
  const sqlPath = path.join(tmp, 'ayahs-sample.sql')
  const reportPath = path.join(tmp, 'quran-import-report.json')
  assert.equal(fs.existsSync(sqlPath), true, 'SQL file should be generated')
  assert.equal(fs.existsSync(reportPath), true, 'report file should be generated')
})

test('quran-importer: rejects invalid sample (multiple validation errors)', () => {
  const tmp = mkTmpDir()
  const r = run([INVALID, '--allow-partial', '--strict', '--output', tmp])
  assert.notEqual(r.status, 0)
  const sqlPath = path.join(tmp, 'ayahs-sample.sql')
  assert.equal(fs.existsSync(sqlPath), false)
})

test('quran-importer: SQL output is free of literal undefined / NaN', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--allow-partial', '--strict', '--output', tmp])
  assert.equal(r.status, 0)
  const sqlPath = path.join(tmp, 'ayahs-sample.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  assert.equal(/\bundefined\b/.test(sql), false, 'SQL must not contain literal "undefined"')
  assert.equal(/\bNaN\b/.test(sql), false, 'SQL must not contain literal "NaN"')
})

test('quran-importer: SQL contains INSERT OR REPLACE INTO ayahs', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--allow-partial', '--strict', '--output', tmp])
  assert.equal(r.status, 0)
  const sql = fs.readFileSync(path.join(tmp, 'ayahs-sample.sql'), 'utf8')
  assert.match(sql, /INSERT OR REPLACE INTO ayahs/)
  // لا يستخدم UPDATE/DELETE
  assert.equal(/\bDELETE\s+FROM\s+ayahs\b/i.test(sql), false)
  // يبدأ بـ PRAGMA + BEGIN وينتهي بـ COMMIT
  assert.match(sql, /PRAGMA foreign_keys/)
  assert.match(sql, /BEGIN TRANSACTION/)
  assert.match(sql, /COMMIT;\s*$/m)
})

test('quran-importer: report includes sha256, counts, options', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--allow-partial', '--strict', '--output', tmp])
  assert.equal(r.status, 0)
  const report = JSON.parse(fs.readFileSync(path.join(tmp, 'quran-import-report.json'), 'utf8'))
  assert.equal(report.ok, true)
  assert.equal(typeof report.source.sha256, 'string')
  assert.equal(report.source.sha256.length, 64)              // SHA-256 hex = 64 chars
  assert.match(report.source.sha256, /^[a-f0-9]{64}$/)
  assert.equal(report.options.allowPartial, true)
  assert.equal(report.options.strict, true)
  assert.equal(report.options.full, false)
  assert.equal(report.output.ayahsWritten, 5)
  assert.equal(report.output.surahsCount, 1)
})

test('quran-importer: --json output mode emits parseable JSON', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--allow-partial', '--strict', '--output', tmp, '--json'])
  assert.equal(r.status, 0)
  // stdout يجب أن يكون JSON فقط
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.ok, true)
  assert.equal(typeof parsed.source.sha256, 'string')
})

test('quran-importer: custom filename via --filename works', () => {
  const tmp = mkTmpDir()
  const r = run([
    VALID, '--allow-partial', '--strict',
    '--output', tmp,
    '--filename', 'custom-name.sql',
  ])
  assert.equal(r.status, 0)
  assert.equal(fs.existsSync(path.join(tmp, 'custom-name.sql')), true)
})

test('quran-importer: source_name and source_url propagate to SQL', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--allow-partial', '--strict', '--output', tmp])
  assert.equal(r.status, 0)
  const sql = fs.readFileSync(path.join(tmp, 'ayahs-sample.sql'), 'utf8')
  // العيّنة الصحيحة فيها source = "مصحف المدينة - مجمع الملك فهد"
  assert.match(sql, /مصحف المدينة/)
  assert.match(sql, /https:\/\/qurancomplex\.gov\.sa/)
  // imported_from يجب أن يحتوي اسم السكربت
  assert.match(sql, /import-quran\.mjs/)
})

test('quran-importer: nonexistent file fails fast', () => {
  const r = run(['/nonexistent/path/to/file.json', '--allow-partial', '--strict'])
  assert.notEqual(r.status, 0)
})
