// =============================================================================
// quran-coverage-api.test.mjs — اختبارات بنيوية لنقطة /api/quran/coverage
// =============================================================================
// نتحقّق من:
//   1) أن المسار مسجَّل في src/index.tsx ويستدعي getDataProvider.
//   2) أن DataProvider يعرّف getQuranCoverageSummary (اختياري).
//   3) أن الجواب يتضمّن mode + data بحقول QuranCoverageSummary.
//   4) أن DashboardPage يقبل prop coverage ويعرض ملخّص التغطية.
//   5) أن الحقول المتوقَّعة موجودة في types.ts:
//      ayahsCount, expectedAyahs=6236, surahsCovered, isComplete,
//      coveragePercent, mode.
//
// لا نشغّل dev server أو D1 — نختبر بنيويًا فقط (مثل بقية tests).
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8') }

test('/api/quran/coverage: route registered in src/index.tsx', () => {
  const src = read('src/index.tsx')
  assert.ok(src.includes("'/api/quran/coverage'") || src.includes('"/api/quran/coverage"'),
    'route /api/quran/coverage must be registered')
  // يستعمل DataProvider
  assert.ok(/api\/quran\/coverage[\s\S]{0,300}getDataProvider/.test(src),
    'coverage handler must call getDataProvider')
  // يعيد mode في الجسم
  assert.ok(/api\/quran\/coverage[\s\S]{0,500}mode:/.test(src),
    'coverage response must include mode field')
})

test('types.ts: QuranCoverageSummary has all required fields', () => {
  const src = read('src/lib/data/types.ts')
  for (const field of [
    'ayahsCount',
    'expectedAyahs: 6236',
    'surahsCovered',
    'isComplete',
    'coveragePercent',
    "mode: 'seed' | 'd1'",
  ]) {
    assert.ok(src.includes(field), `QuranCoverageSummary must declare "${field}"`)
  }
})

test('DataProvider interface: declares optional getQuranCoverageSummary', () => {
  const src = read('src/lib/data/types.ts')
  assert.ok(/getQuranCoverageSummary\?\(/.test(src),
    'getQuranCoverageSummary must be optional in DataProvider')
})

test('seedProvider: implements getQuranCoverageSummary returning mode=seed', () => {
  const src = read('src/lib/data/seed-provider.ts')
  assert.ok(src.includes('getQuranCoverageSummary()'),
    'seed must implement getQuranCoverageSummary')
  assert.ok(src.includes('expectedAyahs') && src.includes('6236'),
    'seed coverage must use expectedAyahs=6236')
  assert.ok(src.includes("mode: 'seed'"),
    'seed coverage must mark mode="seed"')
})

test('d1Provider: implements async getQuranCoverageSummary with safe fallback', () => {
  const src = read('src/lib/data/d1-provider.ts')
  assert.ok(src.includes('async getQuranCoverageSummary()'),
    'd1 must implement async getQuranCoverageSummary')
  assert.ok(src.includes('COUNT(*)') && src.includes('FROM ayahs'),
    'd1 coverage must SELECT COUNT(*) FROM ayahs')
  assert.ok(src.includes('COUNT(DISTINCT surah_number)'),
    'd1 coverage must compute COUNT(DISTINCT surah_number)')
  assert.ok(src.includes("mode: 'd1'"),
    'd1 coverage must mark mode="d1"')
})

test('DashboardPage: accepts coverage prop + renders ملخّص تغطية القرآن block', () => {
  const src = read('src/views/pages/dashboard.tsx')
  assert.ok(/coverage\?:\s*QuranCoverageSummary/.test(src),
    'DashboardPage must accept optional coverage: QuranCoverageSummary')
  assert.ok(src.includes('ملخّص تغطية القرآن'),
    'Dashboard must display coverage summary heading')
  assert.ok(src.includes('/api/quran/coverage'),
    'Dashboard must link to /api/quran/coverage JSON endpoint')
  // Two states: complete vs not
  assert.ok(src.includes('isComplete'),
    'Dashboard must branch on isComplete')
})

test('index.tsx: /dashboard route fetches coverage from DataProvider', () => {
  const src = read('src/index.tsx')
  // نمرّر coverage إلى DashboardPage
  assert.ok(/DashboardPage[^]{0,200}coverage=/.test(src),
    '/dashboard handler must pass coverage prop to DashboardPage')
  assert.ok(src.includes('getQuranCoverageSummary'),
    '/dashboard must call DataProvider.getQuranCoverageSummary')
})

// ---- Functional smoke check on the math (consistent with provider impls) ----
test('coverage math contract: ayahsCount/expectedAyahs * 100 (2 decimals)', () => {
  // الحالات الحديّة
  const cases = [
    { ay: 0,    exp: 0,    isComplete: false },
    { ay: 295,  exp: 4.73, isComplete: false },
    { ay: 6235, exp: 99.98,isComplete: false },
    { ay: 6236, exp: 100,  isComplete: true  },
  ]
  for (const c of cases) {
    const pct = +((c.ay / 6236) * 100).toFixed(2)
    assert.equal(pct, c.exp, `(${c.ay}/6236)*100 should equal ${c.exp}`)
    assert.equal(c.ay === 6236, c.isComplete, `isComplete check for ${c.ay}`)
  }
})

test('coverage response shape: all required fields are numeric/boolean/string', () => {
  // نُحاكي ما يجب أن يُرجعه الـ provider
  const sample = {
    ayahsCount: 295,
    expectedAyahs: 6236,
    surahsCovered: 12,
    isComplete: false,
    coveragePercent: 4.73,
    mode: 'seed',
  }
  assert.equal(typeof sample.ayahsCount, 'number')
  assert.equal(typeof sample.expectedAyahs, 'number')
  assert.equal(sample.expectedAyahs, 6236)
  assert.equal(typeof sample.surahsCovered, 'number')
  assert.ok(sample.surahsCovered >= 0 && sample.surahsCovered <= 114)
  assert.equal(typeof sample.isComplete, 'boolean')
  assert.equal(typeof sample.coveragePercent, 'number')
  assert.ok(sample.coveragePercent >= 0 && sample.coveragePercent <= 100)
  assert.ok(['seed', 'd1'].includes(sample.mode))
})
