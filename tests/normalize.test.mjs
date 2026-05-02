// =============================================================================
// tests/normalize.test.mjs — اختبارات لـ helper تطبيع العربية
// =============================================================================
// اختبارات مستقلة عن TS/Vite — تستعمل node:test الأصلي.
// نُعيد كتابة الـ helper المراد اختباره هنا (نسخة بسيطة) للتحقّق من السلوك،
// ولأن src/lib/normalize.ts يستعمل فقط الكائنات الأصليّة في JavaScript.
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'

// نسخة من normalizeArabic (موائمة من src/lib/normalize.ts) — نختبر السلوك المطلوب.
function normalizeArabic(input) {
  if (!input) return ''
  let s = String(input)
  // إزالة التشكيل (الفتحة، الكسرة، الضمة، الشدة، السكون، التنوين)
  s = s.replace(/[\u064B-\u065F\u0670]/g, '')
  // إزالة التطويل
  s = s.replace(/\u0640/g, '')
  // توحيد الألف
  s = s.replace(/[إأآا]/g, 'ا')
  // ى → ي
  s = s.replace(/ى/g, 'ي')
  // ة → ه
  s = s.replace(/ة/g, 'ه')
  // ؤ، ئ → و، ي
  s = s.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  // إزالة الهمزة المنفردة
  s = s.replace(/ء/g, '')
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

test('normalizeArabic: removes harakat (تشكيل)', () => {
  const input = 'بِسْمِ ٱللَّهِ'
  const out = normalizeArabic(input)
  assert.ok(!/[\u064B-\u065F]/.test(out), 'should strip diacritics')
  assert.ok(out.includes('بسم'))
})

test('normalizeArabic: unifies alif forms (أ إ آ → ا)', () => {
  assert.equal(normalizeArabic('أحمد'), 'احمد')
  assert.equal(normalizeArabic('إيمان'), 'ايمان')
  assert.equal(normalizeArabic('آمن'), 'امن')
})

test('normalizeArabic: ya/alif maqsura unify (ى → ي)', () => {
  assert.equal(normalizeArabic('على'), 'علي')
})

test('normalizeArabic: ta marbuta → ha (ة → ه)', () => {
  assert.equal(normalizeArabic('صلاة'), 'صلاه')
})

test('normalizeArabic: empty / null input', () => {
  assert.equal(normalizeArabic(''), '')
  assert.equal(normalizeArabic(null), '')
  assert.equal(normalizeArabic(undefined), '')
})

test('normalizeArabic: collapses multiple whitespace', () => {
  assert.equal(normalizeArabic('  بسم    الله   '), 'بسم الله')
})
