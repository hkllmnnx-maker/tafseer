#!/usr/bin/env node
// =============================================================================
// d1-smoke-check.mjs — فحص جاهزية D1 بدون الحاجة لأسرار Cloudflare
// =============================================================================
// الهدف:
//   1) التحقق من وجود seed SQL والترحيلات على القرص.
//   2) فحص أن seed-data.sql صالح بنيويًا (يبدأ بـ PRAGMA/BEGIN، ينتهي بـ COMMIT،
//      ولا يحوي literal "undefined"/"NaN").
//   3) طباعة الأوامر الموصَى بها لتشغيل D1 محليًا.
//   4) (اختياري) إن كان wrangler متاحًا و wrangler.jsonc يحتوي d1_databases
//      مفعَّلًا، يحاول تنفيذ استعلام قراءة آمن (`SELECT 1`) على المحلي.
//   5) يحسب nextStep (سلسلة قصيرة) تُخبر المستخدم بأوّل أمر يجب تنفيذه.
//
// لا يكتب أي شيء على القرص. لا يحتاج أسرارًا. لا يفشل CI إذا لم يكن
// wrangler متاحًا أو D1 binding مفعَّلًا — فقط يطبع تقريرًا.
//
// الاستعمال:
//   npm run d1:smoke
//   node scripts/d1-smoke-check.mjs
//   node scripts/d1-smoke-check.mjs --json
//   node scripts/d1-smoke-check.mjs --strict   # يفشل إذا artefacts ناقصة
//   node scripts/d1-smoke-check.mjs --json --strict
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

const args = process.argv.slice(2)
const flagJson   = args.includes('--json')
const flagStrict = args.includes('--strict')

const SEED_SQL  = path.join(ROOT, 'dist/import/seed-data.sql')
const SEED_JSON = path.join(ROOT, 'dist/import/seed-data.json')
const MIG_DIR   = path.join(ROOT, 'db/migrations')
const WRANGLER  = path.join(ROOT, 'wrangler.jsonc')

const report = {
  ok: true,
  checks: [],
  recommendations: [],
  wrangler: { available: false, version: null },
  d1Binding: { configured: false, databaseName: null, hasPlaceholder: false },
  // ملخّص قرار النهاية: ما الأمر التالي الذي يجب أن ينفّذه المستخدم؟
  nextStep: null,
  // تصنيف الحالة بشكل مكينة-قابلة-للقراءة
  status: 'unknown',
}

function add(name, ok, info = '', strictOnly = false) {
  report.checks.push({ name, ok, info, ...(strictOnly ? { strictOnly: true } : {}) })
  // لا نسقط ok إلا إذا كان الفحص جوهريًا (ليس informational/strictOnly)
  if (!ok && !strictOnly) report.ok = false
}

// 1) seed-data.sql exists?
let seedSqlExists = false
if (fs.existsSync(SEED_SQL)) {
  seedSqlExists = true
  const stats = fs.statSync(SEED_SQL)
  add('dist/import/seed-data.sql exists', true, `${(stats.size / 1024).toFixed(1)} KB`)

  // Structural sanity: PRAGMA / BEGIN / COMMIT, no undefined / NaN
  // الملف قد يحتوي تعليقات (-- ...) قبل PRAGMA وبعد COMMIT — نتحقق من
  // وجود الكلمات المفتاحية في أي مكان في الملف، لا من بداية/نهاية الـbytes.
  const sql = fs.readFileSync(SEED_SQL, 'utf8')
  // أزل التعليقات والأسطر الفارغة لمعرفة أول وآخر تعليمة فعلية
  const stmtLines = sql
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('--'))
  const firstStmt = stmtLines[0] || ''
  const lastStmt  = stmtLines[stmtLines.length - 1] || ''
  add('seed.sql first statement is PRAGMA/BEGIN',
      /^(PRAGMA|BEGIN)/i.test(firstStmt),
      firstStmt.slice(0, 80))
  add('seed.sql last statement is COMMIT',
      /^COMMIT\s*;?\s*$/i.test(lastStmt),
      lastStmt.slice(0, 80))
  add('seed.sql free of literal undefined/NaN',
      !/\bundefined\b|\bNaN\b/.test(sql),
      'Defensive check: blocks broken templating output')
} else {
  add('dist/import/seed-data.sql exists', false, 'Run: npm run export:seed-sql')
  report.recommendations.push('npm run export:seed-sql')
  report.nextStep = 'npm run export:seed-sql'
}

// 2) seed-data.json exists?
if (fs.existsSync(SEED_JSON)) {
  const stats = fs.statSync(SEED_JSON)
  add('dist/import/seed-data.json exists', true, `${(stats.size / 1024).toFixed(1)} KB`)
} else {
  add('dist/import/seed-data.json exists', false, 'Run: npm run export:seed-sql')
  if (!report.nextStep) report.nextStep = 'npm run export:seed-sql'
}

// 3) migrations directory
let hasMigrations = false
if (fs.existsSync(MIG_DIR)) {
  const files = fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort()
  hasMigrations = files.length > 0
  add('db/migrations/*.sql present', files.length > 0, files.join(', ') || '(empty)')
  report.migrations = files
} else {
  add('db/migrations directory', false, 'Missing — required for D1 setup')
}

// 4) wrangler.jsonc parsing — تتعامل مع التعليقات JSONC
if (fs.existsSync(WRANGLER)) {
  const raw = fs.readFileSync(WRANGLER, 'utf8')
  // أزل التعليقات لـ JSON.parse (تقريبي وكافٍ لهذا الفحص)
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  let parsed = null
  try { parsed = JSON.parse(stripped) } catch { /* ignore */ }
  add('wrangler.jsonc parseable', !!parsed, parsed ? 'OK' : 'JSONC parse failed (non-fatal)')

  // كشف D1 binding من النص الخام (يلتقط الحالة المعلَّقة كذلك)
  const hasD1Block = /"d1_databases"\s*:\s*\[/.test(raw)
  const isCommentedOut = /\/\/\s*"d1_databases"/m.test(raw)
  const hasPlaceholder = /REPLACE_WITH_REAL_D1_ID/.test(raw)
  report.d1Binding.configured = hasD1Block && !isCommentedOut
  report.d1Binding.hasPlaceholder = hasPlaceholder
  if (parsed && Array.isArray(parsed.d1_databases) && parsed.d1_databases[0]) {
    report.d1Binding.databaseName = parsed.d1_databases[0].database_name || null
  } else {
    // اقرأ database_name حتى لو كانت داخل تعليق — للإرشاد فقط
    const m = raw.match(/"database_name"\s*:\s*"([^"]+)"/)
    if (m) report.d1Binding.databaseName = m[1]
  }
  // ملاحظة: غياب D1 binding النشط ليس فشلًا في الـ smoke check —
  // الـ OSS repo يُسلَّم بالقسم معلَّقًا حتى لا يُسرَّب database_id.
  // نسجِّل هذه الحالة كملاحظة informational فقط.
  if (report.d1Binding.configured) {
    add('D1 binding configured (active)', true,
        `database_name=${report.d1Binding.databaseName || '?'}`)
  } else {
    report.checks.push({
      name: 'D1 binding configured (active)',
      ok: true,
      info: 'commented out (safe default for OSS) — see docs/d1-smoke-test.md',
      informational: true,
    })
  }
} else {
  add('wrangler.jsonc exists', false)
}

// 5) wrangler CLI available?
try {
  const v = spawnSync('npx', ['--no-install', 'wrangler', '--version'], {
    cwd: ROOT, encoding: 'utf8', timeout: 15000,
  })
  if (v.status === 0) {
    report.wrangler.available = true
    report.wrangler.version = (v.stdout || v.stderr || '').trim().split('\n').pop()
    add('wrangler CLI available', true, report.wrangler.version)
  } else {
    add('wrangler CLI available', false, '(non-fatal) install via npm install')
  }
} catch (e) {
  add('wrangler CLI available', false, e.message)
}

// 6) Optional: try a non-destructive read-only check ONLY if D1 binding is active
let liveD1 = null
if (report.wrangler.available && report.d1Binding.configured && report.d1Binding.databaseName) {
  try {
    const r = spawnSync('npx', [
      '--no-install', 'wrangler', 'd1', 'execute',
      report.d1Binding.databaseName, '--local', '--command', 'SELECT 1 AS ok;',
    ], { cwd: ROOT, encoding: 'utf8', timeout: 30000 })
    liveD1 = {
      attempted: true,
      ok: r.status === 0,
      stdout: (r.stdout || '').slice(-200),
      stderr: (r.stderr || '').slice(-200),
    }
    add('D1 local SELECT 1 (read-only)', liveD1.ok,
        liveD1.ok ? 'OK' : 'failed (likely DB not initialized — run db:migrate:local)')
    if (!liveD1.ok && !report.nextStep) {
      report.nextStep = 'npm run db:migrate:local'
    }
  } catch (e) {
    liveD1 = { attempted: true, ok: false, error: e.message }
    add('D1 local SELECT 1 (read-only)', false, e.message)
  }
} else {
  liveD1 = { attempted: false, reason: 'D1 binding not configured (safe default)' }
  report.recommendations.push(
    'To enable D1 locally: see docs/d1-smoke-test.md',
    'npx wrangler d1 create tafseer-production',
    'Paste database_id into wrangler.jsonc (uncomment d1_databases block)',
    'npm run db:migrate:local',
    'npx wrangler d1 execute tafseer-production --local --file=dist/import/seed-data.sql',
  )
}
report.d1LiveCheck = liveD1

// =============================================================================
// Compute final status + nextStep recommendation
// =============================================================================
// status taxonomy:
//   - 'artefacts-missing'     → seed SQL/migrations مفقود (يجب إنشاؤه أوّلاً)
//   - 'binding-disabled'      → كل artefacts جاهزة لكن D1 binding معلَّق
//   - 'binding-active-ok'     → D1 binding نشط واستعلام SELECT 1 نجح
//   - 'binding-active-empty'  → binding نشط لكن DB فارغ/غير مهيّأ
//   - 'wrangler-missing'      → wrangler غير مثبَّت
if (!seedSqlExists || !hasMigrations) {
  report.status = 'artefacts-missing'
  if (!report.nextStep) report.nextStep = 'npm run export:seed-sql'
} else if (!report.wrangler.available) {
  report.status = 'wrangler-missing'
  if (!report.nextStep) report.nextStep = 'npm install'
} else if (!report.d1Binding.configured) {
  report.status = 'binding-disabled'
  if (!report.nextStep) {
    report.nextStep = 'See docs/d1-smoke-test.md to enable D1 locally'
  }
} else if (liveD1 && liveD1.attempted && liveD1.ok) {
  report.status = 'binding-active-ok'
  if (!report.nextStep) {
    report.nextStep = 'npx wrangler d1 execute ' + report.d1Binding.databaseName +
                      ' --local --file=dist/import/seed-data.sql'
  }
} else if (liveD1 && liveD1.attempted && !liveD1.ok) {
  report.status = 'binding-active-empty'
  if (!report.nextStep) report.nextStep = 'npm run db:migrate:local'
} else {
  report.status = 'unknown'
}

// =============================================================================
// Output
// =============================================================================
if (flagJson) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok || !flagStrict ? 0 : 1)
}

console.log()
console.log(c.bold('═══════════════════════════════════════════════════════════'))
console.log(c.bold('              D1 Smoke Check (no secrets needed)'))
console.log(c.bold('═══════════════════════════════════════════════════════════'))
for (const ch of report.checks) {
  const mark = ch.ok ? c.green('✓') : c.red('✗')
  console.log(`  ${mark} ${ch.name}${ch.info ? c.dim('  — ' + ch.info) : ''}`)
}

if (report.recommendations.length) {
  console.log(c.dim('───────────────────────────────────────────────────────────'))
  console.log(c.bold('الأوامر الموصى بها لتشغيل D1 محليًا:'))
  for (const r of report.recommendations) console.log('  ' + c.blue(r))
}

console.log(c.dim('───────────────────────────────────────────────────────────'))
console.log(c.bold('الحالة:        ') + c.yellow(report.status))
if (report.nextStep) {
  console.log(c.bold('الخطوة التالية: ') + c.blue(report.nextStep))
}
console.log(c.dim('───────────────────────────────────────────────────────────'))
if (report.ok) {
  console.log(c.green('✓ artefacts جاهزة. يمكنك تشغيل D1 محليًا باتباع docs/d1-smoke-test.md'))
} else {
  console.log(c.yellow('⚠ بعض الفحوص فشلت — راجع الرسائل أعلاه.'))
}
console.log(c.bold('═══════════════════════════════════════════════════════════'))

// لا نفشل CI افتراضيًا حتى لو لم يكن D1 binding نشطًا (متعمَّد).
// مع --strict نفشل لو فُقدت artefacts الأساسية.
if (flagStrict && !report.ok) process.exit(1)
process.exit(0)
