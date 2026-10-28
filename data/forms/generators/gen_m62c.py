"""Erzeugt data/forms/muster-62c.json (Behandlungsplan außerklinische Intensivpflege).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 128–130), Lage der Felder aus der Mustersammlung (Seite 86, Ausfertigung 62Ca; Seiten 87/88 deckungsgleich).
python data/forms/generators/gen_m62c.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '62C' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []
CB = (2.9, 2.0)
SIGN = {'id': 'm62c.unterschrift', 'text': 'Erst vollständig ausfüllen, dann persönlich unterschreiben – nie blanko.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}
PERS = {'id': 'm62c.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y) + CB, rules, **kw)


f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (4.4, 1.7, 38.0, 15.7), [PERS])
f('bedarfsmedikamente', 'Bedarfsmedikamente für AKI', 'text', 'arzt', (45.4, 5.4, 50.8, 4.9), [rule('m62c.bedarfsmedikamente')], lines=2, marker='❶')
f('notfallmanagement', 'Notfallmanagement', 'text', 'arzt', (45.4, 12.5, 50.8, 5.0), [rule('m62c.notfall')], lines=2, marker='❷')

# Therapieziele (❸)
f('therapieziele', 'Therapieziele', 'text', 'arzt', (10.3, 21.0, 85.9, 5.0), [rule('m62c.therapieziele')], lines=2, marker='❸')
cb('mre_nein', 'MRE-Besiedelung: nein', 23.7, 26.8, group='mre', marker='❸')
cb('mre_ja', 'MRE-Besiedelung: ja, folgender Keim', 33.4, 26.8, group='mre', marker='❸')
f('mre_keim', 'MRE-Besiedelung: folgender Keim', 'text', 'arzt', (51.5, 26.7, 44.7, 2.1), marker='❸')
cb('heilmittel_logopaedie', 'Maßnahmen der Heilmitteltherapie zur Unterstützung der Therapieziele im Rahmen der AKI: Logopädie', 51.5, 29.6, group='heilmittel', marker='❸')
cb('heilmittel_physiotherapie', 'Maßnahmen der Heilmitteltherapie zur Unterstützung der Therapieziele im Rahmen der AKI: Physiotherapie', 67.2, 29.6, group='heilmittel', marker='❸')
cb('heilmittel_ergotherapie', 'Maßnahmen der Heilmitteltherapie zur Unterstützung der Therapieziele im Rahmen der AKI: Ergotherapie', 83.0, 29.6, group='heilmittel', marker='❸')

# Maßnahmen der außerklinischen Intensivpflege (❹)
cb('vitalparameter', 'Benennung der zu erfassenden und zu bewertenden Vitalparameter', 10.4, 35.4, [rule('m62c.massnahmen_aki'), rule('m62c.vitalparameter')], marker='❹')
f('vitalparameter_1', 'Benennung der zu erfassenden und zu bewertenden Vitalparameter', 'text', 'arzt', (64.1, 35.4, 32.1, 2.1), marker='❹')
f('vitalparameter_2', 'Benennung der zu erfassenden und zu bewertenden Vitalparameter (2. Zeile)', 'text', 'arzt', (14.6, 37.4, 81.6, 2.1), marker='❹')
cb('trachealkanuele', 'Tracheostoma/Trachealkanülenmanagement', 10.4, 39.7, [rule('m62c.fachmassnahmen')], marker='❹')
cb('tracheotomie_dilatativ', 'Tracheotomie: dilatativ', 15.2, 43.9, group='tracheotomie', marker='❹')
cb('tracheotomie_chirurgisch', 'Tracheotomie: chirurgisch', 24.9, 43.9, group='tracheotomie', marker='❹')
f('kanuele_hersteller', 'Trachealkanüle: Hersteller', 'text', 'arzt', (44.4, 43.9, 13.1, 2.1), marker='❹')
f('kanuele_durchmesser', 'Trachealkanüle: Innendurchmesser in mm', 'number', 'arzt', (68.5, 43.9, 8.4, 2.1), marker='❹')
cb('befeuchtung_passiv', 'Befeuchtung: passiv', 78.1, 43.9, group='befeuchtung', marker='❹')
cb('befeuchtung_aktiv', 'Befeuchtung: aktiv', 87.7, 43.9, group='befeuchtung', marker='❹')
cb('sekretmanagement', 'Sekretmanagement', 10.4, 46.8, marker='❹')
cb('absaug_ja', 'Absauggerät: ja', 15.2, 51.0, group='absauggeraet', marker='❹')
cb('absaug_nein', 'Absauggerät: nein', 21.3, 51.0, group='absauggeraet', marker='❹')
f('absaug_haeufigkeit', 'Absauggerät: Häufigkeit pro Tag', 'number', 'arzt', (37.0, 51.0, 4.7, 2.1), marker='❹')
cb('inhalation_ja', 'Inhalationsgerät: ja', 43.1, 51.0, group='inhalationsgeraet', marker='❹')
cb('inhalation_nein', 'Inhalationsgerät: nein', 49.1, 51.0, group='inhalationsgeraet', marker='❹')
f('inhalation_haeufigkeit', 'Inhalationsgerät: Häufigkeit pro Tag', 'number', 'arzt', (64.8, 51.0, 4.7, 2.1), marker='❹')
f('inhalation_medikament', 'Inhalationsgerät: Medikament/Substanz', 'text', 'arzt', (79.9, 51.0, 15.7, 2.1), marker='❹')
cb('dysphagie', 'Dysphagiemanagement', 10.4, 53.9, marker='❹')
f('dysphagie_text', 'Dysphagiemanagement (Angaben)', 'text', 'arzt', (14.6, 56.0, 81.6, 2.1), marker='❹')
cb('beatmungsgeraet', 'Bedienung und Überwachung des Beatmungsgerätes', 10.4, 58.2, marker='❹')
f('beatmungsgeraet_einstellungen', 'Beatmungsgeräteinstellungen', 'text', 'arzt', (14.6, 61.0, 81.6, 2.1), marker='❹')
cb('sauerstoff', 'Sauerstoffinsufflation', 10.4, 63.9, marker='❹')
cb('sauerstoff_ja', 'Sauerstoffinsufflation: ja', 32.6, 63.8, group='sauerstoff_art', marker='❹')
cb('sauerstoff_nein', 'Sauerstoffinsufflation: nein', 42.3, 63.8, group='sauerstoff_art', marker='❹')
cb('sauerstoff_notfall', 'Sauerstoffinsufflation: Notfallversorgung', 52.0, 63.8, group='sauerstoff_art', marker='❹')
for key, label, xf, xd in [('beatmung', 'mit Beatmung', 18.9, 35.8), ('spontan', 'unter Spontanatmung', 46.1, 63.0), ('mobilitaet', 'Mobilität', 73.3, 90.2)]:
    f(f'o2_{key}_flow', f'Sauerstoffinsufflation {label}: Flow (l/min)', 'number', 'arzt', (xf, 68.1, 4.7, 2.1), marker='❹')
    f(f'o2_{key}_dauer', f'Sauerstoffinsufflation {label}: Dauer (h/tgl.)', 'number', 'arzt', (xd, 68.1, 4.7, 2.1), marker='❹')
cb('hygiene', 'Spezielle Hygienemaßnahmen', 10.4, 71.0, marker='❹')
f('hygiene_text', 'Spezielle Hygienemaßnahmen (Angaben)', 'text', 'arzt', (38.1, 70.9, 58.1, 2.1), marker='❹')
f('sonstige_massnahmen', 'Sonstige eingeleitete Maßnahmen (einschließlich weiterer Maßnahmen der AKI)', 'text', 'arzt', (10.3, 75.2, 85.9, 5.0), [rule('m62c.fachmassnahmen')], lines=2, marker='❹')

# Medizinische Behandlungspflege (❺)
for n in range(1, 4):
    y = (85.2, 87.3, 89.5)[n - 1]
    r = [rule('m62c.behandlungspflege')] if n == 1 else []
    f(f'pflege_leistung_{n}', f'Medizinische Behandlungspflege, Zeile {n}: Leistung', 'text', 'arzt', (10.3, y, 62.9, 2.1), r, marker='❺')
    f(f'pflege_tgl_{n}', f'Medizinische Behandlungspflege, Zeile {n}: Häufigkeit tgl.', 'number', 'arzt', (73.2, y, 3.7, 2.1), marker='❺')
    f(f'pflege_wtl_{n}', f'Medizinische Behandlungspflege, Zeile {n}: Häufigkeit wtl.', 'number', 'arzt', (76.9, y, 3.6, 2.1), marker='❺')
    f(f'pflege_mtl_{n}', f'Medizinische Behandlungspflege, Zeile {n}: Häufigkeit mtl.', 'number', 'arzt', (80.5, y, 3.6, 2.1), marker='❺')
    f(f'pflege_vom_{n}', f'Medizinische Behandlungspflege, Zeile {n}: Dauer vom', 'date', 'arzt', (84.1, y, 6.0, 2.1), format='TTMMJJ', marker='❺')
    f(f'pflege_bis_{n}', f'Medizinische Behandlungspflege, Zeile {n}: Dauer bis', 'date', 'arzt', (90.1, y, 6.1, 2.1), format='TTMMJJ', marker='❺')
f('arzt_name', 'Name des Arztes / der Ärztin', 'text', 'arzt', (10.3, 93.7, 62.3, 2.1))
f('unterschrift', 'ärztliche Unterschrift', 'stempel', 'arzt', (73.3, 92.4, 22.7, 3.5), [SIGN])

groups = [
    {'id': 'mre', 'label': 'MRE-Besiedelung', 'select': 'beliebig', 'rule': rule('m62c.therapieziele')},
    {'id': 'heilmittel', 'label': 'Maßnahmen der Heilmitteltherapie zur Unterstützung der Therapieziele im Rahmen der AKI', 'select': 'beliebig', 'rule': rule('m62c.therapieziele')},
    {'id': 'tracheotomie', 'label': 'Tracheotomie', 'select': 'beliebig', 'rule': rule('m62c.fachmassnahmen')},
    {'id': 'befeuchtung', 'label': 'Befeuchtung', 'select': 'beliebig', 'rule': rule('m62c.fachmassnahmen')},
    {'id': 'absauggeraet', 'label': 'Absauggerät', 'select': 'beliebig', 'rule': rule('m62c.fachmassnahmen')},
    {'id': 'inhalationsgeraet', 'label': 'Inhalationsgerät', 'select': 'beliebig', 'rule': rule('m62c.fachmassnahmen')},
    {'id': 'sauerstoff_art', 'label': 'Sauerstoffinsufflation (ja / nein / Notfallversorgung)', 'select': 'beliebig', 'rule': rule('m62c.fachmassnahmen')},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-62c', 'muster': '62C', 'title': 'Behandlungsplan (außerklinische Intensivpflege)',
    'form_version': '1.2023', 'released': '2022-05-30', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'copies': [
        {'id': '62Ca', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse'},
        {'id': '62Cb', 'label': 'Ausfertigung für den Leistungserbringer nach § 132l', 'recipient': 'Leistungserbringer nach § 132l Abs. 5 SGB V'},
        {'id': '62Cc', 'label': 'Ausfertigung für den verordnenden Arzt', 'recipient': 'verbleibt in der Praxis'},
    ],
    'notes': [rule('m62c.beilage'), rule('m62c.aktualisierung'), rule('m62c.exemplare')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-62c.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
