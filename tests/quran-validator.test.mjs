// =============================================================================
// quran-validator.test.mjs — اختبارات لـ scripts/importers/validate-quran-json.mjs
// =============================================================================
// نختبر:
//   - أن العينة الصالحة تُقبل (exit 0).
//   - أن العينة الخاطئة تُرفض (exit 1) مع رسائل دقيقة.
//   - أن ملفًا غير موجود يُخرج بكود 2.
//   - أن JSON غير صالح يُرفض.
//   - أن --strict يفرض حقول source.
//   - أن --full يرفض عددًا أقل من 6236.
//   - أن وضع --json يطبع JSON صالحًا.
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const SCRIPT     = path.join(ROOT, 'scripts/importers/validate-quran-json.mjs')

function run(args, opts = {}) {
  return spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    ...opts,
  })
}

function tmpJson(name, data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qv-'))
  const p = path.join(dir, name)
  fs.writeFileSync(p, JSON.stringify(data))
  return p
}

test('quran-validator: valid sample passes (exit 0)', () => {
  const r = run(['fixtures/import-samples/quran-valid-sample.json', '--dry-run'])
  assert.equal(r.status, 0, r.stderr || r.stdout)
  assert.match(r.stdout, /كل الآيات صالحة/)
})

test('quran-validator: invalid sample fails (exit 1) with diagnostic errors', () => {
  const r = run(['fixtures/import-samples/quran-invalid-sample.json', '--dry-run'])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /مكرّر/)
  assert.match(r.stdout, /لا تحتوي على آية/)
  assert.match(r.stdout, /surah غير صالح/)
  assert.match(r.stdout, /text فارغ/)
  assert.match(r.stdout, /juz غير صالح/)
})

test('quran-validator: missing file → exit 2', () => {
  const r = run(['no-such-file.json'])
  assert.equal(r.status, 2)
})

test('quran-validator: malformed JSON → exit 1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qv-'))
  const p = path.join(dir, 'bad.json')
  fs.writeFileSync(p, '{ not: valid json')
  const r = run([p])
  assert.equal(r.status, 1)
  assert.match(r.stderr + r.stdout, /JSON غير صالح/)
})

test('quran-validator: top-level non-array, non-object → exit 1', () => {
  const p = tmpJson('weird.json', 42)
  const r = run([p])
  assert.equal(r.status, 1)
})

test('quran-validator: accepts plain array of ayahs', () => {
  const p = tmpJson('arr.json', [
    { surah: 1, ayah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
    { surah: 1, ayah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
  ])
  const r = run([p])
  assert.equal(r.status, 0, r.stdout)
})

test('quran-validator: --strict requires source per ayah (or top-level)', () => {
  const p = tmpJson('nosrc.json', {
    ayahs: [{ surah: 1, ayah: 1, text: 'abc' }],
  })
  const r = run([p, '--strict'])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /source مفقود/)
})

test('quran-validator: --strict passes when top-level source provided', () => {
  const p = tmpJson('topsrc.json', {
    source: 'مصحف المدينة',
    sourceUrl: 'https://qurancomplex.gov.sa/',
    ayahs: [{ surah: 1, ayah: 1, text: 'abc' }],
  })
  const r = run([p, '--strict'])
  assert.equal(r.status, 0, r.stdout)
})

test('quran-validator: --full rejects partial count', () => {
  const p = tmpJson('partial.json', {
    ayahs: [{ surah: 1, ayah: 1, text: 'abc' }],
  })
  const r = run([p, '--full'])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /6236/)
})

test('quran-validator: --json emits structured JSON output', () => {
  const r = run(['fixtures/import-samples/quran-valid-sample.json', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.ok, true)
  assert.equal(typeof parsed.totalAyahs, 'number')
  assert.equal(typeof parsed.surahsCovered, 'number')
  assert.ok(Array.isArray(parsed.errors))
  assert.ok(Array.isArray(parsed.warnings))
})

test('quran-validator: --json with invalid sample reports errors array', () => {
  const r = run(['fixtures/import-samples/quran-invalid-sample.json', '--json'])
  assert.equal(r.status, 1)
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.ok, false)
  assert.ok(parsed.errors.length >= 5)
})

test('quran-validator: rejects ayah > surah ayahCount', () => {
  const p = tmpJson('overflow.json', {
    ayahs: [{ surah: 1, ayah: 99, text: 'abc' }], // Al-Fatiha has 7
  })
  const r = run([p])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /لا تحتوي على آية 99/)
})

test('quran-validator: rejects duplicate (surah,ayah) pair', () => {
  const p = tmpJson('dup.json', {
    ayahs: [
      { surah: 2, ayah: 5, text: 'a' },
      { surah: 2, ayah: 5, text: 'b' },
    ],
  })
  const r = run([p])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /مكرّر: 2:5/)
})

test('quran-validator: rejects empty/whitespace-only text', () => {
  const p = tmpJson('empty.json', {
    ayahs: [{ surah: 1, ayah: 1, text: '   ' }],
  })
  const r = run([p])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /text فارغ/)
})

test('quran-validator: rejects out-of-range juz/page', () => {
  const p1 = tmpJson('badjuz.json', {
    ayahs: [{ surah: 1, ayah: 1, text: 'a', juz: 99 }],
  })
  const r1 = run([p1])
  assert.equal(r1.status, 1)
  assert.match(r1.stdout, /juz غير صالح/)

  const p2 = tmpJson('badpage.json', {
    ayahs: [{ surah: 1, ayah: 1, text: 'a', page: 9999 }],
  })
  const r2 = run([p2])
  assert.equal(r2.status, 1)
  assert.match(r2.stdout, /page غير صالح/)
})

test('quran-validator: rejects surah out of [1,114]', () => {
  const p = tmpJson('badsurah.json', {
    ayahs: [{ surah: 200, ayah: 1, text: 'a' }],
  })
  const r = run([p])
  assert.equal(r.status, 1)
  assert.match(r.stdout, /surah غير صالح/)
})
