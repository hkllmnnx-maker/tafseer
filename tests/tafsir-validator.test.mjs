// =============================================================================
// tafsir-validator.test.mjs — اختبارات سكربت validate-tafsir-json.mjs
// =============================================================================
// تتحقّق هذه الاختبارات من:
//   1) العيّنة الصالحة في fixtures/import-samples/tafsir-valid-sample.json
//      تنجح في وضع --dry-run وفي --strict.
//   2) العيّنة الفاسدة في fixtures/import-samples/tafsir-invalid-sample.json
//      تفشل (exit 1) ويلتقط الـ validator أنواع الأخطاء المتوقَّعة كلَّها:
//      ترخيص فارغ، sourceUrl غير https، original-text بلا مصدر، تناقض
//      isOriginalText/sourceType، surah/ayah خارج النطاق، text فارغ، literal
//      "undefined"، sourceType غير معتمد، verificationStatus غير معتمد، id مكرّر.
//   3) وضع --json يُخرج JSON صالحًا.
//   4) السكربت يرفض ملفًا غير موجود برسالة واضحة.
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

const SCRIPT     = path.join(ROOT, 'scripts/importers/validate-tafsir-json.mjs')
const VALID_FIX  = path.join(ROOT, 'fixtures/import-samples/tafsir-valid-sample.json')
const INVALID_FIX = path.join(ROOT, 'fixtures/import-samples/tafsir-invalid-sample.json')

function run(args = []) {
  const r = spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }
}

// -------- 0) Sanity: ملفات الـ fixtures موجودة --------
test('fixtures: tafsir-valid-sample.json موجود وصالح JSON', () => {
  assert.ok(fs.existsSync(VALID_FIX), 'tafsir-valid-sample.json غير موجود')
  const text = fs.readFileSync(VALID_FIX, 'utf8')
  const doc = JSON.parse(text)
  assert.ok(doc.book && doc.author && Array.isArray(doc.entries),
    'يجب أن يحتوي book + author + entries[]')
  assert.ok(doc.entries.length >= 5, 'يجب أن يحتوي 5 إدخالات على الأقل')
})

test('fixtures: tafsir-invalid-sample.json موجود وصالح JSON', () => {
  assert.ok(fs.existsSync(INVALID_FIX), 'tafsir-invalid-sample.json غير موجود')
  const doc = JSON.parse(fs.readFileSync(INVALID_FIX, 'utf8'))
  assert.ok(Array.isArray(doc.entries) && doc.entries.length > 0,
    'يجب أن يحتوي entries[]')
})

// -------- 1) Valid sample passes --------
test('valid sample: dry-run يخرج بـ exit code 0', () => {
  const r = run([VALID_FIX, '--dry-run'])
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /كل الإدخالات صالحة|✓/u)
})

test('valid sample: --strict يخرج بـ exit code 0', () => {
  const r = run([VALID_FIX, '--strict'])
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}\nstdout: ${r.stdout}`)
})

test('valid sample: يطبع توزيع sourceType و verificationStatus', () => {
  const r = run([VALID_FIX, '--dry-run'])
  assert.match(r.stdout, /original-text/)
  assert.match(r.stdout, /summary/)
  assert.match(r.stdout, /verified/)
})

// -------- 2) Invalid sample fails with specific errors --------
test('invalid sample: --dry-run يخرج بـ exit code 1', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.equal(r.code, 1, `expected exit 1, got ${r.code}`)
  assert.match(r.stdout, /فشل التحقّق|✖/u)
})

test('invalid sample: يلتقط book.license مفقود', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /book\.license مفقود|توثيق الترخيص إلزامي/u,
    'expected error about missing license')
})

test('invalid sample: يلتقط sourceUrl غير https', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /sourceUrl يجب أن يبدأ بـ https/u,
    'expected error about non-https sourceUrl')
})

test('invalid sample: يلتقط original-text بلا sourceName', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /sourceType='original-text' يتطلّب sourceName/u,
    'expected error: original-text without sourceName')
})

test('invalid sample: يلتقط original-text بلا edition/page/volume', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /يتطلّب edition أو page أو volume/u,
    'expected error: original-text without locator')
})

test('invalid sample: يلتقط تناقض isOriginalText vs sourceType', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /isOriginalText.*تناقض|تناقض/u,
    'expected error about isOriginalText/sourceType mismatch')
})

test('invalid sample: يلتقط surah خارج النطاق 1..114', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /surah غير صالح|integer 1\.\.114/u,
    'expected error about surah range')
})

test('invalid sample: يلتقط ayah > ayahCount[surah]', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /ayah=99 يتجاوز عدد آيات السورة 1/u,
    'expected error about ayah exceeding surah ayah count')
})

test('invalid sample: يلتقط text فارغ', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /text فارغ/u,
    'expected error about empty text')
})

test('invalid sample: يلتقط literal "undefined" في text', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /text يحوي حرفيًا الكلمة "undefined"/u,
    'expected error about literal undefined in text')
})

test('invalid sample: يلتقط sourceType غير معتمد', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /sourceType غير صالح/u,
    'expected error about invalid sourceType')
})

test('invalid sample: يلتقط verificationStatus غير معتمد', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /verificationStatus غير صالح/u,
    'expected error about invalid verificationStatus')
})

test('invalid sample: يلتقط id مكرَّر', () => {
  const r = run([INVALID_FIX, '--dry-run'])
  assert.match(r.stdout, /id مكرَّر/u,
    'expected error about duplicate id')
})

test('invalid sample: --strict يفشل أيضًا (exit 1)', () => {
  const r = run([INVALID_FIX, '--strict'])
  assert.equal(r.code, 1, `expected exit 1 in strict, got ${r.code}`)
})

// -------- 3) JSON mode --------
test('--json mode: يُخرج JSON صالحًا للعيّنة الصالحة', () => {
  const r = run([VALID_FIX, '--json', '--dry-run'])
  assert.equal(r.code, 0)
  let parsed
  assert.doesNotThrow(() => { parsed = JSON.parse(r.stdout) },
    'output must be valid JSON')
  assert.equal(typeof parsed, 'object')
  assert.equal(parsed.ok, true)
  assert.equal(parsed.dryRun, true)
  assert.ok(parsed.stats, 'must have stats')
  assert.equal(parsed.stats.bookId, 'ibn-kathir')
  assert.equal(parsed.stats.authorId, 'ibn-kathir')
  assert.ok(parsed.stats.acceptedEntries >= 5)
  assert.ok(Array.isArray(parsed.errors))
  assert.equal(parsed.errors.length, 0)
})

test('--json mode: يُخرج JSON صالحًا للعيّنة الفاسدة مع errors[]', () => {
  const r = run([INVALID_FIX, '--json', '--dry-run'])
  assert.equal(r.code, 1)
  let parsed
  assert.doesNotThrow(() => { parsed = JSON.parse(r.stdout) },
    'output must be valid JSON even on failure')
  assert.equal(parsed.ok, false)
  assert.ok(Array.isArray(parsed.errors))
  assert.ok(parsed.errors.length >= 8,
    `expected ≥8 errors, got ${parsed.errors.length}`)
  // أنواع الأخطاء يجب أن تكون موجودة
  const allMsgs = parsed.errors.map(e => e.message).join(' || ')
  assert.match(allMsgs, /license/u)
  assert.match(allMsgs, /https/u)
  assert.match(allMsgs, /sourceName/u)
  assert.match(allMsgs, /surah غير صالح|integer 1\.\.114/u)
  assert.match(allMsgs, /text فارغ/u)
  assert.match(allMsgs, /undefined/u)
})

test('--json mode: يحوي توزيع stats', () => {
  const r = run([VALID_FIX, '--json', '--dry-run'])
  assert.equal(r.code, 0)
  const parsed = JSON.parse(r.stdout)
  assert.ok(parsed.stats.bySourceType)
  assert.ok(parsed.stats.byVerification)
  assert.ok(parsed.stats.bySurah)
  assert.ok(parsed.stats.bySourceType['original-text'] >= 1)
  assert.ok(parsed.stats.bySourceType['summary'] >= 1)
})

// -------- 4) Error handling --------
test('ملف غير موجود: يخرج بـ exit 1 مع رسالة خطأ', () => {
  const r = run(['/tmp/__nonexistent_tafsir_file__.json', '--dry-run'])
  assert.equal(r.code, 1)
  assert.match(r.stderr + r.stdout, /غير موجود|not exist|ENOENT/iu)
})

test('بدون أيّ ملف: يخرج بـ exit 1 مع Usage', () => {
  const r = run([])
  assert.equal(r.code, 1)
  assert.match(r.stderr + r.stdout, /Usage|--strict|--dry-run/u)
})

test('JSON غير صالح: يخرج بـ exit 1', () => {
  const tmp = path.join('/tmp', `bad-tafsir-${Date.now()}.json`)
  fs.writeFileSync(tmp, '{ this is: not valid json,, }')
  try {
    const r = run([tmp])
    assert.equal(r.code, 1)
    assert.match(r.stderr + r.stdout, /JSON غير صالح|Unexpected/u)
  } finally {
    fs.unlinkSync(tmp)
  }
})

// -------- 5) Contract / shape checks --------
test('السكربت لا يكتب أيّ ملف (read-only)', () => {
  const beforeFiles = new Set(fs.readdirSync(path.join(ROOT, 'fixtures/import-samples')))
  run([VALID_FIX, '--strict'])
  run([INVALID_FIX, '--strict'])
  const afterFiles = new Set(fs.readdirSync(path.join(ROOT, 'fixtures/import-samples')))
  assert.deepEqual([...afterFiles].sort(), [...beforeFiles].sort(),
    'validate script must not create or delete files')
})

test('السكربت يطبع المسار المطلق للملف في التقرير', () => {
  const r = run([VALID_FIX, '--dry-run'])
  assert.match(r.stdout, /tafsir-valid-sample\.json/)
})
