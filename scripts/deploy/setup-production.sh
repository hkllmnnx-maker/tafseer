#!/usr/bin/env bash
# =============================================================================
# setup-production.sh — إعداد ونشر مشروع تفسير على Cloudflare Pages + D1
# =============================================================================
#
# هذا السكريبت يقوم بـ:
#   1) التحقق من توكن Cloudflare وصلاحياته.
#   2) إنشاء قاعدة D1 الإنتاجية (tafseer-production) إذا لم تكن موجودة.
#   3) تطبيق الترحيلات (db/migrations) على القاعدة الإنتاجية.
#   4) رفع بيانات الـ seed (الكتب/المؤلفون/العيّنات) إلى الإنتاج.
#   5) رفع القرآن الكامل (6,236 آية) إلى الإنتاج.
#   6) رفع التفسير الميسر الكامل (6,236 إدخال) إلى الإنتاج.
#   7) بناء المشروع.
#   8) إنشاء مشروع Pages إن لم يكن موجودًا، ثم النشر.
#
# المتطلبات:
#   - export CLOUDFLARE_API_TOKEN="..."   (توكن بصلاحيات:
#         Account: D1:Edit, Pages:Edit, Workers Scripts:Edit, Account Settings:Read
#         User: User Details:Read)
#   - export CLOUDFLARE_ACCOUNT_ID="..."
#   - وجود ملفات .imports/quran-full.json و .imports/tafsir-real.json
#     (وإلا يُعاد توليدها تلقائيًا من API).
#
# الاستخدام:
#   bash scripts/deploy/setup-production.sh
#
# تنبيه أمني: لا تمرّر التوكنات في سطر الأوامر — استخدم متغيّرات البيئة فقط.
# =============================================================================

set -euo pipefail

# ----- ألوان طرفية -----
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

log()   { printf "%s▶ %s%s\n" "$BLUE" "$1" "$NC"; }
ok()    { printf "%s✓ %s%s\n" "$GREEN" "$1" "$NC"; }
warn()  { printf "%s⚠ %s%s\n" "$YELLOW" "$1" "$NC"; }
err()   { printf "%s✗ %s%s\n" "$RED" "$1" "$NC" >&2; }
hr()    { printf "%s%s%s\n" "$DIM" "──────────────────────────────────────────────────────────" "$NC"; }

PROJECT_NAME="${PROJECT_NAME:-tafseer}"
DB_NAME="${DB_NAME:-tafseer-production}"
PRODUCTION_BRANCH="${PRODUCTION_BRANCH:-main}"

# =============================================================================
# 1) التحقق من المتغيرات والصلاحيات
# =============================================================================
log "1) التحقق من توكن Cloudflare وصلاحياته"
hr

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  err "CLOUDFLARE_API_TOKEN غير مُعرَّف. صدّره أولًا:"
  echo "   export CLOUDFLARE_API_TOKEN=\"<your-token>\""
  exit 2
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  err "CLOUDFLARE_ACCOUNT_ID غير مُعرَّف. صدّره أولًا:"
  echo "   export CLOUDFLARE_ACCOUNT_ID=\"<your-account-id>\""
  exit 2
fi

# 1.a verify token
verify=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
         -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
if echo "$verify" | grep -q '"success":true'; then
  ok "التوكن صالح (active)."
else
  err "التوكن غير صالح:"; echo "$verify" | head -c 400; echo; exit 3
fi

# 1.b verify account access
acct=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID" \
       -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
if echo "$acct" | grep -q '"success":true'; then
  ok "الوصول إلى الحساب مُتاح."
else
  err "الوصول إلى الحساب مرفوض. التوكن لا يملك صلاحيات على هذا الحساب."
  echo "$acct" | head -c 400; echo
  echo
  warn "الحلّ: أنشئ توكن جديد من https://dash.cloudflare.com/profile/api-tokens"
  echo "    استخدم القالب \"Edit Cloudflare Workers\" أو أنشئ توكن مخصّصًا بالصلاحيات:"
  echo "      Account → Cloudflare Pages → Edit"
  echo "      Account → D1 → Edit"
  echo "      Account → Workers Scripts → Edit"
  echo "      Account → Account Settings → Read"
  echo "      User → User Details → Read"
  echo "      Account Resources → Include → <الحساب>"
  exit 3
fi

# 1.c verify D1 + Pages permissions
d1_list=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database" \
          -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
if echo "$d1_list" | grep -q '"success":true'; then
  ok "صلاحية D1 متوفرة."
else
  err "صلاحية D1 غير متوفرة. أضف \"D1:Edit\" للتوكن."; exit 3
fi

pg_list=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects" \
          -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
if echo "$pg_list" | grep -q '"success":true'; then
  ok "صلاحية Pages متوفرة."
else
  err "صلاحية Pages غير متوفرة. أضف \"Pages:Edit\" للتوكن."; exit 3
fi
echo

# =============================================================================
# 2) إنشاء قاعدة D1 الإنتاجية إذا لم تكن موجودة
# =============================================================================
log "2) التحقق/إنشاء قاعدة D1 الإنتاجية ($DB_NAME)"
hr

existing_db=$(echo "$d1_list" | grep -oE "\"name\":\"$DB_NAME\"" || true)
if [ -n "$existing_db" ]; then
  ok "قاعدة $DB_NAME موجودة بالفعل."
  # Extract the database_id
  DB_ID=$(echo "$d1_list" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for db in data.get('result', []):
    if db.get('name') == '$DB_NAME':
        print(db.get('uuid', ''))
        break
")
else
  log "إنشاء قاعدة $DB_NAME ..."
  create=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database" \
           -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
           -H "Content-Type: application/json" \
           --data "{\"name\":\"$DB_NAME\"}")
  if echo "$create" | grep -q '"success":true'; then
    DB_ID=$(echo "$create" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['result']['uuid'])")
    ok "تم إنشاء $DB_NAME (id=$DB_ID)."
  else
    err "فشل إنشاء القاعدة:"; echo "$create" | head -c 400; echo; exit 4
  fi
fi
echo "DB_ID=$DB_ID"

# 2.b تحديث wrangler.jsonc بقيمة database_id الحقيقية (نسخة محلية فقط)
if [ -n "${DB_ID:-}" ] && [ "$DB_ID" != "00000000-0000-0000-0000-000000000000" ]; then
  log "تحديث wrangler.jsonc بـ database_id الحقيقي"
  python3 <<PYEOF
import re, pathlib
p = pathlib.Path('wrangler.jsonc')
text = p.read_text(encoding='utf-8')
new = re.sub(r'"database_id":\s*"[^"]*"', f'"database_id": "$DB_ID"', text)
p.write_text(new, encoding='utf-8')
print("✓ wrangler.jsonc updated")
PYEOF
fi
echo

# =============================================================================
# 3) تطبيق الترحيلات على الإنتاج
# =============================================================================
log "3) تطبيق ترحيلات db/migrations على الإنتاج"
hr
npx wrangler d1 migrations apply "$DB_NAME" --remote 2>&1 | tail -10
ok "الترحيلات طُبِّقت."
echo

# =============================================================================
# 4) رفع بيانات الـ seed (الكتب/المؤلفون/العيّنات الكلاسيكية)
# =============================================================================
log "4) رفع seed-data.sql إلى الإنتاج"
hr
if [ ! -f dist/import/seed-data.sql ]; then
  log "توليد seed-data.sql ..."
  npm run export:seed-sql
fi
npx wrangler d1 execute "$DB_NAME" --remote --file=dist/import/seed-data.sql 2>&1 | tail -5
ok "seed-data رُفع."
echo

# =============================================================================
# 5) رفع القرآن الكامل (6,236 آية)
# =============================================================================
log "5) رفع القرآن الكامل إلى الإنتاج"
hr
if [ ! -f dist/import/ayahs-full.sql ]; then
  if [ ! -f .imports/quran-full.json ]; then
    err ".imports/quran-full.json غير موجود."
    echo "   شغّل: bash scripts/deploy/fetch-quran.sh"
    exit 5
  fi
  npm run import:quran -- .imports/quran-full.json --full --strict
fi
log "تنفيذ ayahs-full.sql على الإنتاج (قد يستغرق دقائق)..."
npx wrangler d1 execute "$DB_NAME" --remote --file=dist/import/ayahs-full.sql 2>&1 | tail -5
ok "القرآن الكامل (6,236 آية) رُفع."
echo

# =============================================================================
# 6) رفع التفسير الميسر الكامل (6,236 إدخال)
# =============================================================================
log "6) رفع التفسير الميسر الكامل إلى الإنتاج"
hr
if [ ! -f dist/import/tafsir-real.sql ]; then
  if [ ! -f .imports/tafsir-real.json ]; then
    err ".imports/tafsir-real.json غير موجود."
    echo "   شغّل: bash scripts/deploy/fetch-tafsir.sh"
    exit 6
  fi
  node scripts/importers/import-tafsir.mjs .imports/tafsir-real.json --strict --filename tafsir-real.sql
fi
log "تنفيذ tafsir-real.sql على الإنتاج (قد يستغرق دقائق)..."
npx wrangler d1 execute "$DB_NAME" --remote --file=dist/import/tafsir-real.sql 2>&1 | tail -5
ok "التفسير الميسر الكامل (6,236 إدخال) رُفع."
echo

# =============================================================================
# 7) التحقق من حالة البيانات في الإنتاج
# =============================================================================
log "7) التحقق من سلامة البيانات في الإنتاج"
hr
node scripts/importers/verify-quran-d1.mjs --remote --database "$DB_NAME" --strict 2>&1 | tail -5
node scripts/importers/verify-tafsir-d1.mjs --remote --database "$DB_NAME" --book muyassar --strict 2>&1 | tail -5
echo

# =============================================================================
# 8) بناء المشروع
# =============================================================================
log "8) بناء المشروع (npm run build)"
hr
npm run build
ok "البناء اكتمل في dist/"
echo

# =============================================================================
# 9) إنشاء مشروع Pages إن لم يكن موجودًا
# =============================================================================
log "9) إنشاء/التحقق من مشروع Cloudflare Pages ($PROJECT_NAME)"
hr
existing_proj=$(echo "$pg_list" | grep -oE "\"name\":\"$PROJECT_NAME\"" || true)
if [ -n "$existing_proj" ]; then
  ok "مشروع $PROJECT_NAME موجود بالفعل."
else
  log "إنشاء مشروع Pages جديد ..."
  npx wrangler pages project create "$PROJECT_NAME" \
    --production-branch "$PRODUCTION_BRANCH" \
    --compatibility-date 2026-04-13 2>&1 | tail -5
  ok "مشروع $PROJECT_NAME أُنشئ."
fi
echo

# =============================================================================
# 10) النشر
# =============================================================================
log "10) النشر على Cloudflare Pages"
hr
npx wrangler pages deploy dist \
  --project-name "$PROJECT_NAME" \
  --branch "$PRODUCTION_BRANCH" \
  --commit-dirty=true 2>&1 | tail -15
echo

ok "🎉 النشر اكتمل بنجاح."
echo
echo "${BOLD}الروابط المتوقعة:${NC}"
echo "  - Production: https://${PRODUCTION_BRANCH}.${PROJECT_NAME}.pages.dev"
echo "  - Project:    https://${PROJECT_NAME}.pages.dev"
echo
echo "${BOLD}اختبر بـ:${NC}"
echo "  curl https://${PROJECT_NAME}.pages.dev/api/stats"
echo "  curl https://${PROJECT_NAME}.pages.dev/api/quran/coverage"
echo "  curl https://${PROJECT_NAME}.pages.dev/api/ayah/2/255"
