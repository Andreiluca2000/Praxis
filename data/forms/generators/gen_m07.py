"""Erzeugt data/forms/muster-07.json (Überweisung vor Aufnahme einer Psychotherapie zur Abklärung somatischer Ursachen).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 30), Lage der Felder aus der Mustersammlung (Seite 12).
python data/forms/generators/gen_m07.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '7' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 7 (10.2014)'}}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria',
  (4.3, 3.4, 38.0, 31.7), [rule('m07.ausfuellen')])
f('diagnosen', 'Diagnosen/Indikation zur Psychotherapie', 'text', 'arzt', (47.2, 18.0, 47.6, 17.2), [rule('m07.ausfuellen')], lines=3)
f('information', 'Information für den Arzt', 'text', 'arzt', (4.3, 38.0, 90.5, 27.5), [rule('m07.ausfuellen')], lines=5)
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'praxis', (55.1, 88.0, 14.5, 4.3),
  [ms('m07.datum', 'Ausstellungsdatum der Überweisung im Datumsfeld (TTMMJJ).', 'PDF-Seite 12')], format='TTMMJJ')
f('stempel', 'Stempel / Unterschrift des Therapeuten', 'stempel', 'arzt', (73.4, 68.0, 22.8, 24.2),
  [{'id': 'm07.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Stempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-07', 'muster': '7', 'title': 'Überweisung vor Aufnahme einer Psychotherapie zur Abklärung somatischer Ursachen',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 quer', 'width': 595.3, 'height': 419.5, 'tint': 'rot'},
    'copies': [{'id': '7', 'label': 'Überweisung', 'recipient': 'Konsiliararzt (Überweisung des Psychotherapeuten zur Abklärung somatischer Ursachen)'}],
    'notes': [rule('m07.zweck'), rule('m07.konsiliararzt'),
              ms('m07.hinweis_frist', 'Aufdruck: Der Konsiliarbericht ist dem Psychotherapeuten möglichst zeitnah, spätestens drei Wochen nach der Untersuchung zu übermitteln.', 'PDF-Seite 12')],
    'groups': [],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-07.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
