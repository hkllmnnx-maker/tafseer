// =============================================================================
// quran-d1-verify.test.mjs — اختبارات سكربت verify-quran-d1
// =============================================================================
// نختبر هنا فقط الجوانب التي لا تحتاج Cloudflare/D1 فعليًا:
//   1) أن السكربت يعمل في --dry-run بنجاح (exit 0).
//   2) أن --json --dry-run يخرج JSON صالحًا بحقول متوقعة.
//   3) أن الأوامر المطبوعة تشمل COUNT(*) FROM ayahs.
//   4) أن الأوامر تشمل فحص الآيات المرجعية الـ7: 1:1، 2:255، 18:10، 36:1،
//      67:1، 112:1، 114:6.
//   5) أن الحقل expectedAyahs = 6236 و expectedSurahs = 114.
//   6) أن --strict --dry-run يضيف فحوصات source_name/source_url.
//   7) أن --database <name> يحلّ محلّ wrangler.jsonc في dry-run.
//   8) أن الأعمدة المتوقّعة من migration 0003 تذكر صراحةً.
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
  assert.ok(Array.isArray(parsed.referenceAyahsList), 'referenceAyahsList must be present')
  assert.ok(Array.isArray(parsed.requiredSourceColumns), 'requiredSourceColumns must be present')
})

test('verify-quran-d1: dry-run commands include COUNT(*) FROM ayahs', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const allCmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(allCmds, /COUNT\(\*\)[\s\S]*FROM ayahs/i,
               'expected COUNT(*) FROM ayahs in commands')
})

test('verify-quran-d1: dry-run commands include all 7 reference ayahs', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const allCmds = parsed.commands.map(c => c.cmd).join('\n')
  // الآيات السبع المطلوبة
  const required = [
    [1, 1], [2, 255], [18, 10], [36, 1], [67, 1], [112, 1], [114, 6],
  ]
  for (const [s, a] of required) {
    const re = new RegExp(`surah_number\\s*=\\s*${s}\\s+AND\\s+ayah_number\\s*=\\s*${a}`, 'i')
    assert.match(allCmds, re, `expected check for ayah ${s}:${a}`)
  }
  // والقائمة الموسومة في التقرير
  assert.deepEqual(parsed.referenceAyahsList,
                   ['1:1', '2:255', '18:10', '36:1', '67:1', '112:1', '114:6'],
                   'referenceAyahsList must list all 7 in order')
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

test('verify-quran-d1: dry-run commands probe all 5 source columns from migration 0003', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const cmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(cmds, /pragma_table_info\(['"]ayahs['"]\)/i,
               'expected pragma_table_info check for source columns')
  // كل الأعمدة الـ5 يجب أن تذكر في الفحص
  for (const col of ['source_name', 'source_url', 'edition', 'imported_from', 'imported_at']) {
    assert.match(cmds, new RegExp(col, 'i'),
                 `expected source column "${col}" in pragma probe`)
  }
  assert.deepEqual(parsed.requiredSourceColumns,
                   ['source_name', 'source_url', 'edition', 'imported_from', 'imported_at'],
                   'requiredSourceColumns must enumerate all 5 columns')
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

// ============== --strict tests ==============
test('verify-quran-d1: --strict --dry-run mentions source_name and source_url enforcement', () => {
  const r = run(['--dry-run', '--strict'])
  assert.equal(r.status, 0)
  // النص يجب أن يذكر source_name و source_url صراحةً في وضع strict
  assert.match(r.stdout, /strict/i, 'expected mention of strict mode')
  assert.match(r.stdout, /source_name/i, 'expected source_name in strict output')
  assert.match(r.stdout, /source_url/i, 'expected source_url in strict output')
})

test('verify-quran-d1: --strict --dry-run --json includes strict source check command', () => {
  const r = run(['--dry-run', '--strict', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.strict, true, 'strict flag should be true in report')
  // يجب وجود أمر فحص missingSourceStrict
  const strictCmd = parsed.commands.find(c => c.key === 'missingSourceStrict')
  assert.ok(strictCmd, 'expected missingSourceStrict command in strict mode')
  assert.match(strictCmd.cmd, /source_name IS NULL OR.*source_name.*=.*''/i,
               'strict cmd must check empty source_name')
  assert.match(strictCmd.cmd, /source_url IS NULL/i,
               'strict cmd must check NULL source_url')
  // ويجب وجود check يذكر strict
  const strictCheck = parsed.checks.find(c => /strict/i.test(c.name || ''))
  assert.ok(strictCheck, 'expected at least one strict-related check entry')
})

test('verify-quran-d1: without --strict, missingSourceStrict command is NOT included', () => {
  const r = run(['--dry-run', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.strict, false)
  const strictCmd = parsed.commands.find(c => c.key === 'missingSourceStrict')
  assert.ok(!strictCmd, 'missingSourceStrict must be absent without --strict')
})

// ============== --database tests ==============
test('verify-quran-d1: --database <name> overrides databaseName in dry-run', () => {
  const r = run(['--dry-run', '--database', 'my-test-db', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  assert.equal(parsed.databaseName, 'my-test-db',
               '--database value must replace wrangler.jsonc database_name')
  // والأوامر يجب أن تستخدم الاسم الجديد
  const cmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(cmds, /my-test-db/, 'wrangler commands must use the custom db name')
  // ولا تذكر tafseer-production في الأوامر (نريد التأكد أن الاستبدال كامل)
  assert.ok(!/tafseer-production/.test(cmds),
            'commands must NOT mention default db name when --database is given')
})

test('verify-quran-d1: --local flag sets local mode in commands', () => {
  const r = run(['--dry-run', '--local', '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.stdout)
  const cmds = parsed.commands.map(c => c.cmd).join('\n')
  assert.match(cmds, /--local/, 'commands must include --local flag')
  assert.ok(!/--remote/.test(cmds), 'commands must NOT include --remote when --local')
})
