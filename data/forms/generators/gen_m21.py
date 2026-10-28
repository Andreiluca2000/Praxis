"""Erzeugt data/forms/muster-21.json (Ärztliche Bescheinigung für den Bezug von Krankengeld bei Erkrankung eines Kindes).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 66–67), Lage der Felder aus der Mustersammlung (Seite 40).
python data/forms/generators/gen_m21.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '21' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


f('personalien', 'Personalienfeld des Kindes (Kasse bzw. Kostenträger, Name, geb. am, Versicherten-Nr., BSNR, LANR, Datum)', 'personalien', 'duria', (6.2, 2.5, 53.9, 22.2),
  [rule('m21.personalienfeld')])
f('vom', 'Beaufsichtigung, Betreuung oder Pflege vom', 'date', 'praxis', (21.6, 29.8, 20.4, 3.0), [rule('m21.zeitraum')], format='TTMMJJ')
f('bis', 'bis einschließlich', 'date', 'praxis', (21.6, 33.8, 20.4, 3.0), [rule('m21.zeitraum')], format='TTMMJJ')
f('kita_unfall', 'Kita- oder Schulunfall / -folgen', 'checkbox', 'praxis', (6.2, 38.4, 3.2, 2.4), [rule('m21.kita_schulunfall')], label_pos='rechts')
f('sonstiger_unfall', 'sonstiger Unfall, Unfallfolgen', 'checkbox', 'praxis', (6.2, 42.4, 3.2, 2.4), [rule('m21.sonstiger_unfall')], label_pos='rechts')
f('ser', 'SER', 'checkbox', 'praxis', (6.2, 46.5, 3.2, 2.4),
  [rule('m21.ser', text='Nur bei behördlich anerkannter Schädigungsfolge nach dem SER (bisher BVG u. a.); der Nachweis wird vorgelegt.', locator='Muster 21, SER, S. 67; Allgemeines Nr. 8, S. 6')], label_pos='rechts')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (63.0, 29.8, 32.2, 17.0),
  [{'id': 'm21.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])
f('antrag', 'Antrag der/des Versicherten (Name, Anschrift, IBAN, Erklärungen, Unterschrift)', 'text', 'versicherter', (6.1, 55.5, 89.2, 38.5),
  [{'id': 'm21.antrag', 'text': 'Den Antrag füllt die betreuende Person aus und stellt ihn bei ihrer eigenen Krankenkasse.', 'source': {'artifact': 'mustersammlung', 'locator': 'PDF-Seite 40, Muster 21 (7.2024), Antrag der/des Versicherten'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-21', 'muster': '21', 'title': 'Ärztliche Bescheinigung für den Bezug von Krankengeld bei Erkrankung eines Kindes',
    'form_version': '7.2024', 'released': '2023-11-15', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 hoch', 'width': 419.5, 'height': 595.3, 'tint': 'blau'},
    'copies': [{'id': '21', 'label': 'Bescheinigung mit Antrag', 'recipient': 'Krankenkasse der betreuenden Person (über die Versicherte/den Versicherten)'}],
    'notes': [rule('m21.voraussetzung'), rule('m21.begleitung_behandlung'), rule('m21.mitaufnahme')],
    'groups': [],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-21.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
