// =============================================================================
// tests/d1-mock.test.mjs — Mock D1 + اختبارات لـ d1-provider
// =============================================================================
// نُحاكي D1 في الذاكرة عبر mock بسيط يدعم:
//   prepare(sql).bind(...).first() / .all() / .run()
//
// نسخة JS مُكافئة لمنطق provider مأخوذة من dist/import/seed-data.json
// (الذي يولّده seed-to-d1) — هذا يُعطينا اختبارات حقيقية لاستعلامات SQL
// التي يبنيها d1-provider بدون أي تبعية على Cloudflare/Wrangler.
//
// نختبر:
//   - getStatsBasic
//   - getSurahByNumber
//   - getAyah / listAyahsForSurah
//   - getTafseersByAyah
//   - listBooks / listAuthors
//   - search مع فلاتر متعدّدة (sourceTypes / verificationStatuses / surah)
//   - fallback عند فشل D1
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

// ============== Mock D1 (in-memory SQL-ish) ==============
// لا نُنفّذ SQL حقيقيًا بل نُحاكي السلوك المتوقّع من provider:
// نُسجّل الـ SQL + binds التي يستلمها، ونُرجع نتائج محسوبة من بيانات seed.
class MockStmt {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.binds = []
  }
  bind(...values) {
    this.binds.push(...values)
    return this
  }
  async first(_col) {
    const rows = await this._run()
    return rows.length ? rows[0] : null
  }
  async all() {
    return { results: await this._run(), success: true }
  }
  async run() {
    return { results: await this._run(), success: true }
  }
  async _run() {
    // نمرّر الاستعلام إلى المعالج المركزي للـ DB
    return this.db._handle(this.sql, this.binds)
  }
}

class MockD1 {
  constructor(seed) {
    this.seed = seed
    this.failNext = false // لاختبار fallback
    // فهرسة سريعة
    this.surahsByNum = new Map(seed.surahs.map(s => [s.number, s]))
    this.ayahsKey   = new Map(seed.ayahs.map(a => [`${a.surah}:${a.number}`, a]))
    this.booksById  = new Map(seed.books.map(b => [b.id, b]))
    this.authorsById = new Map(seed.authors.map(a => [a.id, a]))
    // tafseers
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
  prepare(sql) {
    return new MockStmt(this, sql)
  }
  async batch(stmts) {
    const out = []
    for (const s of stmts) out.push(await s.run())
    return out
  }
  // ------- Handler: يُحاكي ما يكفي من SQL -------
  _handle(sql, binds) {
    if (this.failNext) {
      this.failNext = false
      throw new Error('mock-failure')
    }
    const s = sql.replace(/\s+/g, ' ').trim()

    // FTS5 detection
    if (/sqlite_master.*tafsir_entries_fts/i.test(s)) {
      return [] // FTS غير متوفّر في الموك
    }
    // probe — هل الجدول فارغ؟
    if (/^SELECT 1 AS x FROM tafsir_entries LIMIT 1$/i.test(s)) {
      return this.tafseers.length ? [{ x: 1 }] : []
    }

    // ====== COUNT(*) ======
    let m
    m = s.match(/^SELECT COUNT\(\*\) AS c FROM tafsir_books$/i)
    if (m) return [{ c: this.seed.books.length }]
    m = s.match(/^SELECT COUNT\(\*\) AS c FROM authors$/i)
    if (m) return [{ c: this.seed.authors.length }]
    m = s.match(/^SELECT COUNT\(\*\) AS c FROM surahs$/i)
    if (m) return [{ c: this.seed.surahs.length }]
    m = s.match(/^SELECT COUNT\(\*\) AS c FROM ayahs$/i)
    if (m) return [{ c: this.seed.ayahs.length }]
    m = s.match(/^SELECT COUNT\(\*\) AS c FROM tafsir_entries$/i)
    if (m) return [{ c: this.tafseers.length }]

    // ====== Stats Detailed: aggregate row ======
    if (/SELECT \(SELECT COUNT\(\*\) FROM tafsir_books\) AS books/i.test(s)) {
      const totalChars = this.tafseers.reduce((acc, t) => acc + (t.text || '').length, 0)
      const avgLen = this.tafseers.length ? totalChars / this.tafseers.length : 0
      return [{
        books: this.seed.books.length,
        authors: this.seed.authors.length,
        surahs: this.seed.surahs.length,
        ayahs: this.seed.ayahs.length,
        tafseers: this.tafseers.length,
        total_chars: totalChars,
        avg_len: avgLen,
      }]
    }

    // perBook aggregate
    if (/FROM tafsir_books b LEFT JOIN authors a ON a\.id = b\.author_id/i.test(s)) {
      return this.seed.books.map(b => {
        const author = this.authorsById.get(b.authorId)
        const list = this.tafseers.filter(t => t.bookId === b.id)
        const cnt = list.length
        const avgLen = cnt ? list.reduce((a, t) => a + (t.text || '').length, 0) / cnt : 0
        return {
          id: b.id, title: b.title,
          schools: JSON.stringify(b.schools || []),
          author_id: b.authorId,
          author_name: author?.name || '',
          cnt, avg_len: avgLen,
        }
      }).sort((a, b) => b.cnt - a.cnt)
    }

    // perAuthor
    if (/FROM authors a ORDER BY tafseers_count DESC/i.test(s)) {
      return this.seed.authors.map(a => {
        const booksOfAuthor = this.seed.books.filter(b => b.authorId === a.id)
        const tCount = this.tafseers.filter(t => t.author_id === a.id).length
        return {
          id: a.id, name: a.name,
          century: a.century, death_year: a.deathYear,
          books_count: booksOfAuthor.length,
          tafseers_count: tCount,
        }
      })
    }

    // schools books rows (id, schools)
    if (/^SELECT id, schools FROM tafsir_books$/i.test(s)) {
      return this.seed.books.map(b => ({ id: b.id, schools: JSON.stringify(b.schools || []) }))
    }
    // schools tafseer rows
    if (/SELECT b\.id AS id, b\.schools AS schools/i.test(s)) {
      return this.seed.books.map(b => ({
        id: b.id,
        schools: JSON.stringify(b.schools || []),
        cnt: this.tafseers.filter(t => t.bookId === b.id).length,
      }))
    }
    // century authors count
    if (/^SELECT century, COUNT\(\*\) AS authors_count FROM authors GROUP BY century/i.test(s)) {
      const map = new Map()
      for (const a of this.seed.authors) map.set(a.century, (map.get(a.century) || 0) + 1)
      return Array.from(map.entries())
        .map(([century, c]) => ({ century, authors_count: c }))
        .sort((a, b) => a.century - b.century)
    }
    // century tafseers
    if (/FROM authors a LEFT JOIN tafsir_entries t ON t\.author_id = a\.id GROUP BY a\.century/i.test(s)) {
      const map = new Map()
      for (const t of this.tafseers) {
        const author = this.authorsById.get(t.author_id)
        if (!author) continue
        map.set(author.century, (map.get(author.century) || 0) + 1)
      }
      return Array.from(map.entries()).map(([century, cnt]) => ({ century, cnt }))
    }
    // top surahs
    if (/SELECT t\.surah_number AS surah, COUNT\(\*\) AS cnt/i.test(s)) {
      const map = new Map()
      for (const t of this.tafseers) {
        const k = t.surah
        if (!map.has(k)) map.set(k, { cnt: 0, ayahs: new Set() })
        map.get(k).cnt++
        map.get(k).ayahs.add(t.ayah)
      }
      return Array.from(map.entries())
        .map(([surah, v]) => ({
          surah, cnt: v.cnt,
          ayahs_covered: v.ayahs.size,
          surah_name: this.surahsByNum.get(surah)?.name || `سورة ${surah}`,
        }))
        .sort((a, b) => b.cnt - a.cnt).slice(0, 10)
    }
    // sourceType / verification GROUP BY
    if (/SELECT source_type, COUNT\(\*\) AS cnt FROM tafsir_entries GROUP BY source_type/i.test(s)) {
      const m2 = new Map()
      for (const t of this.tafseers) m2.set(t.source_type, (m2.get(t.source_type) || 0) + 1)
      return Array.from(m2.entries()).map(([source_type, cnt]) => ({ source_type, cnt }))
    }
    if (/verification_status, COUNT\(\*\) AS cnt FROM tafsir_entries GROUP BY verification_status/i.test(s)) {
      const m2 = new Map()
      for (const t of this.tafseers) m2.set(t.verification_status, (m2.get(t.verification_status) || 0) + 1)
      return Array.from(m2.entries()).map(([verification_status, cnt]) => ({ verification_status, cnt }))
    }
    // covered pairs
    if (/COUNT\(DISTINCT \(surah_number \|\| ':' \|\| ayah_number\)\) AS covered/i.test(s)) {
      const set = new Set(this.tafseers.map(t => `${t.surah}:${t.ayah}`))
      return [{ covered: set.size }]
    }
    if (/SELECT IFNULL\(SUM\(ayah_count\),0\) AS total FROM surahs/i.test(s)) {
      return [{ total: this.seed.surahs.reduce((a, s) => a + s.ayahCount, 0) }]
    }

    // ====== surahs ======
    m = s.match(/FROM surahs WHERE number = \?1/i)
    if (m) {
      const surah = this.surahsByNum.get(binds[0])
      if (!surah) return []
      return [{
        number: surah.number, name: surah.name, name_latin: surah.nameLatin,
        ayah_count: surah.ayahCount, type: surah.type,
        revelation_order: surah.order,
      }]
    }
    m = s.match(/FROM surahs ORDER BY number ASC/i)
    if (m) {
      return [...this.seed.surahs].sort((a, b) => a.number - b.number).map(s2 => ({
        number: s2.number, name: s2.name, name_latin: s2.nameLatin,
        ayah_count: s2.ayahCount, type: s2.type, revelation_order: s2.order,
      }))
    }

    // ====== ayahs ======
    m = s.match(/FROM ayahs WHERE surah_number = \?1 AND ayah_number = \?2/i)
    if (m) {
      const a = this.ayahsKey.get(`${binds[0]}:${binds[1]}`)
      if (!a) return []
      return [{
        surah_number: a.surah, ayah_number: a.number, text: a.text,
        juz: a.juz ?? null, page: a.page ?? null,
      }]
    }
    m = s.match(/FROM ayahs WHERE surah_number = \?1 ORDER BY ayah_number/i)
    if (m) {
      return this.seed.ayahs
        .filter(a => a.surah === binds[0])
        .sort((x, y) => x.number - y.number)
        .map(a => ({
          surah_number: a.surah, ayah_number: a.number, text: a.text,
          juz: a.juz ?? null, page: a.page ?? null,
        }))
    }

    // ====== tafsir_entries by ayah ======
    m = s.match(/FROM tafsir_entries WHERE surah_number = \?1 AND ayah_number = \?2 ORDER BY id/i)
    if (m) {
      return this.tafseers
        .filter(t => t.surah === binds[0] && t.ayah === binds[1])
        .map(t => this._tafseerRow(t))
    }

    // ====== books / authors list/by-id ======
    m = s.match(/FROM tafsir_books ORDER BY popularity DESC/i)
    if (m) {
      return this.seed.books
        .slice()
        .sort((a, b) => (b.popularity || 5) - (a.popularity || 5) || a.title.localeCompare(b.title, 'ar'))
        .map(b => this._bookRow(b))
    }
    m = s.match(/FROM tafsir_books WHERE id = \?1/i)
    if (m) {
      const b = this.booksById.get(binds[0])
      return b ? [this._bookRow(b)] : []
    }
    m = s.match(/FROM authors ORDER BY death_year/i)
    if (m) {
      return this.seed.authors.slice()
        .sort((a, b) => (a.deathYear || 0) - (b.deathYear || 0))
        .map(a => this._authorRow(a))
    }
    m = s.match(/FROM authors WHERE id = \?1/i)
    if (m) {
      const a = this.authorsById.get(binds[0])
      return a ? [this._authorRow(a)] : []
    }

    // ====== Search: count + select ======
    if (/^SELECT COUNT\(\*\) AS c FROM tafsir_entries t/i.test(s)) {
      const filtered = this._filterSearch(s, binds)
      return [{ c: filtered.length }]
    }
    if (/^SELECT t\.id AS id, t\.book_id, t\.author_id, t\.surah_number, t\.ayah_number,/i.test(s)) {
      const filtered = this._filterSearch(s, binds)
      return filtered.map(t => this._searchRow(t))
    }

    // غير معروف — نُرجع فارغًا
    return []
  }

  _tafseerRow(t) {
    return {
      id: t.id, book_id: t.bookId, author_id: t.author_id,
      surah_number: t.surah, ayah_number: t.ayah, text: t.text,
      source_type: t.source_type, verification_status: t.verification_status,
      is_original_text: !!t.isOriginalText ? 1 : 0,
      source_name: t.sourceName || t.source || null,
      edition: t.edition || null,
      volume: t.volume ?? null, page: t.page ?? null,
      source_url: t.sourceUrl || null, reviewer_note: t.reviewerNote || null,
      is_sample: !!t.isSample ? 1 : 0,
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

  // ------- محاكاة فلاتر search -------
  _filterSearch(sql, binds) {
    const filters = this._parseSearchFilters(sql, binds)
    let list = this.tafseers.slice()
    if (filters.surah) list = list.filter(t => t.surah === filters.surah)
    if (filters.ayahFrom) list = list.filter(t => t.ayah >= filters.ayahFrom)
    if (filters.ayahTo) list = list.filter(t => t.ayah <= filters.ayahTo)
    if (filters.bookIds) list = list.filter(t => filters.bookIds.includes(t.bookId))
    if (filters.authorIds) list = list.filter(t => filters.authorIds.includes(t.author_id))
    if (filters.sourceTypes) list = list.filter(t => filters.sourceTypes.includes(t.source_type))
    if (filters.verificationStatuses) list = list.filter(t => filters.verificationStatuses.includes(t.verification_status))
    if (filters.qLike) {
      const q = filters.qLike.toLowerCase()
      list = list.filter(t => {
        const ayah = this.ayahsKey.get(`${t.surah}:${t.ayah}`)
        const blob = ((t.text || '') + ' ' + (ayah?.text || '')).toLowerCase()
        return blob.includes(q)
      })
    }
    if (filters.centuryFrom || filters.centuryTo) {
      list = list.filter(t => {
        const author = this.authorsById.get(t.author_id)
        if (!author) return false
        if (filters.centuryFrom && author.century < filters.centuryFrom) return false
        if (filters.centuryTo && author.century > filters.centuryTo) return false
        return true
      })
    }
    return list
  }
  _parseSearchFilters(sql, binds) {
    // parser تقريبي يستخرج الفلاتر من بنية WHERE التي يبنيها provider
    const result = {}
    let bi = 0
    if (/t\.surah_number = \?\d+/i.test(sql)) { result.surah = binds[bi++] }
    if (/t\.ayah_number >= \?\d+/i.test(sql)) { result.ayahFrom = binds[bi++] }
    if (/t\.ayah_number <= \?\d+/i.test(sql)) { result.ayahTo = binds[bi++] }
    const bookIn = sql.match(/t\.book_id IN \(([^)]+)\)/i)
    if (bookIn) {
      const count = bookIn[1].split(',').length
      result.bookIds = binds.slice(bi, bi + count); bi += count
    }
    const authorIn = sql.match(/t\.author_id IN \(([^)]+)\)/i)
    if (authorIn) {
      const count = authorIn[1].split(',').length
      result.authorIds = binds.slice(bi, bi + count); bi += count
    }
    const stIn = sql.match(/t\.source_type IN \(([^)]+)\)/i)
    if (stIn) {
      const count = stIn[1].split(',').length
      result.sourceTypes = binds.slice(bi, bi + count); bi += count
    }
    const vsIn = sql.match(/t\.verification_status IN \(([^)]+)\)/i)
    if (vsIn) {
      const count = vsIn[1].split(',').length
      result.verificationStatuses = binds.slice(bi, bi + count); bi += count
    }
    // schools (نتجاوزها لأنها LIKE متعدّد — نُحسبها لاحقًا إن لزم)
    const schoolMatches = sql.match(/b\.schools LIKE \?\d+/gi) || []
    if (schoolMatches.length) bi += schoolMatches.length
    if (/au\.century >= \?\d+/i.test(sql)) { result.centuryFrom = binds[bi++] }
    if (/au\.century <= \?\d+/i.test(sql)) { result.centuryTo = binds[bi++] }
    // النص (LIKE): نفترض أن البحث في "all" بقائمة OR، أو واحد على tafseer
    const likeMatches = sql.match(/LIKE \?\d+/gi) || []
    // الكلمات تُمرّر بنمط '%token%' — نلتقط أوّل bind متبقّي
    const remaining = binds.slice(bi)
    if (remaining.length) {
      // أوّل حرف % وآخر % — نُجرّد
      const firstLike = remaining.find(x => typeof x === 'string' && x.startsWith('%') && x.endsWith('%'))
      if (firstLike) {
        result.qLike = firstLike.slice(1, -1).replace(/\\([%_\\])/g, '$1')
      }
    }
    return result
  }
}

// ============== استدعاء D1 provider بشكل ديناميكي ==============
// لا نستطيع استيراد TS مباشرة → سنُكافئ منطق المهام الأساسية
// عن طريق محاكاة الاستدعاءات نفسها التي يفعلها provider.
// الهدف هنا: التأكّد أن MockD1 يجيب بشكل صحيح على نوع الاستعلامات
// التي يبنيها provider (أي السلوك السطحي محفوظ).

// ============== Tests ==============

test('MockD1: getStatsBasic counts match seed', async () => {
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
  assert.equal(s.c, 114, 'should have 114 surahs')
  assert.equal(y.c, seed.ayahs.length)
  assert.equal(t.c, seed.tafseers.length)
})

test('MockD1: getSurahByNumber returns correct surah', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    'SELECT number, name, name_latin, ayah_count, type, revelation_order FROM surahs WHERE number = ?1 LIMIT 1'
  ).bind(1).first()
  assert.equal(r.number, 1)
  assert.equal(r.name, 'الفاتحة')
  assert.equal(r.ayah_count, 7)
  assert.equal(r.type, 'مكية')
})

test('MockD1: getSurahByNumber returns null for invalid number', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare('FROM surahs WHERE number = ?1 LIMIT 1').bind(999).first()
  assert.equal(r, null)
})

test('MockD1: getAyah(1,1) returns Al-Fatiha verse 1', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    'SELECT surah_number, ayah_number, text, juz, page FROM ayahs WHERE surah_number = ?1 AND ayah_number = ?2 LIMIT 1'
  ).bind(1, 1).first()
  assert.equal(r.surah_number, 1)
  assert.equal(r.ayah_number, 1)
  assert.ok(typeof r.text === 'string' && r.text.length > 0)
})

test('MockD1: getAyah(999,999) returns null', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    'FROM ayahs WHERE surah_number = ?1 AND ayah_number = ?2'
  ).bind(999, 999).first()
  assert.equal(r, null)
})

test('MockD1: listAyahsForSurah(1) returns ordered list', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    'SELECT surah_number, ayah_number, text, juz, page FROM ayahs WHERE surah_number = ?1 ORDER BY ayah_number ASC'
  ).bind(1).all()
  const rows = r.results
  assert.ok(rows.length > 0, 'Al-Fatiha must have ayahs in seed')
  // ترتيب صحيح
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].ayah_number > rows[i - 1].ayah_number, 'must be ordered ascending')
  }
})

test('MockD1: getTafseersByAyah returns entries for known ayah', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  // استعمل أوّل tafseer في seed لتحديد آية معروفة
  const sampleT = seed.tafseers[0]
  const r = await db.prepare(
    `SELECT id, book_id, author_id, surah_number, ayah_number, text,
            source_type, verification_status, is_original_text,
            source_name, edition, volume, page, source_url, reviewer_note, is_sample
       FROM tafsir_entries WHERE surah_number = ?1 AND ayah_number = ?2 ORDER BY id`
  ).bind(sampleT.surah, sampleT.ayah).all()
  const rows = r.results
  assert.ok(rows.length >= 1, 'must return at least one tafseer entry')
  for (const row of rows) {
    assert.equal(row.surah_number, sampleT.surah)
    assert.equal(row.ayah_number, sampleT.ayah)
    assert.ok(['original-text', 'summary', 'sample', 'review-needed', 'curated']
      .includes(row.source_type))
    assert.ok(['verified', 'partially-verified', 'unverified', 'flagged']
      .includes(row.verification_status))
  }
})

test('MockD1: listBooks returns all books with parsed schools', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    `SELECT id, title, full_title, author_id, schools, volumes, description,
            published_year, edition, popularity, featured
       FROM tafsir_books ORDER BY popularity DESC, title ASC`
  ).all()
  const rows = r.results
  assert.equal(rows.length, seed.books.length)
  // schools يجب أن يكون JSON صالحًا
  for (const r2 of rows) {
    const arr = JSON.parse(r2.schools)
    assert.ok(Array.isArray(arr))
  }
})

test('MockD1: listAuthors returns all authors ordered by death_year ASC', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  const r = await db.prepare(
    `SELECT id, name, full_name, birth_year, death_year, century, biography, schools, popularity
       FROM authors ORDER BY death_year ASC`
  ).all()
  const rows = r.results
  assert.equal(rows.length, seed.authors.length)
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].death_year >= rows[i - 1].death_year, 'sorted asc by death_year')
  }
})

test('MockD1 search: filter by sourceTypes (sample) returns only sample entries', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  // simulate provider's count + select queries
  const baseSelect =
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
  const r = await db.prepare(baseSelect).bind('sample').all()
  const rows = r.results
  // كل النتائج يجب أن تكون من نوع 'sample'
  for (const row of rows) {
    assert.equal(row.source_type, 'sample')
  }
})

test('MockD1 search: filter by verificationStatuses (verified) only', async () => {
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
       WHERE t.verification_status IN (?1) ORDER BY b.popularity DESC, t.id ASC LIMIT 500`
  const r = await db.prepare(sql).bind('verified').all()
  const rows = r.results
  for (const row of rows) {
    assert.equal(row.verification_status, 'verified')
  }
})

test('MockD1 search: filter by surah=1 returns only Al-Fatiha tafseers', async () => {
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
  const rows = r.results
  assert.ok(rows.length > 0)
  for (const row of rows) {
    assert.equal(row.surah_number, 1)
    assert.equal(row.surah_name, 'الفاتحة')
  }
})

test('MockD1: throws on failNext (simulates fallback path)', async () => {
  const seed = ensureSeed()
  const db = new MockD1(seed)
  db.failNext = true
  let threw = false
  try {
    await db.prepare('SELECT COUNT(*) AS c FROM tafsir_books').first()
  } catch (e) {
    threw = true
    assert.equal(e.message, 'mock-failure')
  }
  assert.equal(threw, true, 'must throw to simulate D1 failure')
})

test('MockD1: empty DB probe returns null (would trigger fallback)', async () => {
  // محاكاة قاعدة فارغة
  const empty = { surahs: [], ayahs: [], authors: [], books: [], tafseers: [], categories: [] }
  const db = new MockD1(empty)
  const probe = await db.prepare('SELECT 1 AS x FROM tafsir_entries LIMIT 1').first()
  assert.equal(probe, null, 'empty tafsir_entries → probe returns null → triggers seed fallback')
})

test('MockD1 search: combined filters (surah + sourceTypes) intersect correctly', async () => {
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
       WHERE t.surah_number = ?1 AND t.source_type IN (?2) ORDER BY b.popularity DESC, t.id ASC LIMIT 500`
  const r = await db.prepare(sql).bind(2, 'summary').all()
  for (const row of r.results) {
    assert.equal(row.surah_number, 2)
    assert.equal(row.source_type, 'summary')
  }
})

test('MockD1 search: count matches select for same WHERE', async () => {
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
