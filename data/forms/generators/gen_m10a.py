"""Erzeugt data/forms/muster-10a.json (Anforderungsschein Laborgemeinschaft). Ankreuz-Ovale je Untersuchung aus der Mustersammlung (Seite 21).
python data/forms/generators/gen_m10a.py data/forms/sources/kbv-mustersammlung-2026-05.pdf ."""
import json
import re
import sys

import pymupdf as fitz

pdf, root = sys.argv[1], sys.argv[2]
page = fitz.open(pdf)[20]
W, H = page.rect.width, page.rect.height
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '10A' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


spans = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            t = s['text'].strip()
            if t:
                spans.append((s['bbox'][0] / W * 100, s['bbox'][1] / H * 100, t))

# Ankreuz-Ovale aus der Geometrie (extract_layout.py); Beschriftung steht rechts daneben.
lay = json.load(open(f'{root}/data/forms/layout/muster-10a.json', encoding='utf-8'))
ovals = [(s['rect'][0] / W * 100, s['rect'][1] / H * 100, s['rect'][2] / W * 100, s['rect'][3] / H * 100) for s in lay['strokes'] if s.get('r')]
TEXT_COL = sorted({round(o[0] + 3.6, 1) for o in ovals})
nums = []
for x, y, t in spans:
    if re.fullmatch(r'\d{1,2}', t) and y >= 45 and x >= 20:
        cx = max(c for c in TEXT_COL if c < x)
        oval = min((o for o in ovals if abs(o[0] + 3.6 - cx) < 1 and abs(o[1] + o[3] / 2 - (y + 0.9)) < 1.4), key=lambda o: abs(o[1] - y))
        nums.append(((cx, oval), y, int(t)))
items = []
for col, y, nr in nums:
    label = [s for s in spans if abs(s[1] - y) < 0.6 and abs(s[0] - col[0]) < 1.0]
    if not label:
        continue
    text = label[0][2]
    # Zweite Zeile nur, wenn in dieser Spalte darunter keine eigene Nummer steht.
    nxt = [s for s in spans if 0.6 < s[1] - y < 3.2 and abs(s[0] - col[0]) < 1.0 and not re.fullmatch(r'\d+', s[2])
           and not any(c[0] == col[0] and abs(yy - s[1]) < 0.6 for c, yy, _ in nums)]
    if nxt:
        text = f'{text} {nxt[0][2]}'.replace('- ', '-')
        third = [s for s in spans if 0.6 < s[1] - nxt[0][1] < 2.6 and abs(s[0] - col[0]) < 1.0] if text.endswith('-') else []
        if third:  # „Quick unter Marcumar-Therapie“ steht auf drei Zeilen
            text += third[0][2]
    text = {'Nüchternplasma-glukose': 'Nüchternplasmaglukose', 'Kreatinin Clearance': 'Kreatinin-Clearance', 'Eiweiß Elektrophorese': 'Eiweiß-Elektrophorese'}.get(text.split(' (')[0], text.split(' (')[0]) + (' (' + text.split(' (', 1)[1] if ' (' in text else '')
    # Materialüberschriften des Vordrucks (Urin, Glukose-Profil) gehören zur Bezeichnung.
    if 55 <= nr <= 60:
        text = f'Urin: {text}'
    elif 51 <= nr <= 54:
        text = f'Glukose-Profil: {text}'
    items.append((nr, text, col[1], None))
items.sort()

fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', (4.4, 3.5, 38.0, 31.6),
  [rule('m10a.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('kurativ', 'Kurativ', 'checkbox', 'praxis', (44.3, 11.6, 2.3, 3.4), [], group='art', marker='❶')
f('praeventiv', 'Präventiv', 'checkbox', 'praxis', (52.7, 11.6, 2.3, 3.4), [], group='art', marker='❶')
f('belegaerztlich', 'bei belegärztl. Behandlung', 'checkbox', 'praxis', (63.6, 11.6, 2.3, 3.4), [], group='art', marker='❶')
f('unfall', 'Unfall, Unfallfolgen', 'checkbox', 'praxis', (76.9, 11.6, 2.3, 3.4), [rule('m10a.unfall')], marker='❷')
f('knappschaft', 'Knappschaftskennziffer', 'text', 'praxis', (72.1, 20.1, 12.0, 3.5), [rule('m10a.knappschaft')], marker='❸')
f('geschlecht', 'Geschlecht', 'letter', 'duria', (86.6, 20.1, 2.3, 3.5), [rule('m10a.geschlecht')], marker='❹')
f('ssw', 'SSW', 'number', 'praxis', (91.4, 20.1, 4.7, 3.5), [rule('m10a.ssw')], marker='❺')
f('auftragsnummer', 'Barcode-Etikett der Laborgemeinschaft', 'text', 'leistungserbringer', (44.3, 23.5, 25.5, 12.0), [])
f('zusatzangaben', 'Zusätzliche Angaben zu Untersuchungen', 'text', 'praxis', (4.3, 39.3, 38.0, 4.2), [rule('m10a.zusatzangaben')], marker='❽')
f('abnahmedatum', 'Abnahmedatum', 'date', 'praxis', (44.3, 40.1, 14.4, 3.5), [rule('m10a.abnahme')], format='TTMMJJ', marker='❻')
f('abnahmezeit', 'Abnahmezeit', 'date', 'praxis', (60.0, 40.1, 9.5, 3.5), [], format='hhmm', marker='❼')
for i, (nr, text, o, _) in enumerate(items):
    f(f'lab{nr}', f'{text} ({nr})', 'checkbox', 'praxis', tuple(round(v, 1) for v in o), [rule('m10a.auftragsfeld')] if i == 0 else [], group='untersuchungen', marker='❾')

doc = {
    'schema_version': '1.0.0', 'id': 'muster-10a', 'muster': '10A', 'title': 'Anforderungsschein für Laboratoriumsuntersuchungen bei Laborgemeinschaften',
    'form_version': '10.2020', 'released': '2020-05-06', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 quer', 'width': round(W, 1), 'height': round(H, 1), 'tint': 'ohne'},
    'copies': [{'id': '10A', 'label': 'Anforderungsschein', 'recipient': 'Laborgemeinschaft (mit dem Untersuchungsmaterial)'}],
    'notes': [rule('m10a.egk_voraussetzung'), rule('m10a.zwei_teile'), rule('m10a.barcode'),
              {'id': 'm10a.arbeitsunfall', 'text': 'Bei Arbeitsunfällen, Berufskrankheiten und Schülerunfällen dürfen nur e01, Muster 4 und Muster 16 verwendet werden.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 9, S. 7'}},
              {'id': 'm10a.unterschrift', 'text': 'Erst vollständig ausfüllen, dann unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}],
    'groups': [
        {'id': 'art', 'label': 'Leistungsart', 'select': 'genau_eins', 'rule': rule('m10a.leistungsart')},
        {'id': 'untersuchungen', 'label': 'Auftragsfeld: Untersuchungen', 'select': 'beliebig', 'rule': rule('m10a.auftragsfeld')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-10a.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(items), 'Untersuchungen:', ', '.join(f'{n} {t}' for n, t, _, _ in items))
