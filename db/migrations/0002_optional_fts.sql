-- ===========================================================================
-- تفسير — ترحيل اختياري: FTS5 للبحث النصي الكامل في تفاسير الآيات
-- ===========================================================================
-- ⚠️ هذا الترحيل اختياري ويُطبَّق فقط إذا تأكّدت أن وحدة FTS5 متاحة في
-- بيئة Cloudflare D1 لديك. الجداول الأساسية (في 0001) تعمل بدونه.
--
-- للتحقّق محليًا قبل التطبيق:
--   wrangler d1 execute tafseer-production --local \
--     --command "SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
--
-- إذا لم تكن FTS5 مدعومة، تخطَّ هذا الملف، وسيستمر البحث عبر LIKE
-- على عمود tafsir_entries.text + الفهارس الموجودة (أبطأ على البيانات الكبيرة
-- لكنه يعمل دائمًا).
--
-- لإلغاء هذا الترحيل (rollback):
--   DROP TRIGGER IF EXISTS tafsir_entries_au;
--   DROP TRIGGER IF EXISTS tafsir_entries_ad;
--   DROP TRIGGER IF EXISTS tafsir_entries_ai;
--   DROP TABLE IF EXISTS tafsir_entries_fts;
-- ===========================================================================

-- =============== جدول FTS5 الافتراضي ===============
-- يخزّن الفهرس النصي على نص التفسير + اسم المصدر
-- tokenize='unicode61 remove_diacritics 2' يطبّع التشكيل العربي
CREATE VIRTUAL TABLE IF NOT EXISTS tafsir_entries_fts USING fts5 (
  text,
  source_name,
  content='tafsir_entries',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- =============== مزامنة FTS مع الجدول الأصلي ===============
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

-- ===========================================================================
-- ملاحظة: عند استيراد دفعة كبيرة دفعة واحدة، يُفضَّل تعطيل المشغّلات
-- مؤقتًا واستعمال:
--   INSERT INTO tafsir_entries_fts(tafsir_entries_fts) VALUES('rebuild');
-- لإعادة بناء الفهرس بسرعة بعد الانتهاء.
-- ===========================================================================
