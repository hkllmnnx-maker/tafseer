-- ===========================================================================
-- تفسير — ترحيل أوّلي لقاعدة بيانات Cloudflare D1
-- يحاكي بنية البيانات الحالية في src/data/* مع إضافة جداول الاستيراد والتدقيق.
-- جميع الأعمدة النصية UTF-8، والجداول تستعمل INTEGER PRIMARY KEY حيث يلزم.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- =============== 1) السور ===============
CREATE TABLE IF NOT EXISTS surahs (
  number       INTEGER PRIMARY KEY CHECK (number BETWEEN 1 AND 114),
  name         TEXT NOT NULL,
  name_latin   TEXT NOT NULL,
  ayah_count   INTEGER NOT NULL CHECK (ayah_count > 0 AND ayah_count <= 286),
  type         TEXT NOT NULL CHECK (type IN ('مكية', 'مدنية')),
  revelation_order INTEGER NOT NULL CHECK (revelation_order BETWEEN 1 AND 114),
  UNIQUE (revelation_order)
);

CREATE INDEX IF NOT EXISTS idx_surahs_type ON surahs(type);

-- =============== 2) الآيات ===============
CREATE TABLE IF NOT EXISTS ayahs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  surah_number INTEGER NOT NULL,
  ayah_number  INTEGER NOT NULL CHECK (ayah_number >= 1),
  text         TEXT NOT NULL,
  juz          INTEGER CHECK (juz IS NULL OR juz BETWEEN 1 AND 30),
  page         INTEGER CHECK (page IS NULL OR (page >= 1 AND page <= 700)),
  UNIQUE (surah_number, ayah_number),
  FOREIGN KEY (surah_number) REFERENCES surahs(number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ayahs_surah ON ayahs(surah_number);
CREATE INDEX IF NOT EXISTS idx_ayahs_ayah ON ayahs(ayah_number);
CREATE INDEX IF NOT EXISTS idx_ayahs_surah_ayah ON ayahs(surah_number, ayah_number);
CREATE INDEX IF NOT EXISTS idx_ayahs_juz ON ayahs(juz);

-- =============== 3) المؤلفون ===============
CREATE TABLE IF NOT EXISTS authors (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  full_name    TEXT,
  birth_year   INTEGER,
  death_year   INTEGER NOT NULL CHECK (death_year > 0 AND death_year < 1500),
  century      INTEGER NOT NULL CHECK (century BETWEEN 1 AND 15),
  biography    TEXT,
  schools      TEXT, -- JSON array
  popularity   INTEGER DEFAULT 5 CHECK (popularity BETWEEN 1 AND 10),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_authors_century ON authors(century);
CREATE INDEX IF NOT EXISTS idx_authors_death ON authors(death_year);

-- =============== 4) كتب التفسير ===============
CREATE TABLE IF NOT EXISTS tafsir_books (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  full_title    TEXT,
  author_id     TEXT NOT NULL,
  schools       TEXT, -- JSON array of TafseerSchool
  volumes       INTEGER CHECK (volumes IS NULL OR volumes > 0),
  description   TEXT,
  published_year INTEGER,
  edition       TEXT,
  popularity    INTEGER DEFAULT 5 CHECK (popularity BETWEEN 1 AND 10),
  featured      INTEGER DEFAULT 0 CHECK (featured IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_books_author ON tafsir_books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_featured ON tafsir_books(featured);
CREATE INDEX IF NOT EXISTS idx_books_popularity ON tafsir_books(popularity);

-- =============== 5) إدخالات التفسير ===============
-- العمود الأهم في القاعدة. كل صف = نص تفسير لآية واحدة من كتاب واحد.
CREATE TABLE IF NOT EXISTS tafsir_entries (
  id                   TEXT PRIMARY KEY,
  book_id              TEXT NOT NULL,
  author_id            TEXT NOT NULL,
  surah_number         INTEGER NOT NULL,
  ayah_number          INTEGER NOT NULL CHECK (ayah_number >= 1),
  text                 TEXT NOT NULL CHECK (length(text) >= 5),

  -- التوثيق العلمي (إلزامي)
  source_type          TEXT NOT NULL CHECK (source_type IN
    ('original-text', 'summary', 'sample', 'review-needed', 'curated')),
  verification_status  TEXT NOT NULL CHECK (verification_status IN
    ('verified', 'partially-verified', 'unverified', 'flagged')),
  is_original_text     INTEGER NOT NULL DEFAULT 0 CHECK (is_original_text IN (0, 1)),

  -- بيانات المصدر
  source_name          TEXT,
  edition              TEXT,
  volume               INTEGER,
  page                 INTEGER,
  source_url           TEXT,
  reviewer_note        TEXT,

  -- علم البيانات
  is_sample            INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),
  imported_from        TEXT,        -- اسم وظيفة الاستيراد
  imported_at          TEXT,        -- ISO timestamp
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (book_id) REFERENCES tafsir_books(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT,
  FOREIGN KEY (surah_number) REFERENCES surahs(number) ON DELETE CASCADE,
  UNIQUE (book_id, surah_number, ayah_number, source_name) -- يمنع التكرار الكامل
);

CREATE INDEX IF NOT EXISTS idx_entries_surah ON tafsir_entries(surah_number);
CREATE INDEX IF NOT EXISTS idx_entries_ayah ON tafsir_entries(ayah_number);
CREATE INDEX IF NOT EXISTS idx_entries_book ON tafsir_entries(book_id);
CREATE INDEX IF NOT EXISTS idx_entries_author ON tafsir_entries(author_id);
CREATE INDEX IF NOT EXISTS idx_entries_source_type ON tafsir_entries(source_type);
CREATE INDEX IF NOT EXISTS idx_entries_verification ON tafsir_entries(verification_status);
CREATE INDEX IF NOT EXISTS idx_entries_surah_ayah ON tafsir_entries(surah_number, ayah_number);
CREATE INDEX IF NOT EXISTS idx_entries_book_surah_ayah ON tafsir_entries(book_id, surah_number, ayah_number);

-- =============== 6) الموضوعات ===============
CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT,
  color        TEXT,
  parent_id    TEXT,
  sort_order   INTEGER DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- =============== 7) ربط الكتب بالموضوعات (many-to-many) ===============
CREATE TABLE IF NOT EXISTS book_categories (
  book_id     TEXT NOT NULL,
  category_id TEXT NOT NULL,
  weight      INTEGER DEFAULT 1,
  PRIMARY KEY (book_id, category_id),
  FOREIGN KEY (book_id) REFERENCES tafsir_books(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookcat_book ON book_categories(book_id);
CREATE INDEX IF NOT EXISTS idx_bookcat_category ON book_categories(category_id);

-- =============== 8) مهام الاستيراد ===============
CREATE TABLE IF NOT EXISTS import_jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_label  TEXT NOT NULL,
  source_url    TEXT,
  status        TEXT NOT NULL CHECK (status IN
    ('queued', 'running', 'success', 'partial', 'failed', 'rolled_back')),
  total_count   INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  error_count   INTEGER DEFAULT 0,
  notes         TEXT,
  started_by    TEXT,                     -- معرّف مستخدم/مشغّل
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  rejection_log TEXT                      -- JSON
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_started ON import_jobs(started_at DESC);

-- =============== 9) سجل التدقيق ===============
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT,                       -- نظام أو مستخدم
  action      TEXT NOT NULL,              -- create | update | delete | import | review
  entity_type TEXT NOT NULL,              -- ayah | tafsir_entry | book | author | ...
  entity_id   TEXT NOT NULL,
  before_json TEXT,
  after_json  TEXT,
  ip_hash     TEXT,                       -- مُجزّأ لا يكشف هوية
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- =============== 10) FTS5 للبحث في نصوص التفاسير (اختياري) ===============
-- يُفعّل في D1 إن دعم البيئة وحدة FTS5. إن لم تدعمها، احذف هذا القسم.
CREATE VIRTUAL TABLE IF NOT EXISTS tafsir_entries_fts USING fts5 (
  text,
  source_name,
  content='tafsir_entries',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- مزامنة FTS مع الجدول الأصلي عبر مشغّلات
CREATE TRIGGER IF NOT EXISTS tafsir_entries_ai AFTER INSERT ON tafsir_entries BEGIN
  INSERT INTO tafsir_entries_fts(rowid, text, source_name)
  VALUES (new.rowid, new.text, new.source_name);
END;
CREATE TRIGGER IF NOT EXISTS tafsir_entries_ad AFTER DELETE ON tafsir_entries BEGIN
  INSERT INTO tafsir_entries_fts(tafsir_entries_fts, rowid, text, source_name)
  VALUES ('delete', old.rowid, old.text, old.source_name);
END;
CREATE TRIGGER IF NOT EXISTS tafsir_entries_au AFTER UPDATE ON tafsir_entries BEGIN
  INSERT INTO tafsir_entries_fts(tafsir_entries_fts, rowid, text, source_name)
  VALUES ('delete', old.rowid, old.text, old.source_name);
  INSERT INTO tafsir_entries_fts(rowid, text, source_name)
  VALUES (new.rowid, new.text, new.source_name);
END;
