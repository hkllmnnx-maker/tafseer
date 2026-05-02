#!/usr/bin/env node
// =============================================================================
// seed-to-d1.mjs — توليد SQL/JSON من بيانات seed (src/data/*) لاستيرادها إلى D1
// =============================================================================
// يقرأ ملفات TypeScript في src/data/* بطريقة آمنة (regex/extraction)
// ويولّد:
//   - dist/import/seed-data.sql   — تعليمات INSERT جاهزة للتشغيل عبر wrangler
//   - dist/import/seed-data.json  — نسخة JSON موازية للنشر/المعاينة
//
// ميزات الأمان:
//   - يحترم ترتيب الجداول (parent → child) لاحترام FOREIGN KEYs.
//   - يفلت كل القيم النصية (escapeSqlString) عبر تكرار '.
//   - يرفض القيم undefined/null التي يجب أن تكون NOT NULL.
//   - يتحقّق من تطابق sourceType / verificationStatus مع الـ whitelist.
//
// الاستعمال:
//   node scripts/importers/seed-to-d1.mjs           # توليد SQL+JSON
//   node scripts/importers/seed-to-d1.mjs --check   # تحقق فقط، لا توليد
//   npm run export:seed-sql
//
// التشغيل ضد D1:
//   npx wrangler d1 execute tafseer-production --local --file=dist/import/seed-data.sql
//   npx wrangler d1 execute tafseer-production --file=dist/import/seed-data.sql   # production
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '../..')
const SRC_DATA   = path.join(ROOT, 'src/data')
const OUT_DIR    = path.join(ROOT, 'dist/import')
const args       = process.argv.slice(2)
const checkOnly  = args.includes('--check')

const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

const ALLOWED_SOURCE_TYPES = new Set([
  'original-text', 'summary', 'sample', 'review-needed', 'curated',
])
const ALLOWED_VERIFICATION = new Set([
  'verified', 'partially-verified', 'unverified', 'flagged',
])
const ALLOWED_SURAH_TYPES = new Set(['مكية', 'مدنية'])

const errors = []
const warnings = []

// =============== Read TS file as text ===============
function readSrc(name) {
  return fs.readFileSync(path.join(SRC_DATA, name), 'utf8')
}

// =============== Extract array literal { ... } objects ===============
// نستخرج كائنات على شكل { key: value, ... } من نصّ TS بشكل مبسّط لكن دقيق
// لما نحتاجه في seed (لا تعابير معقّدة، لا حسابات).
function extractObjects(src) {
  // ابحث عن أول مصفوفة بعد علامة `=` (لتجنّب `Surah[]` في تعريف النوع)
  const eqIdx = src.indexOf('= [')
  const startBracket = eqIdx !== -1
    ? src.indexOf('[', eqIdx)
    : src.indexOf('[')
  if (startBracket === -1) return []
  // ابحث عن كل { ... } متوازنة على المستوى الأعلى داخل المصفوفة.
  const out = []
  let i = startBracket + 1
  while (i < src.length) {
    // تخطّي مسافات/فواصل/تعليقات
    while (i < src.length && /[\s,]/.test(src[i])) i++
    if (i >= src.length) break
    if (src[i] === ']') break
    if (src.slice(i, i + 2) === '//') {
      const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl + 1; continue
    }
    if (src.slice(i, i + 2) === '/*') {
      const end = src.indexOf('*/', i); i = end === -1 ? src.length : end + 2; continue
    }
    if (src[i] !== '{') { i++; continue }
    // نقرأ كائن متوازن مع احترام النصوص
    const start = i
    let depth = 0, inStr = null, esc = false
    for (; i < src.length; i++) {
      const ch = src[i]
      if (inStr) {
        if (esc) { esc = false; continue }
        if (ch === '\\') { esc = true; continue }
        if (ch === inStr) inStr = null
      } else {
        if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue }
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) { i++; break }
        }
      }
    }
    out.push(src.slice(start, i))
  }
  return out
}

// =============== Parse a TS object literal into a JS object ===============
// مبسّط: ندعم string ('...' أو "...")، numbers، booleans، arrays of strings.
// نتجاهل تعليقات السطر داخل الكائنات.
function parseObject(text) {
  const obj = {}
  // نزيل التعليقات
  let s = text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  // الكائن: ابدأ بعد {  وانتهِ قبل }
  s = s.trim()
  if (s.startsWith('{')) s = s.slice(1)
  if (s.endsWith('}')) s = s.slice(0, -1)
  // نمشي الحقول: key: value (مفصولة بفواصل)
  let i = 0
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++
    if (i >= s.length) break
    // مفتاح: identifier أو سلسلة
    let keyEnd = i
    let key
    if (s[i] === "'" || s[i] === '"') {
      const q = s[i]; i++
      const start = i
      while (i < s.length && s[i] !== q) i++
      key = s.slice(start, i); i++
    } else {
      const start = i
      while (i < s.length && /[A-Za-z0-9_$]/.test(s[i])) i++
      key = s.slice(start, i)
    }
    // ":"
    while (i < s.length && /\s/.test(s[i])) i++
    if (s[i] !== ':') { i++; continue }
    i++
    while (i < s.length && /\s/.test(s[i])) i++
    // قيمة:
    const value = readValue(s, i)
    obj[key] = value.value
    i = value.next
  }
  return obj
}

function readValue(s, i) {
  // string
  if (s[i] === "'" || s[i] === '"' || s[i] === '`') {
    const q = s[i]; i++
    let v = ''
    while (i < s.length) {
      const ch = s[i]
      if (ch === '\\' && i + 1 < s.length) {
        const n = s[i + 1]
        if (n === 'n') v += '\n'
        else if (n === 't') v += '\t'
        else if (n === 'r') v += '\r'
        else v += n
        i += 2; continue
      }
      if (ch === q) { i++; break }
      v += ch; i++
    }
    return { value: v, next: i }
  }
  // array
  if (s[i] === '[') {
    i++
    const arr = []
    while (i < s.length) {
      while (i < s.length && /[\s,]/.test(s[i])) i++
      if (s[i] === ']') { i++; break }
      const v = readValue(s, i); arr.push(v.value); i = v.next
    }
    return { value: arr, next: i }
  }
  // object (nested)
  if (s[i] === '{') {
    let depth = 1, start = i; i++
    let inStr = null, esc = false
    for (; i < s.length; i++) {
      const ch = s[i]
      if (inStr) {
        if (esc) { esc = false; continue }
        if (ch === '\\') { esc = true; continue }
        if (ch === inStr) inStr = null
      } else {
        if (ch === "'" || ch === '"' || ch === '`') inStr = ch
        else if (ch === '{') depth++
        else if (ch === '}') { depth--; if (!depth) { i++; break } }
      }
    }
    return { value: parseObject(s.slice(start, i)), next: i }
  }
  // identifier/number/boolean/null
  const start = i
  while (i < s.length && !/[,\}\]]/.test(s[i])) i++
  const raw = s.slice(start, i).trim()
  if (raw === 'true') return { value: true, next: i }
  if (raw === 'false') return { value: false, next: i }
  if (raw === 'null') return { value: null, next: i }
  if (raw === 'undefined') return { value: undefined, next: i }
  const n = Number(raw)
  if (!Number.isNaN(n) && raw !== '') return { value: n, next: i }
  return { value: raw, next: i }
}

// =============== Parse all data files ===============
function loadAll() {
  const surahs    = extractObjects(readSrc('surahs.ts')).map(parseObject)
  const ayahs     = extractObjects(readSrc('ayahs.ts')).map(parseObject)
  const authors   = extractObjects(readSrc('authors.ts')).map(parseObject)
  const books     = extractObjects(readSrc('books.ts')).map(parseObject)
  const tafseers  = extractObjects(readSrc('tafseers.ts')).map(parseObject)
  // categories: تجاهل ربط ayahRefs المتداخل لأنه ليس له جدول مباشر — نحتفظ بالحقول العلوية فقط
  const categoriesRaw = extractObjects(readSrc('categories.ts'))
  // الكائنات المتداخلة في ayahRefs قد تظهر كعناصر منفصلة — نأخذ فقط ما يحوي حقل name
  const categories = categoriesRaw
    .map(parseObject)
    .filter(c => c && typeof c.name === 'string' && typeof c.id === 'string')
  return { surahs, ayahs, authors, books, tafseers, categories }
}

// =============== Validation ===============
function validate(data) {
  const surahMap = new Map(data.surahs.map(s => [s.number, s]))

  // surahs
  for (const s of data.surahs) {
    if (!s.number || !s.name || !s.nameLatin || !s.ayahCount || !s.type || !s.order) {
      errors.push(`surahs: حقل ناقص في ${JSON.stringify(s).slice(0, 80)}`)
    }
    if (!ALLOWED_SURAH_TYPES.has(s.type)) {
      errors.push(`surahs[${s.number}]: type "${s.type}" غير صحيح`)
    }
  }

  // ayahs
  for (const a of data.ayahs) {
    if (!a.surah || !a.number || !a.text) {
      errors.push(`ayahs: حقل ناقص في ${JSON.stringify(a).slice(0, 80)}`)
      continue
    }
    if (!surahMap.has(a.surah)) errors.push(`ayahs: السورة ${a.surah} غير موجودة`)
  }

  // authors
  const authorIds = new Set()
  for (const a of data.authors) {
    if (!a.id || !a.name || !a.deathYear || !a.century) {
      errors.push(`authors: حقل ناقص في ${JSON.stringify(a).slice(0, 80)}`)
      continue
    }
    if (authorIds.has(a.id)) errors.push(`authors: id مكرّر "${a.id}"`)
    authorIds.add(a.id)
  }

  // books
  const bookIds = new Set()
  for (const b of data.books) {
    if (!b.id || !b.title || !b.authorId) {
      errors.push(`books: حقل ناقص في ${JSON.stringify(b).slice(0, 80)}`)
      continue
    }
    if (bookIds.has(b.id)) errors.push(`books: id مكرّر "${b.id}"`)
    bookIds.add(b.id)
    if (!authorIds.has(b.authorId)) errors.push(`books[${b.id}]: authorId "${b.authorId}" غير موجود`)
  }

  // tafseers
  const tIds = new Set()
  for (const t of data.tafseers) {
    if (!t.id || !t.bookId || !t.surah || !t.ayah || !t.text) {
      errors.push(`tafseers: حقل ناقص في ${JSON.stringify(t).slice(0, 80)}`)
      continue
    }
    if (tIds.has(t.id)) errors.push(`tafseers: id مكرّر "${t.id}"`)
    tIds.add(t.id)
    if (!bookIds.has(t.bookId)) errors.push(`tafseers[${t.id}]: bookId "${t.bookId}" غير موجود`)
    if (!surahMap.has(t.surah)) errors.push(`tafseers[${t.id}]: السورة ${t.surah} غير موجودة`)
    if (t.sourceType && !ALLOWED_SOURCE_TYPES.has(t.sourceType)) {
      errors.push(`tafseers[${t.id}]: sourceType "${t.sourceType}" غير صحيح`)
    }
    if (t.verificationStatus && !ALLOWED_VERIFICATION.has(t.verificationStatus)) {
      errors.push(`tafseers[${t.id}]: verificationStatus "${t.verificationStatus}" غير صحيح`)
    }
  }

  // categories
  for (const c of data.categories) {
    if (!c.id || !c.name) {
      warnings.push(`categories: حقل ناقص في ${JSON.stringify(c).slice(0, 80)}`)
    }
  }
}

// =============== SQL escaping ===============
function sqlString(v) {
  if (v === undefined || v === null) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}
function sqlNum(v) {
  if (v === undefined || v === null || v === '') return 'NULL'
  const n = Number(v)
  if (!Number.isFinite(n)) return 'NULL'
  return String(n)
}
function sqlBool(v) {
  return v ? '1' : '0'
}
function sqlJsonArray(arr) {
  if (!Array.isArray(arr)) return 'NULL'
  // JSON.stringify يعطي ASCII آمنًا، ثم نُفلت الـ '
  const s = JSON.stringify(arr)
  return `'${s.replace(/'/g, "''")}'`
}

// =============== Build SQL ===============
function buildSql(data) {
  const lines = []
  lines.push('-- =========================================================================')
  lines.push('-- seed-data.sql — تم توليده تلقائيًا من src/data/* عبر')
  lines.push('-- scripts/importers/seed-to-d1.mjs')
  lines.push('-- التاريخ: ' + new Date().toISOString())
  lines.push('-- لا تُحرّر هذا الملف يدويًا — أعِد توليده عبر `npm run export:seed-sql`')
  lines.push('-- =========================================================================')
  lines.push('')
  lines.push('PRAGMA foreign_keys = ON;')
  lines.push('BEGIN TRANSACTION;')
  lines.push('')

  // 1) surahs
  lines.push('-- ===== surahs =====')
  for (const s of data.surahs) {
    lines.push(
      `INSERT OR REPLACE INTO surahs (number, name, name_latin, ayah_count, type, revelation_order) VALUES ` +
      `(${sqlNum(s.number)}, ${sqlString(s.name)}, ${sqlString(s.nameLatin)}, ${sqlNum(s.ayahCount)}, ${sqlString(s.type)}, ${sqlNum(s.order)});`
    )
  }

  // 2) authors (parent for books)
  lines.push('')
  lines.push('-- ===== authors =====')
  for (const a of data.authors) {
    const schools = a.school ? [a.school] : []
    lines.push(
      `INSERT OR REPLACE INTO authors (id, name, full_name, birth_year, death_year, century, biography, schools, popularity) VALUES ` +
      `(${sqlString(a.id)}, ${sqlString(a.name)}, ${sqlString(a.fullName || a.name)}, ${sqlNum(a.birthYear)}, ${sqlNum(a.deathYear)}, ${sqlNum(a.century)}, ${sqlString(a.bio || '')}, ${sqlJsonArray(schools)}, 5);`
    )
  }

  // 3) tafsir_books
  lines.push('')
  lines.push('-- ===== tafsir_books =====')
  for (const b of data.books) {
    lines.push(
      `INSERT OR REPLACE INTO tafsir_books (id, title, full_title, author_id, schools, volumes, description, published_year, edition, popularity, featured) VALUES ` +
      `(${sqlString(b.id)}, ${sqlString(b.title)}, ${sqlString(b.fullTitle || b.title)}, ${sqlString(b.authorId)}, ${sqlJsonArray(b.schools || [])}, ${sqlNum(b.volumes)}, ${sqlString(b.description || '')}, ${sqlNum(b.publishedYear)}, ${sqlString(b.edition)}, ${sqlNum(b.popularity || 5)}, ${sqlBool(b.featured)});`
    )
  }

  // 4) ayahs
  lines.push('')
  lines.push('-- ===== ayahs =====')
  for (const a of data.ayahs) {
    lines.push(
      `INSERT OR REPLACE INTO ayahs (surah_number, ayah_number, text, juz, page) VALUES ` +
      `(${sqlNum(a.surah)}, ${sqlNum(a.number)}, ${sqlString(a.text)}, ${sqlNum(a.juz)}, ${sqlNum(a.page)});`
    )
  }

  // 5) categories
  lines.push('')
  lines.push('-- ===== categories =====')
  for (const c of data.categories) {
    lines.push(
      `INSERT OR REPLACE INTO categories (id, name, description, icon, color, parent_id, sort_order) VALUES ` +
      `(${sqlString(c.id)}, ${sqlString(c.name)}, ${sqlString(c.description || '')}, ${sqlString(c.icon || '')}, NULL, NULL, 0);`
    )
  }

  // 6) tafsir_entries — last (depends on books, authors, surahs)
  lines.push('')
  lines.push('-- ===== tafsir_entries =====')
  // build authorId lookup from books
  const authorByBook = new Map(data.books.map(b => [b.id, b.authorId]))
  for (const t of data.tafseers) {
    const sourceType = t.sourceType || 'sample'
    const verification = t.verificationStatus || 'unverified'
    const authorId = authorByBook.get(t.bookId) || ''
    const isOriginal = sourceType === 'original-text' || !!t.isOriginalText
    const isSample = !!t.isSample || sourceType === 'sample'
    lines.push(
      `INSERT OR REPLACE INTO tafsir_entries ` +
      `(id, book_id, author_id, surah_number, ayah_number, text, source_type, verification_status, is_original_text, source_name, edition, volume, page, source_url, reviewer_note, is_sample, imported_from, imported_at) VALUES ` +
      `(${sqlString(t.id)}, ${sqlString(t.bookId)}, ${sqlString(authorId)}, ${sqlNum(t.surah)}, ${sqlNum(t.ayah)}, ${sqlString(t.text)}, ${sqlString(sourceType)}, ${sqlString(verification)}, ${sqlBool(isOriginal)}, ${sqlString(t.sourceName || t.source)}, ${sqlString(t.edition)}, ${sqlNum(t.volume)}, ${sqlNum(t.page)}, ${sqlString(t.sourceUrl)}, ${sqlString(t.reviewerNote)}, ${sqlBool(isSample)}, ${sqlString('seed-to-d1.mjs')}, ${sqlString(new Date().toISOString())});`
    )
  }

  lines.push('')
  lines.push('COMMIT;')
  lines.push('')
  lines.push('-- إذا تم تطبيق ترحيل FTS5 (0002)، يمكن إعادة بناء الفهرس بعد الاستيراد:')
  lines.push("-- INSERT INTO tafsir_entries_fts(tafsir_entries_fts) VALUES('rebuild');")
  lines.push('')
  return lines.join('\n')
}

// =============== Build JSON ===============
function buildJson(data) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    counts: {
      surahs:    data.surahs.length,
      ayahs:     data.ayahs.length,
      authors:   data.authors.length,
      books:     data.books.length,
      tafseers:  data.tafseers.length,
      categories: data.categories.length,
    },
    surahs:     data.surahs,
    ayahs:      data.ayahs,
    authors:    data.authors,
    books:      data.books,
    categories: data.categories,
    tafseers:   data.tafseers,
  }, null, 2)
}

// =============== Main ===============
function main() {
  console.log(c.bold(c.blue('▶ seed-to-d1: قراءة بيانات seed...')))
  const data = loadAll()
  console.log(`  السور:     ${data.surahs.length}`)
  console.log(`  الآيات:    ${data.ayahs.length}`)
  console.log(`  المؤلفون:  ${data.authors.length}`)
  console.log(`  الكتب:     ${data.books.length}`)
  console.log(`  التفاسير:  ${data.tafseers.length}`)
  console.log(`  الموضوعات: ${data.categories.length}`)
  console.log('')

  console.log(c.bold(c.blue('▶ التحقق من سلامة البيانات...')))
  validate(data)
  if (errors.length) {
    console.log(c.red(`✗ ${errors.length} أخطاء:`))
    for (const e of errors.slice(0, 30)) console.log('  - ' + e)
    process.exit(1)
  }
  if (warnings.length) {
    console.log(c.yellow(`⚠ ${warnings.length} تحذيرات:`))
    for (const w of warnings.slice(0, 10)) console.log('  - ' + w)
  }
  console.log(c.green('✓ كل البيانات سليمة.'))
  console.log('')

  if (checkOnly) {
    console.log(c.dim('--check: تخطّي التوليد.'))
    return
  }

  console.log(c.bold(c.blue('▶ توليد SQL/JSON...')))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const sql = buildSql(data)
  const json = buildJson(data)

  // أمان إضافي: تأكّد أن الناتج لا يحتوي 'undefined' أو 'NaN' كقيم نصية
  const dangerSql = sql.match(/\b(undefined|NaN)\b/g)
  if (dangerSql) {
    console.log(c.red(`✗ تم اكتشاف قيم خطرة في SQL: ${dangerSql.length} مرة (undefined/NaN)`))
    process.exit(1)
  }

  fs.writeFileSync(path.join(OUT_DIR, 'seed-data.sql'), sql, 'utf8')
  fs.writeFileSync(path.join(OUT_DIR, 'seed-data.json'), json, 'utf8')

  const sqlSize  = (Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1)
  const jsonSize = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)
  console.log(c.green(`✓ ${path.relative(ROOT, path.join(OUT_DIR, 'seed-data.sql'))}  (${sqlSize} KB)`))
  console.log(c.green(`✓ ${path.relative(ROOT, path.join(OUT_DIR, 'seed-data.json'))} (${jsonSize} KB)`))
  console.log('')
  console.log(c.dim('للتشغيل ضد D1 محليًا:'))
  console.log(c.dim('  npx wrangler d1 execute tafseer-production --local --file=dist/import/seed-data.sql'))
}

try { main() } catch (e) {
  console.error(c.red('✗ فشل التوليد: ' + (e && e.message ? e.message : e)))
  process.exit(2)
}
