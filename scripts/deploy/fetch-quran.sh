#!/usr/bin/env bash
# =============================================================================
# fetch-quran.sh — تنزيل القرآن الكامل من AlQuran Cloud وتحويله للصيغة الموحَّدة
# =============================================================================
set -euo pipefail
mkdir -p .imports
python3 <<'PYEOF'
import urllib.request, json, hashlib, pathlib
url = 'https://api.alquran.cloud/v1/quran/quran-uthmani'
req = urllib.request.Request(url, headers={'User-Agent': 'tafseer-importer/1.0'})
with urllib.request.urlopen(req, timeout=60) as r:
    raw = r.read()
pathlib.Path('.imports/quran-uthmani.json').write_bytes(raw)
data = json.loads(raw)
ayahs = []
src_name = 'Quran Uthmani — Tanzil edition (via AlQuran Cloud)'
src_url  = 'https://api.alquran.cloud/v1/quran/quran-uthmani'
for s in data['data']['surahs']:
    sn = s['number']
    for a in s['ayahs']:
        ayahs.append({
            'surah': sn, 'ayah': a['numberInSurah'], 'text': a['text'],
            'juz': a.get('juz'), 'page': a.get('page'),
            'source': src_name, 'sourceUrl': src_url,
        })
out = {'source': src_name, 'sourceUrl': src_url, 'edition': 'quran-uthmani', 'ayahs': ayahs}
text = json.dumps(out, ensure_ascii=False, indent=2)
pathlib.Path('.imports/quran-full.json').write_text(text, encoding='utf-8')
print(f'✓ Quran: {len(ayahs)} ayahs / 114 surahs')
print(f'  SHA-256: {hashlib.sha256(text.encode("utf-8")).hexdigest()}')
PYEOF
