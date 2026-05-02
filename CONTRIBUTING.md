# دليل المساهمة — تفسير

شكرًا لاهتمامك بالمساهمة في منصّة **تفسير**. هذا الدليل يشرح كيفية المساهمة في الكود والبيانات والتوثيق.

---

## 1) كيف تبدأ

### المتطلبات
- Node.js ≥ 18
- npm ≥ 9
- حساب GitHub

### إعداد البيئة المحلية
```bash
git clone https://github.com/hkllmnnx-maker/tafseer.git
cd tafseer
npm install
npm run build
npm run dev:sandbox   # على المنفذ 3000
```

ثم افتح: http://localhost:3000

---

## 2) أنواع المساهمات

### 2.1 إصلاح خطأ (Bug Fix)
1. افتح Issue يصف الخطأ مع خطوات إعادة الإنتاج.
2. أنشئ فرعًا: `fix/<short-description>`.
3. أضف اختبارًا (إن أمكن) يُعيد إنتاج الخطأ.
4. أصلح الخطأ ثم تأكد من نجاح `npm run build`.
5. ارفع PR إلى `main`.

### 2.2 ميزة جديدة (Feature)
1. افتح Issue للمناقشة قبل البدء.
2. أنشئ فرعًا: `feat/<short-description>`.
3. اتبع نمط الكود الحالي (Hono + JSX + CSS Variables).
4. حدّث `README.md` و`CHANGELOG.md`.
5. ارفع PR.

### 2.3 إضافة بيانات تفسير
هذه أهم أنواع المساهمات. اتبع `docs/importing-data.md`:
1. جهّز ملف JSON يطابق المخطط.
2. شغّل: `npm run validate:import -- path/to/file.json --dry-run`.
3. ضع الملف في `fixtures/imports/<source>-<date>.json`.
4. ارفع PR مع وصف المصدر والترخيص.

> **تحذير الترخيص**: تأكد أن المصدر متاح بترخيص يسمح بالنشر (Public Domain أو Creative Commons أو إذن صريح). نصوص التفاسير الكلاسيكية الأصلية في الغالب من المُلك العام.

### 2.4 تحسين التوثيق
- `README.md` للمحتوى العام.
- `docs/*.md` للمواضيع المتخصّصة.
- استخدم لغة عربية فصحى واضحة.

---

## 3) معايير الكود

### 3.1 العام
- TypeScript صارم؛ تجنّب `any` ما أمكن.
- لا تضِف مكتبات ثقيلة دون مناقشة.
- اتّبع `eslint`/`tsconfig` الموجودين.

### 3.2 Hono
- المسارات في `src/index.tsx`.
- المكوّنات في `src/components/*` (إن وُجد) أو inline.
- استخدم `c.html(<Page>...</Page>)` مع renderer.

### 3.3 الواجهة (RTL)
- لا تَستخدم Bootstrap. اعتمد متغيرات CSS في `public/static/style.css`.
- اختبر دومًا في الوضع الليلي والنهاري.
- تأكّد من اتجاه RTL في كل عنصر تفاعلي.

### 3.4 الأمان
- لا تُضِف `unsafe-inline` أو `unsafe-eval` لـ CSP.
- لا تَكشِف رسائل أخطاء داخلية للمستخدم.
- راجِع `docs/security.md` قبل تعديل أي رؤوس أمان.

---

## 4) رسائل الـ Commit

نستخدم Conventional Commits:

| النوع | المعنى |
|-------|--------|
| `feat:` | ميزة جديدة |
| `fix:` | إصلاح خطأ |
| `docs:` | توثيق فقط |
| `style:` | تنسيق بدون تغيير منطق |
| `refactor:` | إعادة هيكلة |
| `perf:` | أداء |
| `test:` | اختبارات |
| `chore:` | مهام صيانة |
| `ci:` | تكوين CI |
| `db:` | تغييرات قاعدة البيانات |

أمثلة:
```
feat(search): add fuzzy matching toggle
fix(ayah): correct copy button on mobile
docs(roadmap): update Q4 milestones
db: add index on tafseers.book_id
```

---

## 5) عملية الـ Pull Request

1. تأكّد من أن الـ CI ناجح (badge في README).
2. اطلب مراجعة من المالكين.
3. حدّث `CHANGELOG.md` تحت قسم `[Unreleased]`.
4. PR Description يحتوي:
   - **ما الذي تغيّر؟**
   - **لماذا؟**
   - **كيف تختبره؟**
   - لقطات شاشة (للتغييرات البصرية).

---

## 6) قواعد السلوك

نلتزم بـ [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). كن محترمًا، بنّاء النقد، ولا تَنشُر معلومات شخصية للآخرين.

---

## 7) الترخيص

بمساهمتك، فأنت توافق على نشر مساهمتك تحت نفس ترخيص المشروع.

---

## 8) أين تجد المساعدة؟

- **Issues**: https://github.com/hkllmnnx-maker/tafseer/issues
- **Discussions**: قسم Discussions في GitHub.
- **التوثيق**: `docs/` و`README.md`.
