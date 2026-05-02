// =============================================================================
// tests/data-providers.test.mjs — اختبارات أساسية لمزوّد البيانات
// =============================================================================
// لا نحاول تحميل TS مباشرة (تكلفته عالية على CI). بدلًا من ذلك نختبر
// السلوك الموازي:
//   - seed-data.json (ناتج export:seed-sql) يطابق ما نتوقّعه من seed.
//   - الـ JSON يحتوي البنية المطلوبة (surahs, ayahs, ...).
// هذا يكفي لضمان أن الـ DataProvider seed يبقى متّسقًا مع المُولِّد.
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

function ensureExport() {
  const f = path.join(ROOT, 'dist/import/seed-data.json')
  if (!fs.existsSync(f)) {
    execSync('node scripts/importers/seed-to-d1.mjs', { cwd: ROOT, stdio: 'pipe' })
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}

test('seed JSON: contains expected top-level keys', () => {
  const data = ensureExport()
  for (const k of ['exportedAt', 'counts', 'surahs', 'ayahs', 'authors', 'books', 'categories', 'tafseers']) {
    assert.ok(k in data, `missing key: ${k}`)
  }
})

test('seed JSON: 114 canonical surahs', () => {
  const data = ensureExport()
  assert.equal(data.surahs.length, 114, 'should have 114 surahs')
  assert.equal(data.surahs[0].number, 1)
  assert.equal(data.surahs[0].name, 'الفاتحة')
  assert.equal(data.surahs[113].number, 114)
})

test('seed JSON: every tafseer references an existing book + surah', () => {
  const data = ensureExport()
  const bookIds = new Set(data.books.map(b => b.id))
  const surahNums = new Set(data.surahs.map(s => s.number))
  for (const t of data.tafseers) {
    assert.ok(bookIds.has(t.bookId), `tafseer ${t.id} references unknown book ${t.bookId}`)
    assert.ok(surahNums.has(t.surah), `tafseer ${t.id} references unknown surah ${t.surah}`)
  }
})

test('seed JSON: every book references an existing author', () => {
  const data = ensureExport()
  const authorIds = new Set(data.authors.map(a => a.id))
  for (const b of data.books) {
    assert.ok(authorIds.has(b.authorId), `book ${b.id} references unknown author ${b.authorId}`)
  }
})

test('seed JSON: ayah numbers within surah ayahCount', () => {
  const data = ensureExport()
  const ayahCounts = new Map(data.surahs.map(s => [s.number, s.ayahCount]))
  for (const a of data.ayahs) {
    const max = ayahCounts.get(a.surah)
    assert.ok(max != null, `ayah surah ${a.surah} unknown`)
    assert.ok(a.number >= 1 && a.number <= max,
      `ayah ${a.surah}:${a.number} out of range (max ${max})`)
  }
})

test('seed JSON: source_type values are within whitelist (when defined)', () => {
  const data = ensureExport()
  const allowed = new Set(['original-text', 'summary', 'sample', 'review-needed', 'curated'])
  for (const t of data.tafseers) {
    if (t.sourceType) {
      assert.ok(allowed.has(t.sourceType), `bad sourceType: ${t.sourceType} on ${t.id}`)
    }
  }
})

test('seed JSON: verification_status values are within whitelist (when defined)', () => {
  const data = ensureExport()
  const allowed = new Set(['verified', 'partially-verified', 'unverified', 'flagged'])
  for (const t of data.tafseers) {
    if (t.verificationStatus) {
      assert.ok(allowed.has(t.verificationStatus), `bad verificationStatus: ${t.verificationStatus} on ${t.id}`)
    }
  }
})
