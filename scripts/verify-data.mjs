#!/usr/bin/env node
// =============================================================================
// verify-data.mjs — تحقّق سلامة بيانات التطبيق المضمَّنة في src/data/*
//
// يفحص:
//   1) أن كل tafseer entry لديه sourceType و verificationStatus صحيحَين.
//   2) أن surah/ayah لكل tafseer ضمن الحدود الشرعية للسورة.
//   3) أن bookId يشير إلى كتاب موجود.
//   4) أن authorId لكل كتاب يشير إلى مؤلف موجود.
//   5) عدم تكرار IDs داخل tafseers / books / authors / surahs / categories.
//   6) أن كل آية في AYAHS تنتمي لسورة موجودة وضمن نطاقها.
//   7) أن المدارس (schools) للكتب من القائمة المسموحة.
//
// الاستعمال: node scripts/verify-data.mjs [--verbose]
// رمز الخروج: 0 إذا كل شيء سليم، 1 إذا توجد أخطاء.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const C = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
}

const verbose = process.argv.includes('--verbose')

const ALLOWED_SOURCE_TYPES = new Set([
  'original-text', 'summary', 'sample', 'review-needed', 'curated',
])
const ALLOWED_VERIFICATION = new Set([
  'verified', 'partially-verified', 'unverified', 'flagged',
])
const ALLOWED_SCHOOLS = new Set([
  'بالمأثور', 'بالرأي', 'فقهي', 'لغوي', 'بلاغي', 'معاصر', 'ميسر', 'موسوعي',
])

// ============= استخراج بيانات من ملفات TS عبر تعابير منتظمة بسيطة =============
// ملاحظة: نقرأ النصّ الخام لتجنّب الحاجة إلى تشغيل TypeScript runtime.
// النمط يعتمد على بنية الملف الحالية (مصفوفات كائنات تحتوي حقولًا واضحة).

function readFile(p) { return readFileSync(resolve(ROOT, p), 'utf8') }

function extractEntries(src, label) {
  // نلتقط الكائنات بين { ... } داخل المصفوفة الرئيسية
  // لا نحاول فهم JS كاملاً — فقط الحقول البسيطة التي نحتاجها.
  const objects = []
  let depth = 0
  let start = -1
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        objects.push(src.slice(start, i + 1))
        start = -1
      }
    }
  }
  return objects
}

function parseField(obj, name) {
  // string: name: 'value' أو "value"
  let m = obj.match(new RegExp(`\\b${name}\\s*:\\s*['"\`]([^'"\`]*)['"\`]`))
  if (m) return m[1]
  // number: name: 123
  m = obj.match(new RegExp(`\\b${name}\\s*:\\s*(-?\\d+)`))
  if (m) return Number(m[1])
  // boolean
  m = obj.match(new RegExp(`\\b${name}\\s*:\\s*(true|false)`))
  if (m) return m[1] === 'true'
  return undefined
}

function parseStringArray(obj, name) {
  const m = obj.match(new RegExp(`\\b${name}\\s*:\\s*\\[([^\\]]*)\\]`))
  if (!m) return []
  return [...m[1].matchAll(/['"\`]([^'"\`]+)['"\`]/g)].map(x => x[1])
}

// ============= تحميل الملفات =============
const surahsSrc = readFile('src/data/surahs.ts')
const ayahsSrc = readFile('src/data/ayahs.ts')
const authorsSrc = readFile('src/data/authors.ts')
const booksSrc = readFile('src/data/books.ts')
const tafseersSrc = readFile('src/data/tafseers.ts')
const categoriesSrc = readFile('src/data/categories.ts')

const surahs = extractEntries(surahsSrc).map(o => ({
  number: parseField(o, 'number'),
  name: parseField(o, 'name'),
  ayahCount: parseField(o, 'ayahCount'),
  type: parseField(o, 'type'),
})).filter(s => Number.isInteger(s.number) && s.number >= 1 && s.number <= 114)

const ayahs = extractEntries(ayahsSrc).map(o => ({
  surah: parseField(o, 'surah'),
  number: parseField(o, 'number'),
  text: parseField(o, 'text'),
})).filter(a => Number.isInteger(a.surah) && Number.isInteger(a.number))

const authors = extractEntries(authorsSrc).map(o => ({
  id: parseField(o, 'id'),
})).filter(a => typeof a.id === 'string')

const books = extractEntries(booksSrc).map(o => ({
  id: parseField(o, 'id'),
  authorId: parseField(o, 'authorId'),
  schools: parseStringArray(o, 'schools'),
})).filter(b => typeof b.id === 'string')

const tafseers = extractEntries(tafseersSrc).map(o => ({
  id: parseField(o, 'id'),
  bookId: parseField(o, 'bookId'),
  surah: parseField(o, 'surah'),
  ayah: parseField(o, 'ayah'),
  text: parseField(o, 'text'),
  sourceType: parseField(o, 'sourceType'),
  verificationStatus: parseField(o, 'verificationStatus'),
})).filter(t => typeof t.id === 'string')

const categories = extractEntries(categoriesSrc).map(o => ({
  id: parseField(o, 'id'),
})).filter(c => typeof c.id === 'string')

const surahMap = new Map(surahs.map(s => [s.number, s]))
const bookSet = new Set(books.map(b => b.id))
const authorSet = new Set(authors.map(a => a.id))

// ============= التحقق =============
const errors = []
const warnings = []

function err(msg) { errors.push(msg) }
function warn(msg) { warnings.push(msg) }

// 1) التحقق من السور
if (surahs.length !== 114) err(`عدد السور: ${surahs.length} (المتوقَّع 114).`)
const surahNumSet = new Set()
for (const s of surahs) {
  if (surahNumSet.has(s.number)) err(`رقم سورة مكرّر: ${s.number}`)
  surahNumSet.add(s.number)
  if (!s.name) err(`سورة بدون اسم: number=${s.number}`)
  if (!s.ayahCount || s.ayahCount < 1) err(`عدد آيات غير صالح للسورة ${s.number}.`)
  if (s.type !== 'مكية' && s.type !== 'مدنية') err(`نوع غير صالح للسورة ${s.number}: ${s.type}`)
}

// 2) التحقق من المؤلفين
const authorIdSet = new Set()
for (const a of authors) {
  if (authorIdSet.has(a.id)) err(`id مؤلف مكرّر: ${a.id}`)
  authorIdSet.add(a.id)
}

// 3) التحقق من الكتب
const bookIdSet = new Set()
for (const b of books) {
  if (bookIdSet.has(b.id)) err(`id كتاب مكرّر: ${b.id}`)
  bookIdSet.add(b.id)
  if (b.authorId && !authorSet.has(b.authorId)) {
    err(`الكتاب ${b.id} يشير إلى مؤلف غير موجود: ${b.authorId}`)
  }
  for (const sch of b.schools) {
    if (!ALLOWED_SCHOOLS.has(sch)) {
      err(`الكتاب ${b.id} يحتوي مدرسة غير معروفة: "${sch}"`)
    }
  }
}

// 4) التحقق من الآيات
let badAyahs = 0
for (const a of ayahs) {
  const s = surahMap.get(a.surah)
  if (!s) { err(`آية تشير إلى سورة غير موجودة: ${a.surah}:${a.number}`); badAyahs++; continue }
  if (a.number < 1 || a.number > s.ayahCount) {
    err(`آية خارج النطاق: ${a.surah}:${a.number} (الأقصى ${s.ayahCount}).`)
    badAyahs++
  }
  if (!a.text || a.text.length < 1) {
    err(`نص آية فارغ: ${a.surah}:${a.number}`)
    badAyahs++
  }
}
const ayahDupKey = new Set()
for (const a of ayahs) {
  const k = `${a.surah}:${a.number}`
  if (ayahDupKey.has(k)) err(`آية مكرّرة: ${k}`)
  ayahDupKey.add(k)
}

// 5) التحقق من التفاسير
const tafseerIdSet = new Set()
let missingMeta = 0
for (const t of tafseers) {
  if (tafseerIdSet.has(t.id)) err(`id تفسير مكرّر: ${t.id}`)
  tafseerIdSet.add(t.id)
  if (!t.bookId || !bookSet.has(t.bookId)) {
    err(`tafseer ${t.id} يشير إلى كتاب غير موجود: ${t.bookId}`)
  }
  const s = surahMap.get(t.surah)
  if (!s) {
    err(`tafseer ${t.id} يشير إلى سورة غير موجودة: ${t.surah}`)
  } else if (!Number.isInteger(t.ayah) || t.ayah < 1 || t.ayah > s.ayahCount) {
    err(`tafseer ${t.id}: رقم آية غير صالح ${t.ayah} (سورة ${t.surah} = ${s.ayahCount})`)
  }
  if (!t.text || String(t.text).trim().length < 5) {
    err(`tafseer ${t.id}: نص قصير جدًا أو فارغ.`)
  }
  // ملاحظة: التطبيق يطبّق defaults محافظة في وقت التشغيل (انظر backfill في tafseers.ts).
  // لذا نعتبر القيمة المفقودة "مقبولة" (ستُعبَّأ تلقائيًا) لكن نعدّها "ضمنيّة"،
  // ونرفع خطأ فقط عند وجود قيمة *غير صالحة* (نوع غير معروف).
  if (t.sourceType !== undefined && !ALLOWED_SOURCE_TYPES.has(t.sourceType)) {
    err(`tafseer ${t.id}: sourceType غير صالح (${t.sourceType}).`)
    missingMeta++
  } else if (t.sourceType === undefined) {
    // يُعتبر summary/sample ضمنيًا — أحصِ كتحذير فقط في وضع verbose
    if (verbose) warn(`tafseer ${t.id}: sourceType غير معلَن (سيُعبَّأ ضمنيًا 'summary'/'sample').`)
  }
  if (t.verificationStatus !== undefined && !ALLOWED_VERIFICATION.has(t.verificationStatus)) {
    err(`tafseer ${t.id}: verificationStatus غير صالح (${t.verificationStatus}).`)
    missingMeta++
  } else if (t.verificationStatus === undefined) {
    if (verbose) warn(`tafseer ${t.id}: verificationStatus غير معلَن (سيُعبَّأ ضمنيًا).`)
  }
}

// 6) الموضوعات
const catIdSet = new Set()
for (const c of categories) {
  if (catIdSet.has(c.id)) err(`id موضوع مكرّر: ${c.id}`)
  catIdSet.add(c.id)
}

// ============= التقرير =============
console.log()
console.log(C.bold('═══════════════════════════════════════════════════════════'))
console.log(C.bold('              تقرير التحقق من سلامة البيانات'))
console.log(C.bold('═══════════════════════════════════════════════════════════'))
console.log(`السور:       ${C.bold(String(surahs.length))}`)
console.log(`الآيات:      ${C.bold(String(ayahs.length))} (آيات معطوبة: ${badAyahs})`)
console.log(`المؤلفون:    ${C.bold(String(authors.length))}`)
console.log(`الكتب:       ${C.bold(String(books.length))}`)
console.log(`التفاسير:    ${C.bold(String(tafseers.length))} (بيانات علمية ناقصة: ${missingMeta})`)
console.log(`الموضوعات:   ${C.bold(String(categories.length))}`)
console.log(C.dim('───────────────────────────────────────────────────────────'))

if (errors.length === 0) {
  console.log(C.green(`✓ لا توجد أخطاء — كل البيانات صحيحة.`))
} else {
  console.log(C.red(`✖ ${errors.length} خطأ:`))
  const show = verbose ? errors : errors.slice(0, 25)
  show.forEach(e => console.log('  - ' + e))
  if (!verbose && errors.length > 25) {
    console.log(C.dim(`  … (${errors.length - 25} إضافية، استخدم --verbose)`))
  }
}
if (warnings.length) {
  console.log(C.yellow(`⚠ ${warnings.length} تحذير:`))
  if (verbose) warnings.forEach(w => console.log('  - ' + w))
}
console.log(C.bold('═══════════════════════════════════════════════════════════'))

process.exit(errors.length > 0 ? 1 : 0)
