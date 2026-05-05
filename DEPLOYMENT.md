# دليل النشر — مشروع تفسير

> **آخر تحديث**: 2026-05-05
> **الإصدار**: v1.10
> **المنصّة المستهدفة**: Cloudflare Pages + D1

---

## 1) ملخّص حالة النشر الحالية

| البند | القيمة | الحالة |
|---|---|:---:|
| البيانات المحلية في D1 | 6,236 آية + 6,333 إدخال تفسير | ✅ |
| الاختبارات | 162 / 162 ناجح | ✅ |
| البناء | dist/_worker.js (348.8 KB) | ✅ |
| المعاينة المحلية | http://localhost:3000 | ✅ |
| رابط معاينة عام (Sandbox) | https://3000-ixhw70i5ce8ki4pbhw9go-18e660f9.sandbox.novita.ai | ✅ |
| النشر الإنتاجي على Cloudflare Pages | **معلَّق — صلاحيات التوكن** | ❌ |

---

## 2) ⚠️ سبب تعليق النشر الإنتاجي

التوكن الحالي (`cfut_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` — مُخفى لأسباب أمنية) صالح لكنه
**لا يملك صلاحيات على حساب Cloudflare** المحدَّد بـ `Account ID: 7ed903da8bafe53b4f1fb3ab4effe9a6`.

### نتائج التحقق

```bash
# التوكن صالح ونشط
GET /user/tokens/verify        → success: true ✅

# الوصول إلى الحساب مرفوض
GET /accounts/7ed903da...      → 9109 Unauthorized to access requested resource ❌
GET /accounts/.../d1/database  → 10000 Authentication error ❌
GET /accounts/.../pages/projects → 10000 Authentication error ❌
GET /accounts/.../workers/scripts → 10000 Authentication error ❌
GET /accounts (list)           → result: []  (التوكن لا يرى أي حساب) ❌
```

### وصف رسالة wrangler

```
✘ A request to the Cloudflare API (/accounts/.../pages/projects/tafseer) failed.
  Authentication error [code: 10000]
👋 You are logged in with an User API Token. Unable to retrieve email for this user.
   Are you missing the `User->User Details->Read` permission?
```

---

## 3) كيفية إصلاح التوكن (مطلوب لإكمال النشر)

اذهب إلى **<https://dash.cloudflare.com/profile/api-tokens>** ← **Create Token**
ثم اختر **Custom token** وأضِف الصلاحيات التالية بالضبط:

### Permissions

| Type     | Resource                 | Access |
|----------|--------------------------|--------|
| Account  | Cloudflare Pages         | Edit   |
| Account  | D1                       | Edit   |
| Account  | Workers Scripts          | Edit   |
| Account  | Account Settings         | Read   |
| User     | User Details             | Read   |

### Account Resources

- **Include** → `<اسم حسابك>` (الحساب صاحب `Account ID: 7ed903da...`)

### Zone Resources

- يمكن تركها على `All zones` أو `Include → All zones from an account`.

ثم اضغط **Continue to summary → Create Token** واحتفظ بالتوكن الجديد.

---

## 4) خطوات النشر بعد الحصول على توكن صالح

استخدم السكريبت الجاهز الذي يقوم بكل الخطوات تلقائيًا:

```bash
export CLOUDFLARE_API_TOKEN="<التوكن الجديد بصلاحيات كاملة>"
export CLOUDFLARE_ACCOUNT_ID="7ed903da8bafe53b4f1fb3ab4effe9a6"

cd /home/user/webapp
bash scripts/deploy/setup-production.sh
```

السكريبت يقوم بـ 10 خطوات متسلسلة:

1. التحقق من التوكن وصلاحياته (Pages, D1, Account access).
2. إنشاء قاعدة D1 الإنتاجية `tafseer-production` إن لم تكن موجودة.
3. تطبيق ترحيلات `db/migrations/` على الإنتاج.
4. رفع `seed-data.sql` (الكتب/المؤلفون/العيّنات الكلاسيكية).
5. رفع `ayahs-full.sql` (القرآن الكامل — 6,236 آية).
6. رفع `tafsir-real.sql` (التفسير الميسر — 6,236 إدخال).
7. التحقق من سلامة البيانات في الإنتاج (`verify-quran-d1` + `verify-tafsir-d1`).
8. بناء المشروع (`npm run build`).
9. إنشاء مشروع Cloudflare Pages إن لم يكن موجودًا.
10. النشر النهائي (`wrangler pages deploy`).

---

## 5) النشر اليدوي (خطوة بخطوة)

إن أردت التنفيذ يدويًا بدلًا من السكريبت:

### 5.1 إنشاء قاعدة D1 الإنتاجية

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="7ed903da8bafe53b4f1fb3ab4effe9a6"

npx wrangler d1 create tafseer-production
# انسخ database_id من المخرجات وضعه في wrangler.jsonc
```

### 5.2 تطبيق الترحيلات على الإنتاج

```bash
npx wrangler d1 migrations apply tafseer-production --remote
```

### 5.3 توليد ملفات الاستيراد إن لم تكن موجودة

```bash
bash scripts/deploy/fetch-quran.sh    # ينزّل القرآن من API ويولّد .imports/quran-full.json
bash scripts/deploy/fetch-tafsir.sh   # ينزّل التفسير الميسر ويولّد .imports/tafsir-real.json
npm run export:seed-sql                # يولّد dist/import/seed-data.sql
node scripts/importers/import-quran.mjs .imports/quran-full.json --full --strict
node scripts/importers/import-tafsir.mjs .imports/tafsir-real.json --strict --filename tafsir-real.sql
```

### 5.4 رفع البيانات إلى الإنتاج

```bash
npx wrangler d1 execute tafseer-production --remote --file=dist/import/seed-data.sql
npx wrangler d1 execute tafseer-production --remote --file=dist/import/ayahs-full.sql
npx wrangler d1 execute tafseer-production --remote --file=dist/import/tafsir-real.sql
```

### 5.5 التحقق من البيانات في الإنتاج

```bash
node scripts/importers/verify-quran-d1.mjs --remote --database tafseer-production --strict
node scripts/importers/verify-tafsir-d1.mjs --remote --database tafseer-production --book muyassar --strict
```

### 5.6 البناء والنشر

```bash
npm run build
npx wrangler pages project create tafseer --production-branch main --compatibility-date 2026-04-13
npx wrangler pages deploy dist --project-name tafseer --branch main --commit-dirty=true
```

---

## 6) اختبار ما بعد النشر

```bash
# يجب أن تُعيد ayahsCount=6236 و tafseersCount≈6333 و mode="d1"
curl https://tafseer.pages.dev/api/stats

# يجب أن تُعيد isComplete: true, coveragePercent: 100
curl https://tafseer.pages.dev/api/quran/coverage

# آية الكرسي بنصها الكامل
curl https://tafseer.pages.dev/api/ayah/2/255

# آخر آية في القرآن + تفسير الميسر الموثَّق
curl https://tafseer.pages.dev/api/ayah/114/6

# بحث في التفاسير
curl "https://tafseer.pages.dev/api/search?q=الرحمن"
```

كل المسارات يجب أن تُعيد JSON صحيحًا و HTTP 200.

---

## 7) المعاينة المحلية الحالية

كحلٍّ مؤقَّت حتى يُحَلّ موضوع التوكن، التطبيق يعمل بالكامل محليًا داخل Sandbox:

- **رابط معاينة عام**: <https://3000-ixhw70i5ce8ki4pbhw9go-18e660f9.sandbox.novita.ai>
- **بيانات حقيقية** في D1 المحلي (6,236 آية + 6,333 إدخال تفسير).
- **كل المسارات تعمل**: `/`, `/read/:n`, `/ayah/:s/:a`, `/dashboard`, `/api/*`, `/robots.txt`, `/sitemap.xml`.
- **رؤوس الأمان مُفعَّلة**: CSP, HSTS, COOP, CORP.

---

## 8) ملخّص الالتزامات الأخيرة (Git)

```
cd18680 feat(import-tafsir): allow institutional authors (isInstitution flag)
14a0f27 feat(v1.9): production-ready data platform — full Quran + real Tafsir al-Muyassar in D1
7bc24bc feat(verify): add verify-tafsir-d1.mjs script + npm scripts
fc8640d feat(tooling): add tafsir importer + data-status report script
2964b4f feat(coverage): extend QuranCoverageSummary + ReadSurahPayload
```

كل التعديلات والوثائق مُلتزَمة ومرفوعة إلى GitHub:
**<https://github.com/hkllmnnx-maker/tafseer>**.
