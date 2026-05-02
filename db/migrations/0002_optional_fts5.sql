-- ===========================================================================
-- تفسير — ترحيل اختياري: FTS5 للبحث النصي الكامل في تفاسير الآيات
-- 0002_optional_fts5.sql  (renamed from 0002_optional_fts.sql)
-- ===========================================================================
-- ⚠️ هذا الترحيل اختياري ويُطبَّق فقط إذا تأكّدت أن وحدة FTS5 متاحة في
-- بيئة Cloudflare D1 لديك. الجداول الأساسية (في 0001) تعمل بدونه.
--
-- =================== خطوات التحقق قبل التطبيق ===================
--
-- 1) تحقّق من دعم FTS5 في بيئتك:
--      wrangler d1 execute tafseer-production --local \
--        --command "SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
--
-- 2) إذا كان FTS5 مدعومًا فستظهر سطر يحتوي ENABLE_FTS5.
--    إذا لم يظهر شيء، تخطَّ هذا الترحيل، وسيستمر البحث عبر LIKE
--    (أبطأ على البيانات الكبيرة لكنه يعمل دائمًا).
--
-- 3) لتطبيق الترحيل بعد التأكّد:
--      npm run db:migrate:local         # محليًا
--      npm run db:migrate:prod          # على الإنتاج
--
-- =================== rollback (إلغاء) ===================
-- DROP TRIGGER IF EXISTS tafsir_entries_au;
-- DROP TRIGGER IF EXISTS tafsir_entries_ad;
-- DROP TRIGGER IF EXISTS tafsir_entries_ai;
-- DROP TABLE IF EXISTS tafsir_entries_fts;
--
-- =================== ملاحظات مهمة ===================
-- - tokenize='unicode61 remove_diacritics 2' يعالج التشكيل العربي تلقائيًا.
-- - content='tafsir_entries' يجعل الجدول الافتراضي يقرأ من الجدول الأصلي،
--   لتقليل تكرار التخزين.
-- - المشغّلات (triggers) تُبقي الفهرس متزامنًا مع الجدول الأصلي تلقائيًا
--   عند الإدخال/الحذف/التعديل.
-- ===========================================================================

-- =============== جدول FTS5 الافتراضي ===============
CREATE VIRTUAL TABLE IF NOT EXISTS tafsir_entries_fts USING fts5 (
  text,
  source_name,
  content='tafsir_entries',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- =============== مشغّلات المزامنة ===============

-- بعد INSERT: نضيف صفًا للفهرس
CREATE TRIGGER IF NOT EXISTS tafsir_entries_ai AFTER INSERT ON tafsir_entries BEGIN
  INSERT INTO tafsir_entries_fts(rowid, text, source_name)
  VALUES (new.rowid, new.text, new.source_name);
END;

-- بعد DELETE: نحذف الصف من الفهرس
CREATE TRIGGER IF NOT EXISTS tafsir_entries_ad AFTER DELETE ON tafsir_entries BEGIN
  INSERT INTO tafsir_entries_fts(tafsir_entries_fts, rowid, text, source_name)
  VALUES ('delete', old.rowid, old.text, old.source_name);
END;

-- بعد UPDATE: حذف ثم إعادة إدراج
CREATE TRIGGER IF NOT EXISTS tafsir_entries_au AFTER UPDATE ON tafsir_entries BEGIN
  INSERT INTO tafsir_entries_fts(tafsir_entries_fts, rowid, text, source_name)
  VALUES ('delete', old.rowid, old.text, old.source_name);
  INSERT INTO tafsir_entries_fts(rowid, text, source_name)
  VALUES (new.rowid, new.text, new.source_name);
END;

-- ===========================================================================
-- إعادة بناء الفهرس بعد استيراد دفعة كبيرة (اختياري — أسرع من التريغرز):
--   INSERT INTO tafsir_entries_fts(tafsir_entries_fts) VALUES('rebuild');
-- ===========================================================================
