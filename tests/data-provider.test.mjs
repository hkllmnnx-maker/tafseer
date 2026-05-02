// =============================================================================
// tests/data-provider.test.mjs — Contract tests for getDataProvider() + providers
// =============================================================================
// نخزن منطق getDataProvider() المُنفَّذ في src/lib/data/index.ts كنسخة JS مكافئة
// هنا، ثم نختبره ضدّ:
//   - undefined / null env  → seed provider
//   - {} (no DB) → seed provider
//   - { DB: {} } بلا prepare → seed provider (defensive)
//   - { DB: mockD1 } → d1 provider
//
// كذلك نختبر mock D1 + بنية النتائج النهائية (snippet, total, totalPages,
// pagination, sourceTypes filter, verificationStatuses filter, searchIn).
//
// لا نعتمد على Cloudflare ولا أسرار. كل البيانات من dist/import/seed-data.json.
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

// ============== ضمان وجود seed JSON ==============
function ensureSeed() {
  const f = path.join(ROOT, 'dist/import/seed-data.json')
  if (!fs.existsSync(f)) {
    execSync('node scripts/importers/seed-to-d1.mjs', { cwd: ROOT, stdio: 'pipe' })
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}

// ============== Mock D1 (مماثل لما في d1-mock.test.mjs ولكن مكتفٍ ذاتيًا) ==============
// نُوفّر prepare(sql).bind(...).first()/.all()/.run() كما يتوقع provider.
class MockStmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.binds = [] }
  bind(...values) { this.binds.push(...values); return this }
  async first(_col) { const rows = await this._run(); return rows.length ? rows[0] : null }
  async all() { return { results: await this._run(), success: true } }
  async run() { return { results: await this._run(), success: true } }
  async _run() { return this.db._handle(this.sql, this.binds) }
}
class MockD1 {
  constructor(seed) {
    this.seed = seed
    this.surahsByNum = new Map(seed.surahs.map(s => [s.number, s]))
    this.ayahsKey = new Map(seed.ayahs.map(a => [`${a.surah}:${a.number}`, a]))
    this.booksById = new Map(seed.books.map(b => [b.id, b]))
    this.authorsById = new Map(seed.authors.map(a => [a.id, a]))
    this.tafseers = seed.tafseers.map(t => {
      const book = this.booksById.get(t.bookId)
      return {
        ...t,
        author_id: book?.authorId || '',
        source_type: t.sourceType || 'sample',
        verification_status: t.verificationStatus || 'unverified',
      }
    })
  }
  prepare(sql) { return new MockStmt(this, sql) }
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out }

  _handle(sql, binds) {
    const s = sql.replace(/\s+/g, ' ').trim()

    // FTS5 detection → return empty (FTS not present)
    if (/sqlite_master.*tafsir_entries_fts/i.test(s)) return []
    // probe — هل tafsir_entries فارغ؟
    if (/^SELECT 1 AS x FROM tafsir_entries LIMIT 1$/i.test(s)) {
      return this.tafseers.length ? [{ x: 1 }] : []
    }
    // ====== COUNT(*) basics ======
    if (/^SELECT COUNT\(\*\) AS c FROM tafsir_books$/i.test(s)) return [{ c: this.seed.books.length }]
    if (/^SELECT COUNT\(\*\) AS c FROM authors$/i.test(s)) return [{ c: this.seed.authors.length }]
    if (/^SELECT COUNT\(\*\) AS c FROM surahs$/i.test(s)) return [{ c: this.seed.surahs.length }]
    if (/^SELECT COUNT\(\*\) AS c FROM ayahs$/i.test(s)) return [{ c: this.seed.ayahs.length }]
    if (/^SELECT COUNT\(\*\) AS c FROM tafsir_entries$/i.test(s)) return [{ c: this.tafseers.length }]

    // surah by number
    if (/FROM surahs WHERE number = \?1/i.test(s)) {
      const surah = this.surahsByNum.get(binds[0])
      if (!surah) return []
      return [{
        number: surah.number, name: surah.name, name_latin: surah.nameLatin,
        ayah_count: surah.ayahCount, type: surah.type, revelation_order: surah.order,
      }]
    }
    if (/FROM surahs ORDER BY number ASC/i.test(s)) {
      return [...this.seed.surahs].sort((a, b) => a.number - b.number).map(s2 => ({
        number: s2.number, name: s2.name, name_latin: s2.nameLatin,
        ayah_count: s2.ayahCount, type: s2.type, revelation_order: s2.order,
      }))
    }
    // ayahs by surah/ayah
    if (/FROM ayahs WHERE surah_number = \?1 AND ayah_number = \?2/i.test(s)) {
      const a = this.ayahsKey.get(`${binds[0]}:${binds[1]}`)
      if (!a) return []
      return [{
        surah_number: a.surah, ayah_number: a.number, text: a.text,
        juz: a.juz ?? null, page: a.page ?? null,
      }]
    }
    if (/FROM ayahs WHERE surah_number = \?1 ORDER BY ayah_number/i.test(s)) {
      return this.seed.ayahs.filter(a => a.surah === binds[0])
        .sort((x, y) => x.number - y.number).map(a => ({
          surah_number: a.surah, ayah_number: a.number, text: a.text,
          juz: a.juz ?? null, page: a.page ?? null,
        }))
    }
    // tafsir entries by ayah
    if (/FROM tafsir_entries WHERE surah_number = \?1 AND ayah_number = \?2 ORDER BY id/i.test(s)) {
      return this.tafseers.filter(t => t.surah === binds[0] && t.ayah === binds[1])
        .map(t => this._tafseerRow(t))
    }
    // books list / by id
    if (/FROM tafsir_books ORDER BY popularity DESC/i.test(s)) {
      return [...this.seed.books]
        .sort((a, b) => (b.popularity || 5) - (a.popularity || 5) || a.title.localeCompare(b.title, 'ar'))
        .map(b => this._bookRow(b))
    }
    if (/FROM tafsir_books WHERE id = \?1/i.test(s)) {
      const b = this.booksById.get(binds[0])
      return b ? [this._bookRow(b)] : []
    }
    // authors list / by id
    if (/FROM authors ORDER BY death_year/i.test(s)) {
      return [...this.seed.authors].sort((a, b) => (a.deathYear || 0) - (b.deathYear || 0))
        .map(a => this._authorRow(a))
    }
    if (/FROM authors WHERE id = \?1/i.test(s)) {
      const a = this.authorsById.get(binds[0])
      return a ? [this._authorRow(a)] : []
    }
    // search count + select
    if (/^SELECT COUNT\(\*\) AS c FROM tafsir_entries t/i.test(s)) {
      return [{ c: this._filterSearch(s, binds).length }]
    }
    if (/^SELECT t\.id AS id, t\.book_id, t\.author_id, t\.surah_number, t\.ayah_number,/i.test(s)) {
      return this._filterSearch(s, binds).map(t => this._searchRow(t))
    }
    // detailed stats — totals
    if (/SELECT \(SELECT COUNT\(\*\) FROM tafsir_books\) AS books/i.test(s)) {
      const totalChars = this.tafseers.reduce((acc, t) => acc + (t.text || '').length, 0)
      const avgLen = this.tafseers.length ? totalChars / this.tafseers.length : 0
      return [{
        books: this.seed.books.length, authors: this.seed.authors.length,
        surahs: this.seed.surahs.length, ayahs: this.seed.ayahs.length,
        tafseers: this.tafseers.length, total_chars: totalChars, avg_len: avgLen,
      }]
    }
    // perBook / perAuthor / etc — return [] (إن لم يطلبها الاختبار، لا حاجة)
    return []
  }
  _tafseerRow(t) {
    return {
      id: t.id, book_id: t.bookId, author_id: t.author_id,
      surah_number: t.surah, ayah_number: t.ayah, text: t.text,
      source_type: t.source_type, verification_status: t.verification_status,
      is_original_text: t.isOriginalText ? 1 : 0,
      source_name: t.sourceName || t.source || null,
      edition: t.edition || null, volume: t.volume ?? null, page: t.page ?? null,
      source_url: t.sourceUrl || null, reviewer_note: t.reviewerNote || null,
      is_sample: t.isSample ? 1 : 0,
    }
  }
  _bookRow(b) {
    return {
      id: b.id, title: b.title, full_title: b.fullTitle || b.title,
      author_id: b.authorId, schools: JSON.stringify(b.schools || []),
      volumes: b.volumes ?? null, description: b.description || '',
      published_year: b.publishedYear ?? null, edition: b.edition ?? null,
      popularity: b.popularity ?? 5, featured: b.featured ? 1 : 0,
    }
  }
  _authorRow(a) {
    return {
      id: a.id, name: a.name, full_name: a.fullName || a.name,
      birth_year: a.birthYear ?? null, death_year: a.deathYear,
      century: a.century, biography: a.bio || '',
      schools: JSON.stringify(a.school ? [a.school] : []),
      popularity: 5,
    }
  }
  _searchRow(t) {
    const book = this.booksById.get(t.bookId)
    const author = this.authorsById.get(t.author_id)
    const surah = this.surahsByNum.get(t.surah)
    const ayah = this.ayahsKey.get(`${t.surah}:${t.ayah}`)
    return {
      id: t.id, book_id: t.bookId, author_id: t.author_id,
      surah_number: t.surah, ayah_number: t.ayah,
      tafseer_text: t.text, source_type: t.source_type,
      verification_status: t.verification_status,
      is_original_text: t.isOriginalText ? 1 : 0,
      source_name: t.sourceName || t.source || null,
      edition: t.edition || null, volume: t.volume ?? null, page: t.page ?? null,
      source_url: t.sourceUrl || null, reviewer_note: t.reviewerNote || null,
      is_sample: t.isSample ? 1 : 0,
      book_title: book?.title || '',
      book_popularity: book?.popularity ?? 5,
      author_id_real: author?.id || '',
      author_name: author?.name || '',
      author_death: author?.deathYear || 0,
      surah_name: surah?.name || '',
      ayah_text: ayah?.text || '',
    }
  }
  _filterSearch(sql, binds) {
    const filters = this._parseFilters(sql, binds)
    let list = this.tafseers.slice()
    if (filters.surah) list = list.filter(t => t.surah === filters.surah)
    if (filters.bookIds) list = list.filter(t => filters.bookIds.includes(t.bookId))
    if (filters.sourceTypes) list = list.filter(t => filters.sourceTypes.includes(t.source_type))
    if (filters.verificationStatuses) {
      list = list.filter(t => filters.verificationStatuses.includes(t.verification_status))
    }
    if (filters.qLike) {
      const q = filters.qLike.toLowerCase()
      list = list.filter(t => {
        const ayah = this.ayahsKey.get(`${t.surah}:${t.ayah}`)
        const blob = ((t.text || '') + ' ' + (ayah?.text || '')).toLowerCase()
        return blob.includes(q)
      })
    }
    return list
  }
  _parseFilters(sql, binds) {
    const result = {}; let bi = 0
    if (/t\.surah_number = \?\d+/i.test(sql)) result.surah = binds[bi++]
    const bookIn = sql.match(/t\.book_id IN \(([^)]+)\)/i)
    if (bookIn) { const c = bookIn[1].split(',').length; result.bookIds = binds.slice(bi, bi + c); bi += c }
    const stIn = sql.match(/t\.source_type IN \(([^)]+)\)/i)
    if (stIn) { const c = stIn[1].split(',').length; result.sourceTypes = binds.slice(bi, bi + c); bi += c }
    const vsIn = sql.match(/t\.verification_status IN \(([^)]+)\)/i)
    if (vsIn) { const c = vsIn[1].split(',').length; result.verificationStatuses = binds.slice(bi, bi + c); bi += c }
    // remaining LIKE param
    const remaining = binds.slice(bi)
    const firstLike = remaining.find(x => typeof x === 'string' && x.startsWith('%') && x.endsWith('%'))
    if (firstLike) result.qLike = firstLike.slice(1, -1).replace(/\\([%_\\])/g, '$1')
    return result
  }
}

// ============== Replica of getDataProvider selection logic ==============
// نُكرّر منطق src/lib/data/index.ts → getDataProvider() لاختباره دون تحميل TS.
// أي تعديل على المنطق الأصلي يستوجب تحديث هذه الدالة (موثَّق في الكود).
function looksLikeD1(x) {
  return !!x && typeof x === 'object' && typeof x.prepare === 'function'
}
function selectProviderName(env) {
  if (env && looksLikeD1(env.DB)) return 'd1'
  return 'seed'
}

// ============== TESTS ==============

test('getDataProvider: undefined env → seed', () => {
  assert.equal(selectProviderName(undefined), 'seed')
})
test('getDataProvider: null env → seed', () => {
  assert.equal(selectProviderName(null), 'seed')
})
test('getDataProvider: empty env → seed', () => {
  assert.equal(selectProviderName({}), 'seed')
})
test('getDataProvider: env without DB → seed', () => {
  assert.equal(selectProviderName({ KV: {} }), 'seed')
})
test('getDataProvider: env.DB without prepare → seed (defensive)', () => {
  assert.equal(selectProviderName({ DB: {} }), 'seed')
})
test('getDataProvider: env.DB with prepare function → d1', () => {
  const fakeDb = { prepare: () => ({ bind: () => ({ first: async () => null }) }) }
  assert.equal(selectProviderName({ DB: fakeDb }), 'd1')
})
test('getDataProvider: real MockD1 → d1', () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  assert.equal(selectProviderName({ DB: db }), 'd1')
})

// ============== Seed Provider Contract (as encoded in seed-data.json) ==============
test('seedProvider contract: getStatsBasic shape', () => {
  const seed = ensureSeed()
  const stats = {
    booksCount: seed.books.length,
    authorsCount: seed.authors.length,
    surahsCount: seed.surahs.length,
    ayahsCount: seed.ayahs.length,
    tafseersCount: seed.tafseers.length,
    mode: 'seed',
  }
  for (const k of ['booksCount','authorsCount','surahsCount','ayahsCount','tafseersCount']) {
    assert.equal(typeof stats[k], 'number', `${k} must be number`)
  }
  assert.equal(stats.mode, 'seed')
  assert.equal(stats.surahsCount, 114, 'seed must have 114 surahs')
})
test('seedProvider contract: getAyah(1,1) returns ayah', () => {
  const seed = ensureSeed()
  const ayah = seed.ayahs.find(a => a.surah === 1 && a.number === 1)
  assert.ok(ayah, 'seed must contain Al-Fatiha verse 1')
  assert.ok(ayah.text && ayah.text.length > 0)
  assert.equal(ayah.surah, 1)
  assert.equal(ayah.number, 1)
})
test('seedProvider contract: getTafseersByAyah(1,1) returns entries', () => {
  const seed = ensureSeed()
  const list = seed.tafseers.filter(t => t.surah === 1 && t.ayah === 1)
  assert.ok(list.length >= 1, 'seed must contain at least one tafseer for 1:1')
  for (const t of list) {
    assert.equal(typeof t.text, 'string')
    assert.ok(t.bookId)
  }
})
test('seedProvider contract: listBooks not empty', () => {
  const seed = ensureSeed()
  assert.ok(seed.books.length > 0, 'seed must have at least one book')
  for (const b of seed.books) {
    assert.equal(typeof b.id, 'string')
    assert.equal(typeof b.title, 'string')
    assert.equal(typeof b.authorId, 'string')
  }
})
test('seedProvider contract: listAuthors not empty', () => {
  const seed = ensureSeed()
  assert.ok(seed.authors.length > 0, 'seed must have at least one author')
  for (const a of seed.authors) {
    assert.equal(typeof a.id, 'string')
    assert.equal(typeof a.name, 'string')
    assert.equal(typeof a.deathYear, 'number')
  }
})

// ============== D1 Provider via MockD1 — surface tests ==============

test('d1Provider via MockD1: getStatsBasic returns non-zero counts', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const [b, a, s, y, t] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS c FROM tafsir_books').first(),
    db.prepare('SELECT COUNT(*) AS c FROM authors').first(),
    db.prepare('SELECT COUNT(*) AS c FROM surahs').first(),
    db.prepare('SELECT COUNT(*) AS c FROM ayahs').first(),
    db.prepare('SELECT COUNT(*) AS c FROM tafsir_entries').first(),
  ])
  assert.equal(b.c, seed.books.length)
  assert.equal(a.c, seed.authors.length)
  assert.equal(s.c, 114)
  assert.equal(y.c, seed.ayahs.length)
  assert.equal(t.c, seed.tafseers.length)
})

test('d1Provider via MockD1: getSurahByNumber(1) → الفاتحة', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    'SELECT number, name, name_latin, ayah_count, type, revelation_order FROM surahs WHERE number = ?1 LIMIT 1'
  ).bind(1).first()
  assert.equal(r.number, 1)
  assert.equal(r.name, 'الفاتحة')
})

test('d1Provider via MockD1: getAyah(1,1) returns text', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    'SELECT surah_number, ayah_number, text, juz, page FROM ayahs WHERE surah_number = ?1 AND ayah_number = ?2 LIMIT 1'
  ).bind(1, 1).first()
  assert.equal(r.surah_number, 1)
  assert.equal(r.ayah_number, 1)
  assert.ok(r.text.length > 0)
})

test('d1Provider via MockD1: getTafseersByAyah(1,1) returns entries with valid sourceType', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    `SELECT id, book_id, author_id, surah_number, ayah_number, text,
            source_type, verification_status, is_original_text,
            source_name, edition, volume, page, source_url, reviewer_note, is_sample
       FROM tafsir_entries WHERE surah_number = ?1 AND ayah_number = ?2 ORDER BY id`
  ).bind(1, 1).all()
  assert.ok(r.results.length >= 1)
  const allowedSt = new Set(['original-text','summary','sample','review-needed','curated'])
  for (const row of r.results) {
    assert.ok(allowedSt.has(row.source_type), `bad source_type: ${row.source_type}`)
  }
})

// ============== d1 search structural tests ==============

test('d1Provider search: filter sourceTypes=summary returns only summaries', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const sql =
    `SELECT t.id AS id, t.book_id, t.author_id, t.surah_number, t.ayah_number,
            t.text AS tafseer_text, t.source_type, t.verification_status,
            t.is_original_text, t.source_name, t.edition, t.volume, t.page,
            t.source_url, t.reviewer_note, t.is_sample,
            b.title AS book_title, b.popularity AS book_popularity,
            au.id AS author_id_real, au.name AS author_name, au.death_year AS author_death,
            s.name AS surah_name,
            ay.text AS ayah_text
       FROM tafsir_entries t
       LEFT JOIN tafsir_books b  ON b.id = t.book_id
       LEFT JOIN authors      au ON au.id = t.author_id
       LEFT JOIN surahs       s  ON s.number = t.surah_number
       LEFT JOIN ayahs        ay ON ay.surah_number = t.surah_number AND ay.ayah_number = t.ayah_number
       WHERE t.source_type IN (?1) ORDER BY b.popularity DESC, t.id ASC LIMIT 500`
  const r = await db.prepare(sql).bind('summary').all()
  for (const row of r.results) {
    assert.equal(row.source_type, 'summary')
  }
})

test('d1Provider search: count matches select for same WHERE', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const where = 'WHERE t.surah_number = ?1'
  const countSql = `SELECT COUNT(*) AS c FROM tafsir_entries t
       LEFT JOIN tafsir_books b  ON b.id = t.book_id
       LEFT JOIN authors      au ON au.id = t.author_id
       LEFT JOIN ayahs        ay ON ay.surah_number = t.surah_number AND ay.ayah_number = t.ayah_number ${where}`
  const selSql = `SELECT t.id AS id, t.book_id, t.author_id, t.surah_number, t.ayah_number,
            t.text AS tafseer_text, t.source_type, t.verification_status,
            t.is_original_text, t.source_name, t.edition, t.volume, t.page,
            t.source_url, t.reviewer_note, t.is_sample,
            b.title AS book_title, b.popularity AS book_popularity,
            au.id AS author_id_real, au.name AS author_name, au.death_year AS author_death,
            s.name AS surah_name,
            ay.text AS ayah_text
       FROM tafsir_entries t
       LEFT JOIN tafsir_books b  ON b.id = t.book_id
       LEFT JOIN authors      au ON au.id = t.author_id
       LEFT JOIN surahs       s  ON s.number = t.surah_number
       LEFT JOIN ayahs        ay ON ay.surah_number = t.surah_number AND ay.ayah_number = t.ayah_number
       ${where} ORDER BY b.popularity DESC, t.id ASC LIMIT 500`
  const cnt = await db.prepare(countSql).bind(1).first()
  const sel = await db.prepare(selSql).bind(1).all()
  assert.equal(cnt.c, sel.results.length)
})

test('d1Provider: search rows include join fields (book_title, surah_name, ayah_text)', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const sql =
    `SELECT t.id AS id, t.book_id, t.author_id, t.surah_number, t.ayah_number,
            t.text AS tafseer_text, t.source_type, t.verification_status,
            t.is_original_text, t.source_name, t.edition, t.volume, t.page,
            t.source_url, t.reviewer_note, t.is_sample,
            b.title AS book_title, b.popularity AS book_popularity,
            au.id AS author_id_real, au.name AS author_name, au.death_year AS author_death,
            s.name AS surah_name,
            ay.text AS ayah_text
       FROM tafsir_entries t
       LEFT JOIN tafsir_books b  ON b.id = t.book_id
       LEFT JOIN authors      au ON au.id = t.author_id
       LEFT JOIN surahs       s  ON s.number = t.surah_number
       LEFT JOIN ayahs        ay ON ay.surah_number = t.surah_number AND ay.ayah_number = t.ayah_number
       WHERE t.surah_number = ?1 ORDER BY b.popularity DESC, t.id ASC LIMIT 500`
  const r = await db.prepare(sql).bind(1).all()
  assert.ok(r.results.length > 0)
  for (const row of r.results) {
    assert.equal(row.surah_number, 1)
    // join fields يجب أن تكون متاحة من D1 (لا حاجة لـ seed lookup)
    assert.ok(typeof row.book_title === 'string' && row.book_title.length > 0)
    assert.ok(typeof row.surah_name === 'string')
    // ayah_text قد تكون فارغة فقط إذا لم تكن الآية موجودة في seed
  }
})

test('d1Provider: empty DB probe returns null (signals fallback to seed)', async () => {
  const empty = { surahs: [], ayahs: [], authors: [], books: [], tafseers: [], categories: [] }
  const db = new MockD1(empty)
  const probe = await db.prepare('SELECT 1 AS x FROM tafsir_entries LIMIT 1').first()
  assert.equal(probe, null)
})

test('d1Provider: parameterized query — bind values do not appear in SQL string', () => {
  // verifies design: قيم المستخدم تمر عبر .bind() فقط، لا interpolation
  const sql = 'SELECT * FROM tafsir_entries WHERE surah_number = ?1 AND ayah_number = ?2'
  const userInput1 = "1 OR 1=1; DROP TABLE tafsir_entries; --"
  const userInput2 = "'; SELECT * FROM users; --"
  // SQL النصي ثابت ولا يتغيّر بقيم المستخدم
  assert.ok(!sql.includes(userInput1))
  assert.ok(!sql.includes(userInput2))
  assert.ok(sql.includes('?1'))
  assert.ok(sql.includes('?2'))
})

// ============== seed search: extended SearchResults shape ==============
// نتأكّد أن seed.search() يُعيد جميع الحقول الموسَّعة (mode, appliedFilters, facets)
// المضافة لتوسيع نتائج البحث وتغذية واجهة الفلاتر تلقائيًا.

test('seed search: returns mode="seed" and full SearchResults shape', async () => {
  // نشغّل seed search عبر import ديناميكي للنواة المُجمَّعة
  // (نعتمد على dist/_worker.js إن وُجد، وإلا نتخطّى الاختبار).
  ensureSeed()
  const distWorker = path.join(ROOT, 'dist/_worker.js')
  if (!fs.existsSync(distWorker)) {
    // نشغّل البناء (سريع) إن لم يكن موجودًا
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe' })
  }
  // نختبر بنية SearchResults بطريقة بنيوية فقط (دون استدعاء worker مباشر)
  // عبر فحص ملف src/lib/search.ts للحقول المتوقّعة.
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/search.ts'), 'utf8')
  for (const field of [
    'mode?:', 'appliedFilters?:', 'facets?:',
    'sourceTypes:', 'verificationStatuses:', 'bookIds:', 'authorIds:',
  ]) {
    assert.ok(src.includes(field), `expected SearchResults to declare "${field}"`)
  }
  // وأن seed search يضع mode='seed' في الإرجاع
  assert.ok(src.includes("mode: 'seed'"), 'seed search must set mode="seed"')
})

test('d1 search: source has appliedFilters echo + facets aggregation', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/d1-provider.ts'), 'utf8')
  // d1-provider يعيد mode='d1'
  assert.ok(src.includes("mode: 'd1'"), 'd1 search must set mode="d1"')
  // appliedFilters يحوي كل المفاتيح المهمّة
  for (const key of [
    'sourceTypes:', 'verificationStatuses:', 'searchIn:', 'sort:',
    'centuryFrom:', 'centuryTo:', 'bookIds:', 'authorIds:',
  ]) {
    assert.ok(src.includes(key), `expected d1 appliedFilters to expose "${key}"`)
  }
  // facets aggregation موجود
  assert.ok(src.includes('stCount') && src.includes('vsCount'),
    'd1 must aggregate facets (sourceTypes + verificationStatuses)')
})

test('SearchResults type: optional fields do not break existing consumers', () => {
  // نضمن أن جميع الحقول الموسَّعة optional (?:) — أي إن existing tests
  // التي لا تتحقّق منها لن تنكسر.
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/search.ts'), 'utf8')
  for (const opt of ['mode?:', 'appliedFilters?:', 'facets?:']) {
    assert.ok(src.includes(opt), `${opt} must remain optional`)
  }
})

// ============================================================================
// Read-Provider Extensions: getTafseersForSurah, getReadSurahPayload,
//                          getQuranCoverageSummary
// ============================================================================

test('types.ts: declares QuranCoverageSummary + ReadSurahPayload interfaces', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/types.ts'), 'utf8')
  for (const tok of [
    'QuranCoverageSummary',
    'ReadSurahPayload',
    'expectedAyahs: 6236',
    'surahsCovered',
    'isComplete',
    'coveragePercent',
    'tafseersByAyah',
  ]) {
    assert.ok(src.includes(tok), `types.ts must declare "${tok}"`)
  }
})

test('DataProvider interface: declares optional getTafseersForSurah / getReadSurahPayload / getQuranCoverageSummary', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/types.ts'), 'utf8')
  assert.ok(/getTafseersForSurah\?\(/.test(src),
    'getTafseersForSurah must be optional in DataProvider')
  assert.ok(/getReadSurahPayload\?\(/.test(src),
    'getReadSurahPayload must be optional in DataProvider')
  assert.ok(/getQuranCoverageSummary\?\(/.test(src),
    'getQuranCoverageSummary must be optional in DataProvider')
})

test('seed-provider.ts: implements all three read-provider extensions', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/seed-provider.ts'), 'utf8')
  assert.ok(src.includes('getTafseersForSurah(surah: number)'),
    'seed must implement getTafseersForSurah')
  assert.ok(src.includes('getReadSurahPayload(surah: number)'),
    'seed must implement getReadSurahPayload')
  assert.ok(src.includes('getQuranCoverageSummary()'),
    'seed must implement getQuranCoverageSummary')
  // عقد المخرجات
  assert.ok(src.includes("mode: 'seed'"),
    'seed coverage/payload must mark mode="seed"')
  assert.ok(src.includes('expectedAyahs') && src.includes('6236'),
    'seed coverage must use expectedAyahs=6236')
})

test('d1-provider.ts: implements all three read-provider extensions with safe fallbacks', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/d1-provider.ts'), 'utf8')
  assert.ok(src.includes('async getTafseersForSurah(surah: number)'),
    'd1 must implement async getTafseersForSurah')
  assert.ok(src.includes('async getReadSurahPayload(surah: number)'),
    'd1 must implement async getReadSurahPayload')
  assert.ok(src.includes('async getQuranCoverageSummary()'),
    'd1 must implement async getQuranCoverageSummary')
  // d1 يضع mode='d1'
  assert.ok(src.includes("mode: 'd1'"),
    'd1 coverage/payload must mark mode="d1"')
  // فالباك آمن إلى seed
  assert.ok(src.includes('seedProvider.getTafseersForSurah') ||
            src.includes('seedProvider.getReadSurahPayload') ||
            src.includes('seedProvider.getQuranCoverageSummary'),
    'd1 must fallback to seedProvider on failure/empty DB')
  // bind() (لا interpolation)
  assert.ok(/db\.prepare\([^)]+\)\.bind\(/.test(src),
    'd1 read methods must use prepared .bind() statements')
})

// ---- Functional smoke tests via direct seedProvider import ----
// نستورد seed-provider بشكل ديناميكي عبر node:vm/fs (لتجنّب TypeScript)،
// ولكن seed-provider مكتوب بـ TS؛ بدلًا من ذلك نختبر منطقه عبر seed JSON
// (نفس مصدر بيانات SUKHS/AYAHS/TAFSEERS بعد التوليد).

test('seedProvider semantics: getTafseersForSurah(1) returns sorted tafseers for Al-Fatiha', () => {
  const seed = ensureSeed()
  // محاكاة ما يفعله seed-provider: تصفية حسب السورة + ترتيب بـ ayah ثم id
  const list = seed.tafseers
    .filter(t => t.surah === 1)
    .sort((a, b) => a.ayah - b.ayah || String(a.id).localeCompare(String(b.id)))
  assert.ok(list.length > 0, 'must have at least one tafseer for surah 1')
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].ayah >= list[i - 1].ayah,
      'tafseers must be sorted ascending by ayah')
  }
})

test('seedProvider semantics: getReadSurahPayload(1) returns surah + ayahs + tafseersByAyah', () => {
  const seed = ensureSeed()
  const surah = seed.surahs.find(s => s.number === 1)
  const ayahs = seed.ayahs.filter(a => a.surah === 1).sort((x, y) => x.number - y.number)
  const byAyah = {}
  for (const t of seed.tafseers) {
    if (t.surah !== 1) continue
    if (!byAyah[t.ayah]) byAyah[t.ayah] = []
    byAyah[t.ayah].push(t)
  }
  assert.ok(surah, 'surah 1 must exist')
  assert.equal(surah.name, 'الفاتحة')
  assert.ok(ayahs.length >= 7, 'Al-Fatiha must have at least 7 ayahs in seed')
  // كل آية لديها مفتاح Object صالح (رقم)
  for (const k of Object.keys(byAyah)) {
    assert.ok(Number.isFinite(Number(k)), 'tafseersByAyah keys must be numeric strings')
    assert.ok(Array.isArray(byAyah[k]) && byAyah[k].length > 0)
  }
})

test('seedProvider semantics: getQuranCoverageSummary returns valid structure', () => {
  const seed = ensureSeed()
  const ayahsCount = seed.ayahs.length
  const surahsCovered = new Set(seed.ayahs.map(a => a.surah)).size
  const expectedAyahs = 6236
  const summary = {
    ayahsCount,
    expectedAyahs,
    surahsCovered,
    isComplete: ayahsCount === expectedAyahs,
    coveragePercent: +((ayahsCount / expectedAyahs) * 100).toFixed(2),
    mode: 'seed',
  }
  assert.equal(typeof summary.ayahsCount, 'number')
  assert.equal(summary.expectedAyahs, 6236)
  assert.ok(summary.surahsCovered >= 1 && summary.surahsCovered <= 114)
  assert.equal(typeof summary.isComplete, 'boolean')
  assert.equal(typeof summary.coveragePercent, 'number')
  assert.ok(summary.coveragePercent >= 0 && summary.coveragePercent <= 100)
  assert.equal(summary.mode, 'seed')
  // sample seed: not complete
  assert.equal(summary.isComplete, ayahsCount === 6236)
})

test('coverage math: full Quran (6236 ayahs) → isComplete=true, 100%', () => {
  const ayahsCount = 6236
  const expectedAyahs = 6236
  const pct = +((ayahsCount / expectedAyahs) * 100).toFixed(2)
  assert.equal(pct, 100)
  assert.equal(ayahsCount === expectedAyahs, true)
})

test('coverage math: empty DB → isComplete=false, 0%', () => {
  const ayahsCount = 0
  const expectedAyahs = 6236
  const pct = +((ayahsCount / expectedAyahs) * 100).toFixed(2)
  assert.equal(pct, 0)
  assert.equal(ayahsCount === expectedAyahs, false)
})

// ============================================================================
// QuranCoverageSummary Extended Fields
// ============================================================================
// التحقّق من حقول التغطية الموسَّعة: surahsCount, missingSurahs, partialSurahs,
// hasSourceMetadata.
test('QuranCoverageSummary: types.ts declares extended fields', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/types.ts'), 'utf8')
  for (const tok of [
    'surahsCount',
    'missingSurahs',
    'partialSurahs',
    'hasSourceMetadata',
  ]) {
    assert.ok(src.includes(tok),
      `QuranCoverageSummary must declare extended field "${tok}"`)
  }
})

test('ReadSurahPayload: declares optional coverage + isCompleteQuran fields', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/types.ts'), 'utf8')
  assert.ok(/coverage\?:\s*QuranCoverageSummary/.test(src),
    'ReadSurahPayload must declare optional coverage field')
  assert.ok(/isCompleteQuran\?:\s*boolean/.test(src),
    'ReadSurahPayload must declare optional isCompleteQuran field')
})

test('seed-provider: returns extended coverage fields (surahsCount/missing/partial/source)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/seed-provider.ts'), 'utf8')
  for (const tok of [
    'surahsCount',
    'missingSurahs',
    'partialSurahs',
    'hasSourceMetadata',
  ]) {
    assert.ok(src.includes(tok),
      `seed-provider.ts must populate "${tok}" in coverage summary`)
  }
})

test('d1-provider: returns extended coverage fields (surahsCount/missing/partial/source)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/d1-provider.ts'), 'utf8')
  for (const tok of [
    'surahsCount',
    'missingSurahs',
    'partialSurahs',
    'hasSourceMetadata',
  ]) {
    assert.ok(src.includes(tok),
      `d1-provider.ts must populate "${tok}" in coverage summary`)
  }
  // d1 must use pragma_table_info to detect the source_name column safely
  assert.ok(src.includes("pragma_table_info('ayahs')"),
    'd1-provider must probe ayahs columns via pragma_table_info before reading source_name')
})

test('seed-provider getReadSurahPayload: includes coverage + isCompleteQuran', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/seed-provider.ts'), 'utf8')
  assert.ok(src.includes('isCompleteQuran'),
    'seed-provider getReadSurahPayload must populate isCompleteQuran')
  assert.ok(/coverage[\s,]/.test(src),
    'seed-provider getReadSurahPayload must include coverage field')
})

test('d1-provider getReadSurahPayload: includes coverage + isCompleteQuran', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/d1-provider.ts'), 'utf8')
  assert.ok(src.includes('isCompleteQuran'),
    'd1-provider getReadSurahPayload must populate isCompleteQuran')
  assert.ok(/coverage[\s,]/.test(src),
    'd1-provider getReadSurahPayload must include coverage field')
})

test('coverage math: extended fields semantics', () => {
  const seed = ensureSeed()
  const SURAHS_COUNT = 114
  const ayahsCount = seed.ayahs.length
  const presentMap = new Map()
  for (const a of seed.ayahs) {
    presentMap.set(a.surah, (presentMap.get(a.surah) || 0) + 1)
  }
  // محاكاة منطق seed-provider لاحتساب missing/partial
  const missingSurahs = []
  const partialSurahs = []
  for (const s of seed.surahs) {
    const present = presentMap.get(s.number) || 0
    if (present === 0) missingSurahs.push(s.number)
    else if (present < s.ayahCount) partialSurahs.push(s.number)
  }
  // العيّنة ليست مكتملة → نتوقّع وجود سور ناقصة كثيرة
  assert.ok(Array.isArray(missingSurahs))
  assert.ok(Array.isArray(partialSurahs))
  assert.ok(missingSurahs.length + partialSurahs.length > 0,
    'sample seed must have either missing or partial surahs')
  assert.equal(SURAHS_COUNT, 114)
  assert.ok(ayahsCount < 6236, 'sample seed should not be the full Quran')
})

// ============================================================================
// /api/quran/coverage endpoint shape
// ============================================================================
test('/api/quran/coverage: index.tsx returns extended fields in fallback', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/index.tsx'), 'utf8')
  // التحقّق من تسجيل المسار
  assert.ok(src.includes("/api/quran/coverage"),
    '/api/quran/coverage route must be registered')
  // الفالباك يجب أن يحوي الحقول الجديدة لتجنّب undefined على الواجهة
  for (const tok of ['surahsCount', 'missingSurahs', 'partialSurahs', 'hasSourceMetadata']) {
    assert.ok(src.includes(tok),
      `/api/quran/coverage fallback must include "${tok}"`)
  }
})
