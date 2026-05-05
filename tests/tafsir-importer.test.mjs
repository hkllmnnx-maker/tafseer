// =============================================================================
// tafsir-importer.test.mjs — اختبارات سكربت import-tafsir.mjs
// =============================================================================
// يختبر:
//   - عينة صحيحة → ينتج SQL + تقرير JSON.
//   - عينة خاطئة → يفشل ولا يولّد SQL.
//   - --strict على عينة صحيحة → ينجح.
//   - الناتج يحتوي INSERT OR REPLACE INTO authors / tafsir_books / tafsir_entries.
//   - الناتج لا يحتوي literal undefined / NaN / null كقيم نصية.
//   - التقرير يحتوي SHA-256 صحيح + counts.
//   - --filename و --output يعملان.
// =============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const SCRIPT     = path.join(ROOT, 'scripts/importers/import-tafsir.mjs')
const VALID      = path.join(ROOT, 'fixtures/import-samples/tafsir-valid-sample.json')
const INVALID    = path.join(ROOT, 'fixtures/import-samples/tafsir-invalid-sample.json')

function run(args, opts = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    ...opts,
  })
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  }
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tafsir-import-test-'))
}

// -----------------------------------------------------------------------------
// 0) Sanity: الفيكسترز موجودة
// -----------------------------------------------------------------------------
test('tafsir-importer: fixtures موجودة', () => {
  assert.ok(fs.existsSync(SCRIPT), 'import-tafsir.mjs موجود')
  assert.ok(fs.existsSync(VALID), 'tafsir-valid-sample.json موجود')
  assert.ok(fs.existsSync(INVALID), 'tafsir-invalid-sample.json موجود')
})

// -----------------------------------------------------------------------------
// 1) العيّنة الصالحة تنجح وتنتج SQL وتقرير
// -----------------------------------------------------------------------------
test('tafsir-importer: valid sample يولّد SQL + report بنجاح', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--output', tmp, '--filename', 'tafsir-test.sql'])
  assert.equal(r.status, 0, `expected success, got: ${r.stderr || r.stdout}`)

  const sqlPath = path.join(tmp, 'tafsir-test.sql')
  const reportPath = path.join(tmp, 'tafsir-import-report.json')
  assert.ok(fs.existsSync(sqlPath), 'SQL file should be generated')
  assert.ok(fs.existsSync(reportPath), 'report file should be generated')

  const sql = fs.readFileSync(sqlPath, 'utf8')
  assert.match(sql, /INSERT OR REPLACE INTO authors/, 'SQL يحتوي INSERT OR REPLACE INTO authors')
  assert.match(sql, /INSERT OR REPLACE INTO tafsir_books/, 'SQL يحتوي INSERT OR REPLACE INTO tafsir_books')
  assert.match(sql, /INSERT OR REPLACE INTO tafsir_entries/, 'SQL يحتوي INSERT OR REPLACE INTO tafsir_entries')
})

// -----------------------------------------------------------------------------
// 2) العيّنة الخاطئة تفشل ولا تنتج SQL
// -----------------------------------------------------------------------------
test('tafsir-importer: invalid sample يفشل ولا يولّد SQL', () => {
  const tmp = mkTmpDir()
  const r = run([INVALID, '--output', tmp, '--filename', 'invalid-test.sql'])
  assert.notEqual(r.status, 0, 'expected non-zero exit for invalid sample')

  const sqlPath = path.join(tmp, 'invalid-test.sql')
  assert.equal(fs.existsSync(sqlPath), false, 'SQL file should NOT be generated on invalid input')
})

// -----------------------------------------------------------------------------
// 3) --strict على العيّنة الصحيحة ينجح (الفيكسترز يلتزم بالـ strict)
// -----------------------------------------------------------------------------
test('tafsir-importer: --strict على valid sample ينجح', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--strict', '--output', tmp, '--filename', 'strict-test.sql'])
  assert.equal(r.status, 0, `expected --strict success, got: ${r.stderr || r.stdout}`)
  assert.ok(fs.existsSync(path.join(tmp, 'strict-test.sql')))
})

// -----------------------------------------------------------------------------
// 4) ملف غير موجود يفشل
// -----------------------------------------------------------------------------
test('tafsir-importer: ملف غير موجود يفشل برسالة واضحة', () => {
  const tmp = mkTmpDir()
  const r = run([path.join(tmp, 'nonexistent.json'), '--output', tmp])
  assert.notEqual(r.status, 0)
  const both = r.stdout + r.stderr
  assert.ok(both.length > 0, 'يجب أن تظهر رسالة خطأ')
})

// -----------------------------------------------------------------------------
// 5) SQL لا يحتوي literal undefined / NaN كقيم
// -----------------------------------------------------------------------------
test('tafsir-importer: SQL لا يحتوي literal undefined أو NaN', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--output', tmp, '--filename', 'clean-test.sql'])
  assert.equal(r.status, 0)
  const sql = fs.readFileSync(path.join(tmp, 'clean-test.sql'), 'utf8')

  // لا نريد literal undefined أو NaN كقيم (نسمح بها داخل التعليقات لو حدث)
  // كل قيمة نصية يجب أن تكون '...' أو NULL، ليس undefined/NaN.
  assert.equal(/'undefined'/.test(sql), false, 'SQL يجب ألّا يحتوي قيمة نصية "undefined"')
  assert.equal(/'NaN'/.test(sql), false, 'SQL يجب ألّا يحتوي قيمة نصية "NaN"')
  assert.equal(/\bNaN\b(?![A-Za-z])/.test(sql.replace(/--.*$/gm, '')), false,
    'SQL يجب ألّا يحتوي literal NaN خارج التعليقات')
})

// -----------------------------------------------------------------------------
// 6) تقرير JSON يحتوي SHA-256 صحيح
// -----------------------------------------------------------------------------
test('tafsir-importer: التقرير يحتوي SHA-256 مطابق للملف الأصلي', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--output', tmp, '--filename', 'sha-test.sql'])
  assert.equal(r.status, 0)

  const reportPath = path.join(tmp, 'tafsir-import-report.json')
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))

  // التقرير يحتوي حقل sha256 (إمّا داخل source أو على المستوى الأعلى)
  const sha = report.source?.sha256 || report.sha256 || report.sourceSha256
  assert.ok(sha, 'التقرير يجب أن يحتوي SHA-256')
  assert.match(sha, /^[a-f0-9]{64}$/, 'SHA-256 صيغة hex سداسية 64 خانة')

  // تحقق من المطابقة الفعلية
  const expected = crypto.createHash('sha256')
    .update(fs.readFileSync(VALID))
    .digest('hex')
  assert.equal(sha, expected, 'SHA-256 المُسجَّل يجب أن يطابق هاش الملف الأصلي')
})

// -----------------------------------------------------------------------------
// 7) عدد الـ entries في التقرير = عدد الـ entries المكتوبة في SQL
// -----------------------------------------------------------------------------
test('tafsir-importer: عدد الإدخالات في التقرير يطابق إدخالات الفيكستر', () => {
  const tmp = mkTmpDir()
  const r = run([VALID, '--output', tmp, '--filename', 'count-test.sql'])
  assert.equal(r.status, 0)

  const report = JSON.parse(
    fs.readFileSync(path.join(tmp, 'tafsir-import-report.json'), 'utf8'),
  )
  const fixture = JSON.parse(fs.readFileSync(VALID, 'utf8'))

  // الاسم قد يختلف حسب البنية (output.entriesWritten أو entriesWritten أو totalEntries)
  const written = report.output?.entriesWritten
    ?? report.entriesWritten
    ?? report.totalEntries
    ?? report.stats?.entriesWritten
  assert.ok(typeof written === 'number', 'يجب أن يحتوي التقرير عدد الإدخالات المكتوبة')
  assert.equal(written, fixture.entries.length,
    `عدد الإدخالات في التقرير (${written}) يجب أن يساوي عدد إدخالات الفيكستر (${fixture.entries.length})`)
})

// -----------------------------------------------------------------------------
// 8) --output مسار مخصّص يعمل
// -----------------------------------------------------------------------------
test('tafsir-importer: --output في مسار مخصّص يعمل', () => {
  const tmp = mkTmpDir()
  const customDir = path.join(tmp, 'custom-output-dir')
  const r = run([VALID, '--output', customDir, '--filename', 'in-custom.sql'])
  assert.equal(r.status, 0, `expected success, got: ${r.stderr || r.stdout}`)
  assert.ok(fs.existsSync(path.join(customDir, 'in-custom.sql')))
  assert.ok(fs.existsSync(path.join(customDir, 'tafsir-import-report.json')))
})

// -----------------------------------------------------------------------------
// 9) السكربت idempotent: تشغيله مرتين ينتج نفس SHA لمحتوى SQL مع نفس الإدخال
// -----------------------------------------------------------------------------
test('tafsir-importer: تشغيلان متتاليان يولّدان SQL متطابق المحتوى (deterministic)', () => {
  const tmp1 = mkTmpDir()
  const tmp2 = mkTmpDir()
  const r1 = run([VALID, '--output', tmp1, '--filename', 'a.sql'])
  const r2 = run([VALID, '--output', tmp2, '--filename', 'a.sql'])
  assert.equal(r1.status, 0)
  assert.equal(r2.status, 0)

  // قد تختلف الطوابع الزمنية (imported_at + header) بين التشغيلين، لذا
  // نُزيلها قبل المقارنة. الهدف هو ضمان أن ترتيب وعدد ومحتوى الإدخالات
  // ثابت (deterministic) لنفس مدخل JSON.
  const stripTs = (s) => s
    .replace(/'\d{4}-\d{2}-\d{2}T[\d:.\-Z]+'/g, "'<TS>'") // imported_at literals
  const sql1 = fs.readFileSync(path.join(tmp1, 'a.sql'), 'utf8')
    .split('\n')
    .filter(l => /^\s*INSERT/.test(l))
    .map(stripTs)
    .join('\n')
  const sql2 = fs.readFileSync(path.join(tmp2, 'a.sql'), 'utf8')
    .split('\n')
    .filter(l => /^\s*INSERT/.test(l))
    .map(stripTs)
    .join('\n')
  assert.equal(sql1, sql2, 'عبارات INSERT (بعد تجريد الطوابع) يجب أن تكون متطابقة بين تشغيلين')
})
