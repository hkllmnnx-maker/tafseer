-- ===========================================================================
-- 0003_ayah_sources.sql — إضافة حقول المصدر (اختيارية) لجدول ayahs
-- ===========================================================================
-- يُفعِّل هذا الترحيل تتبّع مصدر نص الآية حين يُستورد القرآن من ملف JSON
-- خارجي عبر `npm run import:quran -- --full --strict`. الحقول كلها اختيارية
-- (NULL مسموح) حتى لا ينكسر seed الحالي ولا الـ INSERT القديمة.
--
-- لا يُعدِّل أيّ بيانات موجودة. لا يحذف أعمدة. لا يكسر استعلامات seed.
--
-- بعد تطبيقه:
--   - يستطيع import-quran.mjs كتابة source_name / source_url / edition / 
--     imported_from / imported_at لكل آية مستوردة.
--   - seed-data.sql القديم (الذي لا يكتب هذه الحقول) سيستمر بالعمل لأنها
--     كلها NULLable.
--
-- التراجع (manual rollback):
--   ALTER TABLE ayahs DROP COLUMN imported_at;
--   ALTER TABLE ayahs DROP COLUMN imported_from;
--   ALTER TABLE ayahs DROP COLUMN edition;
--   ALTER TABLE ayahs DROP COLUMN source_url;
--   ALTER TABLE ayahs DROP COLUMN source_name;
-- (DROP COLUMN مدعوم في SQLite >= 3.35 — Cloudflare D1 الحالي يدعمه.)
-- ===========================================================================

-- نُضيف الحقول واحدًا تلو الآخر عبر ALTER TABLE … ADD COLUMN.
-- لا توجد طريقة "IF NOT EXISTS" لـ ADD COLUMN في SQLite، ولا حاجة لها هنا
-- لأن نظام wrangler migrations يضمن أن كل ترحيل يُطبَّق مرّة واحدة فقط
-- (يُتتبَّع في جدول d1_migrations الداخلي).

ALTER TABLE ayahs ADD COLUMN source_name   TEXT;
ALTER TABLE ayahs ADD COLUMN source_url    TEXT;
ALTER TABLE ayahs ADD COLUMN edition       TEXT;
ALTER TABLE ayahs ADD COLUMN imported_from TEXT;
ALTER TABLE ayahs ADD COLUMN imported_at   TEXT;

-- فهرس على المصدر (اختياري لكن مفيد للتدقيق العلمي)
CREATE INDEX IF NOT EXISTS idx_ayahs_source_name ON ayahs(source_name);
CREATE INDEX IF NOT EXISTS idx_ayahs_imported_at ON ayahs(imported_at);
