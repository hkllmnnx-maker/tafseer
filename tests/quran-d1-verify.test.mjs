// =============================================================================
// quran-d1-verify.test.mjs — اختبارات سكربت verify-quran-d1
// =============================================================================
// نختبر هنا فقط الجوانب التي لا تحتاج Cloudflare/D1 فعليًا:
//   1) أن السكربت يعمل في --dry-run بنجاح (exit 0).
//   2) أن --json --dry-run يخرج JSON صالحًا بحقول متوقعة.
//   3) أن الأوامر المطبوعة تشمل COUNT(*) FROM ayahs.
//   4) أن الأوامر تشمل فحص الآيات المرجعية 1:1 و 2:255 و 114:6.
//   5) أن الحقل expectedAyahs = 6236 و expectedSurahs = 114.
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const SCRIPT     = path.join(ROOT, 'scripts/importers/verify-quran-d1.mjs')

function run(args = []) {
  return spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
  })
}

test('verify-quran-d1: --dry-run runs successfully (exit 0)', () => {
  const r = run(['--dry-run'])
  assert.equal(r.status, 0, 'expected exit 0 in dry-run mode')
  assert.ok(r.stdout && r.stdout.length > 0, 'expected some stdout output')
})

test('verify-quran-d1: --json --dry-run outputs valid JSON', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  let parsed
  try {
    parsed = JSON.parse(r.stdout)
  } catch (e) {
    assert.fail('expected valid JSON output: ' + e.message)
  }
  assert.equal(typeof parsed, 'object')
  assert.equal(parsed.mode, 'dry-run')
  assert.equal(parsed.status, 'dry-run')
  assert.equal(parsed.expectedAyahs, 6236, 'expectedAyahs must be 6236 (full Quran)')
  assert.equal(parsed.expectedSurahs, 114, 'expectedSurahs must be 114')
  assert.ok(Array.isArray(parsed.commands), 'commands must be an array')
  assert.ok(Array.isArray(parsed.checks), 'checks must be an array')
  assert.ok(parsed.databaseName, 'databaseName must be present')
})

test('verify-quran-d1: dry-run commands include COUNT(*) FROM ayahs', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const allCmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(allCmds, /COUNT\(\*\)[\s\S]*FROM ayahs/i,
               'expected COUNT(*) FROM ayahs in commands')
})

test('verify-quran-d1: dry-run commands include reference ayahs 1:1, 2:255, 114:6', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const allCmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(allCmds, /surah_number\s*=\s*1\s+AND\s+ayah_number\s*=\s*1/i,
               'expected check for ayah 1:1 (الفاتحة)')
  assert.match(allCmds, /surah_number\s*=\s*2\s+AND\s+ayah_number\s*=\s*255/i,
               'expected check for ayah 2:255 (آية الكرسي)')
  assert.match(allCmds, /surah_number\s*=\s*114\s+AND\s+ayah_number\s*=\s*6/i,
               'expected check for ayah 114:6 (آخر آية)')
})

test('verify-quran-d1: dry-run commands check duplicates and empty texts', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const cmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(cmds, /HAVING\s+c\s*>\s*1/i, 'expected duplicate check (HAVING c > 1)')
  assert.match(cmds, /TRIM\(text\)/i, 'expected empty text check (TRIM(text))')
  assert.match(cmds, /COUNT\(DISTINCT\s+surah_number\)/i, 'expected surahs covered count')
})

test('verify-quran-d1: dry-run commands include source_name/source_url column probe', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const cmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(cmds, /pragma_table_info\(['"]ayahs['"]\)/i,
               'expected pragma_table_info check for source columns')
  assert.match(cmds, /source_name|source_url/i, 'expected mention of source columns')
})

test('verify-quran-d1: dry-run output is non-destructive (status = dry-run)', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.status, 'dry-run')
  assert.match(parsed.nextStep || '', /without --dry-run/i)
})

test('verify-quran-d1: text output contains expected sections in dry-run', () => {
  const r = run(['--dry-run'])
  assert.equal(r.status, 0)
  // اختبار نص الإخراج العربي وأهم العلامات
  assert.match(r.stdout, /verify-quran-d1/i)
  assert.match(r.stdout, /DRY RUN/i)
  assert.match(r.stdout, /6236/, 'expected 6236 (full Quran ayah count) in output')
  assert.match(r.stdout, /114/, 'expected 114 (surah count) in output')
})
