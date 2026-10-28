"""Erzeugt data/forms/muster-50.json (Anfrage zur Zuständigkeit einer anderen Krankenkasse).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 86), Lage der Felder aus der Mustersammlung (Seiten 58–59).
Die Vorderseite (Anfrage) füllt die Krankenkasse aus; modelliert wird die Antwortseite des Vertragsarztes.
python data/forms/generators/gen_m50.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '50' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where='PDF-Seite 59'):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 50 (10.2005)'}}


fields = []
P = 1  # Rückseite
CB_W, CB_H = 3.0, 2.1


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by, 'page': P}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


NAME_Q = ms('m50.frage_name', 'Frage der Krankenkasse: „Wurde der Name und das Geburtsdatum von uns richtig wiedergegeben?“ – ja oder nein; bei nein berichtigen.')
AUSWEIS_Q = ms('m50.frage_behandlungsausweis', 'Frage der Krankenkasse: „Hat ein Behandlungsausweis zum Zeitpunkt der Behandlung vorgelegen?“ – ja oder nein.')

f('name_richtig_ja', 'Wurde der Name und das Geburtsdatum von uns richtig wiedergegeben? ja', 'checkbox', 'arzt', (62.4, 8.2, CB_W, CB_H), [rule('m50.personalien')], group='name_richtig')
f('name_richtig_nein', 'Wurde der Name und das Geburtsdatum von uns richtig wiedergegeben? nein', 'checkbox', 'arzt', (75.7, 8.2, CB_W, CB_H), [], group='name_richtig')
f('name_berichtigt', 'Wenn nein, bitte berichtigen: Name und Vorname des Versicherten', 'text', 'arzt', (6.7, 15.3, 67.2, 2.1), [rule('m50.personalien')])
f('geburtsdatum_berichtigt', 'Wenn nein, bitte berichtigen: Geburtsdatum', 'date', 'arzt', (75.7, 15.3, 14.5, 2.1), [rule('m50.personalien')], format='TTMMJJ')
f('ausweis_ja', 'Hat ein Behandlungsausweis zum Zeitpunkt der Behandlung vorgelegen? ja', 'checkbox', 'arzt', (62.4, 21.1, CB_W, CB_H), [rule('m50.kassenname')], group='behandlungsausweis')
f('ausweis_nein', 'Hat ein Behandlungsausweis zum Zeitpunkt der Behandlung vorgelegen? nein', 'checkbox', 'arzt', (75.7, 21.1, CB_W, CB_H), [], group='behandlungsausweis')
f('krankenkasse_name', 'Name der Krankenkasse', 'text', 'arzt', (6.7, 26.7, 83.5, 2.1), [rule('m50.kassenname')])
f('neue_krankenkasse_name', 'Bei Kassenwechsel: Name der neuen Krankenkasse', 'text', 'arzt', (6.7, 35.3, 83.5, 2.1), [rule('m50.kassenname')])

NEU = ms('m50.nur_neue_kasse', 'Aufdruck: „Bitte nur bei Angabe einer neuen Krankenkasse ausfüllen!“ – Behandlungstage mit EBM-Nr. nur bei Kassenwechsel.')
rows = [(6.7, 23.0, 23.0, y) for y in (42.4, 45.3, 48.1, 51.0, 53.8)] + [(50.3, 66.6, 23.6, y) for y in (42.4, 45.3, 48.1, 51.0, 53.8)]
for n, (xd, xe, we, y) in enumerate(rows, 1):
    f(f'behandlungstag_{n:02d}', f'Behandlungstag {n}', 'date', 'arzt', (xd, y, 14.5, 2.1), [NEU, rule('m50.kassenname')] if n == 1 else [], format='TTMMJJ')
    f(f'ebm_{n:02d}', f'EBM-Nr. zu Behandlungstag {n}', 'text', 'arzt', (xe, y, we, 2.1), [])
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'praxis', (50.3, 73.8, 14.5, 2.1), [], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (67.4, 63.8, 22.8, 12.1),
  [{'id': 'm50.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-50', 'muster': '50', 'title': 'Anfrage zur Zuständigkeit einer anderen Krankenkasse',
    'form_version': '10.2005', 'released': '2005-08-04', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Vorder- und Rückseite', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'pages': ['Vorderseite (Anfrage der Krankenkasse)', 'Rückseite (Antwort des Vertragsarztes)'],
    'copies': [{'id': '50', 'label': 'Anfrage mit Antwortseite', 'recipient': 'Krankenkasse (Rücksendung im Freiumschlag)'}],
    'notes': [rule('m50.anlass'),
              ms('m50.vorderseite', 'Die Vorderseite füllt die Krankenkasse aus: Anrede, Datum der Bescheinigung/Verordnung, Name, Geburtsdatum, Anschrift und Versichertennummer, Art der ausgestellten Unterlage (Arbeitsunfähigkeitsbescheinigung, Verordnung(en), Verordnung von Krankenhausbehandlung) und Ende der Mitgliedschaft. Der Arzt füllt nur die Rückseite („Vom Vertragsarzt auszufüllen!“) aus.', 'PDF-Seite 58'),
              ms('m50.ebm_01620', 'Für die Beantwortung dieser Anfrage ist die Nr. 01620 EBM berechnungsfähig (Aufdruck).', 'PDF-Seite 58')],
    'groups': [
        {'id': 'name_richtig', 'label': 'Name und Geburtsdatum richtig wiedergegeben?', 'select': 'genau_eins', 'rule': NAME_Q},
        {'id': 'behandlungsausweis', 'label': 'Behandlungsausweis zum Zeitpunkt der Behandlung vorgelegen?', 'select': 'genau_eins', 'rule': AUSWEIS_Q},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-50.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
