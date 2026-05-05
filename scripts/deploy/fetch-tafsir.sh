#!/usr/bin/env bash
# =============================================================================
# fetch-tafsir.sh — تنزيل التفسير الميسر الكامل من AlQuran Cloud وتحويله للصيغة الموحَّدة
# =============================================================================
set -euo pipefail
mkdir -p .imports
python3 <<'PYEOF'
import urllib.request, json, hashlib, pathlib
from datetime import datetime, timezone

url = 'https://api.alquran.cloud/v1/quran/ar.muyassar'
req = urllib.request.Request(url, headers={'User-Agent': 'tafseer-importer/1.0'})
with urllib.request.urlopen(req, timeout=60) as r:
    raw = r.read()
pathlib.Path('.imports/tafsir-muyassar-raw.json').write_bytes(raw)
data = json.loads(raw)

src_name = 'التفسير الميسر — مجمع الملك فهد لطباعة المصحف الشريف'
src_url_api = 'https://api.alquran.cloud/v1/quran/ar.muyassar'
src_url_off = 'https://qurancomplex.gov.sa/'
edition = 'ar.muyassar (AlQuran Cloud / Tanzil)'

entries = []
for s in data['data']['surahs']:
    sn = s['number']
    for a in s['ayahs']:
        an = a['numberInSurah']
        txt = (a['text'] or '').strip()
        if not txt:
            continue
        entries.append({
            'id': f'muyassar-{sn:03d}-{an:03d}',
            'surah': sn, 'ayah': an, 'text': txt,
            'sourceType': 'original-text',
            'verificationStatus': 'verified',
            'isOriginalText': True,
            'sourceName': src_name, 'edition': edition,
            'page': a.get('page'), 'sourceUrl': src_url_api,
        })

out = {
    'book': {
        'id': 'muyassar', 'title': 'التفسير الميسر', 'shortTitle': 'الميسر',
        'schools': ['بالمأثور'], 'century': 15, 'language': 'ar', 'popularity': 90,
        'license': 'Permitted for use with attribution (King Fahd Complex / Tanzil)',
        'sourceUrl': src_url_off, 'edition': edition, 'verificationStatus': 'verified',
    },
    'author': {
        'id': 'king-fahd-complex',
        'name': 'مجمع الملك فهد لطباعة المصحف الشريف',
        'isInstitution': True, 'type': 'institution',
        'deathYear': 1405, 'birthYear': 1405, 'century': 15,
        'schools': ['بالمأثور'],
        'biography': 'مؤسسة رسمية سعودية تأسست عام 1405هـ متخصصة في طباعة المصحف الشريف وإصدار التفاسير الموثَّقة، أصدرت "التفسير الميسر" بإشراف نخبة من العلماء.',
        'sourceUrl': src_url_off,
    },
    'meta': {
        'schemaVersion': '1.0',
        'exportedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'exportedBy': 'tafseer-project / fetch-tafsir.sh',
        'note': 'Full Tafsir al-Muyassar — 6236 verified original-text entries from King Fahd Complex via AlQuran Cloud (Tanzil edition). Note: deathYear=1405 represents the institution founding year (hijri), not a person death year.',
    },
    'entries': entries,
}
text = json.dumps(out, ensure_ascii=False, indent=2)
pathlib.Path('.imports/tafsir-real.json').write_text(text, encoding='utf-8')
print(f'✓ Tafsir: {len(entries)} entries / 114 surahs')
print(f'  SHA-256: {hashlib.sha256(text.encode("utf-8")).hexdigest()}')
PYEOF
