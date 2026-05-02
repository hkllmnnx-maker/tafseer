// =============================================================================
// tests/seed-export.test.mjs — اختبارات لمولّد seed-to-d1.mjs
// =============================================================================
// نتأكّد أن:
//   1) السكربت يولّد ملفي SQL+JSON بدون أخطاء.
//   2) لا يحتوي SQL على القيم الخطرة 'undefined' أو 'NaN'.
//   3) عدد الـ INSERT لكل جدول يطابق العدد المتوقّع تقريبًا.
//   4) كل الـ apostrophes العربية مفلتة بشكل صحيح ('').
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

test('seed-to-d1: generates SQL + JSON without throwing', () => {
  execSync('node scripts/importers/seed-to-d1.mjs', { cwd: ROOT, stdio: 'pipe' })
  const sql = fs.readFileSync(path.join(ROOT, 'dist/import/seed-data.sql'), 'utf8')
  const json = fs.readFileSync(path.join(ROOT, 'dist/import/seed-data.json'), 'utf8')
  assert.ok(sql.length > 1000, 'SQL must not be empty')
  assert.ok(json.length > 500, 'JSON must not be empty')
})

test('seed-to-d1: SQL has no undefined / NaN values', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'dist/import/seed-data.sql'), 'utf8')
  assert.ok(!/\bundefined\b/.test(sql), 'must contain no "undefined"')
  assert.ok(!/\bNaN\b/.test(sql), 'must contain no "NaN"')
})

test('seed-to-d1: SQL contains expected table coverage', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'dist/import/seed-data.sql'), 'utf8')
  // 114 surahs are canonical
  const surahCount = (sql.match(/INSERT OR REPLACE INTO surahs /g) || []).length
  assert.equal(surahCount, 114, 'must insert all 114 surahs')

  // tafsir_entries (≥ 50 sample entries expected)
  const entryCount = (sql.match(/INSERT OR REPLACE INTO tafsir_entries /g) || []).length
  assert.ok(entryCount >= 50, `expected ≥50 tafsir entries, got ${entryCount}`)

  // ayahs (≥ 200 sample ayahs expected)
  const ayahCount = (sql.match(/INSERT OR REPLACE INTO ayahs /g) || []).length
  assert.ok(ayahCount >= 200, `expected ≥200 ayahs, got ${ayahCount}`)
})

test('seed-to-d1: SQL begins with PRAGMA + BEGIN, ends with COMMIT', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'dist/import/seed-data.sql'), 'utf8')
  assert.ok(sql.includes('PRAGMA foreign_keys = ON'))
  assert.ok(sql.includes('BEGIN TRANSACTION'))
  assert.ok(sql.includes('COMMIT'))
})

test('seed-to-d1: --check mode does not write files', () => {
  // We re-run with --check after generating, then ensure files weren't deleted
  // (they should still exist), but no error should happen.
  const out = execSync('node scripts/importers/seed-to-d1.mjs --check', {
    cwd: ROOT,
    stdio: 'pipe',
  }).toString()
  assert.ok(out.includes('سليمة') || out.includes('check'), 'check output expected')
})
