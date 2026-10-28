"""Erzeugt data/forms/muster-85.json (Nachweis der Anspruchsberechtigung bei Ruhen des Anspruchs gemäß § 16 Absatz 3a SGB V).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 145: „ohne Erläuterung“), Lage der Felder aus der Mustersammlung (Seite 104).
Der Vordruck wird von den Krankenkassen ausgestellt; alle Felder sind Angaben der Krankenkasse (filled_by „leistungserbringer“ = nicht von der Praxis,
das Schema kennt keinen eigenen Wert für die Krankenkasse).
python data/forms/generators/gen_m85.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '85' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 85 (10.2014)'}}


fields = []
KASSE = [rule('m85.ohne_erlaeuterung')]


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


f('versichertendaten', 'Krankenkasse, Name, Vorname, Geburtsdatum, Anschrift, Kostenträgerkennung, Versicherten-Nr., Status', 'personalien', 'leistungserbringer',
  (6.1, 4.8, 54.0, 48.7), KASSE)
f('quartal', 'gültig für (Quartal)', 'quarter', 'leistungserbringer', (85.0, 28.3, 10.3, 5.0), KASSE, format='QJJ')
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'leistungserbringer', (40.4, 88.8, 20.6, 5.0), KASSE, format='TTMMJJ')
f('stempel', 'Stempel / Unterschrift der Krankenkasse', 'stempel', 'leistungserbringer', (63.0, 59.6, 32.3, 34.1),
  [ms('m85.stempel_kasse', 'Der Nachweis trägt Stempel und Unterschrift der Krankenkasse (Beschriftung des Stempelfeldes auf dem Vordruck).', 'PDF-Seite 104')])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-85', 'muster': '85', 'title': 'Nachweis der Anspruchsberechtigung bei Ruhen des Anspruchs gemäß § 16 Absatz 3a SGB V',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 quer', 'width': 419.5, 'height': 297.6, 'tint': 'ohne'},
    'copies': [{'id': '85', 'label': 'Nachweis der Krankenkasse', 'recipient': 'Versicherte/Versicherter (zur Vorlage in der Praxis)'}],
    'notes': [rule('m85.ohne_erlaeuterung'),
              ms('m85.geltung', 'Der Nachweis gilt im Rahmen der Kostenübernahme durch die unterzeichnende Krankenkasse bei Früherkennungsuntersuchungen nach §§ 25 und 26 SGB V und bei Leistungen, die zur Behandlung akuter Erkrankungen und Schmerzzustände sowie bei Schwangerschaft und Mutterschaft erforderlich sind (Text auf dem Vordruck).', 'PDF-Seite 104')],
    'groups': [],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-85.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
