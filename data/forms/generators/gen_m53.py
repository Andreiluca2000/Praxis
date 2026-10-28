"""Erzeugt data/forms/muster-53.json (Anfrage zum Zusammenhang von Arbeitsunfähigkeitszeiten).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 92), Lage der Felder aus der Mustersammlung (Seiten 63–64).
Vorderseite sowie Abschnitte I. und II. der Rückseite füllt die Krankenkasse aus; modelliert wird der Teil „Vom Vertragsarzt auszufüllen!“.
python data/forms/generators/gen_m53.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '53' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where='PDF-Seite 64'):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 53 (10.2005)'}}


fields = []
P = 1  # Rückseite
CB_W, CB_H = 3.0, 2.1


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by, 'page': P}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y, CB_W, CB_H), rules, **kw)


Q_I_II = ms('m53.frage_i_ii', 'Frage: Handelt es sich bei der unter I. angegebenen Krankheit und einer der unter II. genannten Krankheiten um dieselbe Krankheit (im Sinne der abgedruckten versicherungsrechtlichen Erläuterungen)? – nein oder ja, bei der/den Ziffer(n).')
Q_III = ms('m53.frage_iii', 'Frage III.: Sind während der unter I. genannten Arbeitsunfähigkeit weitere Krankheiten hinzugetreten? – nein oder ja, und zwar … am …')
Q_NUR = ms('m53.frage_nur_hinzugetreten', 'Frage: Wird die Arbeitsunfähigkeit nur noch von der/den hinzugetretenen Krankheit(en) bedingt? – nein oder ja, und zwar … ab …')
Q_HINZU = ms('m53.frage_hinzugetreten_ii', 'Frage: Handelt es sich bei der hinzugetretenen Krankheit und einer unter II. genannten früheren Erkrankung um dieselbe Krankheit? – nein oder ja, bei der/den Ziffer(n).')

cb('dieselbe_nein', 'Dieselbe Krankheit (I. und II.)? nein', 6.7, 45.2, [], group='dieselbe_krankheit')
cb('dieselbe_ja', 'Dieselbe Krankheit (I. und II.)? ja, und zwar bei der/den unter Ziffer(n)', 17.0, 45.2, [], group='dieselbe_krankheit')
f('dieselbe_ziffern', 'ja, und zwar bei der/den unter Ziffer(n) … genannten Krankheit(en)', 'text', 'arzt', (47.2, 45.3, 24.8, 2.1), [])
cb('hinzu_nein', 'III. Weitere Krankheiten hinzugetreten? nein', 6.7, 51.0, [rule('m53.diagnosen')], group='weitere_krankheiten')
cb('hinzu_ja', 'III. Weitere Krankheiten hinzugetreten? ja, und zwar', 17.0, 51.0, [rule('m53.diagnosen')], group='weitere_krankheiten')
f('hinzu_krankheiten', 'ja, und zwar (weitere Krankheiten), Zeile 1', 'text', 'arzt', (29.7, 51.0, 60.5, 2.1), [rule('m53.diagnosen')])
f('hinzu_krankheiten_2', 'ja, und zwar (weitere Krankheiten), Zeile 2', 'text', 'arzt', (6.7, 53.8, 65.3, 2.1), [])
f('hinzu_am', 'weitere Krankheiten hinzugetreten am', 'date', 'arzt', (75.7, 53.8, 14.5, 2.1), [], format='TTMMJJ')
cb('nur_nein', 'Arbeitsunfähigkeit nur noch von hinzugetretenen Krankheit(en) bedingt? nein', 6.7, 59.5, [], group='nur_hinzugetreten')
cb('nur_ja', 'Arbeitsunfähigkeit nur noch von hinzugetretenen Krankheit(en) bedingt? ja, und zwar', 17.0, 59.5, [], group='nur_hinzugetreten')
f('nur_krankheiten', 'ja, und zwar (nur noch bedingt von), Zeile 1', 'text', 'arzt', (29.7, 59.5, 60.5, 2.1), [])
f('nur_krankheiten_2', 'ja, und zwar (nur noch bedingt von), Zeile 2', 'text', 'arzt', (6.7, 62.4, 65.3, 2.1), [])
f('nur_ab', 'Arbeitsunfähigkeit nur noch bedingt ab', 'date', 'arzt', (75.7, 62.4, 14.5, 2.1), [], format='TTMMJJ')
cb('hinzu_dieselbe_nein', 'Hinzugetretene Krankheit und frühere Erkrankung (II.) dieselbe Krankheit? nein', 6.7, 69.5, [], group='hinzu_dieselbe')
cb('hinzu_dieselbe_ja', 'Hinzugetretene Krankheit und frühere Erkrankung (II.) dieselbe Krankheit? ja, und zwar bei der/den unter Ziffer(n)', 17.0, 69.5, [], group='hinzu_dieselbe')
f('hinzu_dieselbe_ziffern', 'ja, und zwar bei der/den unter Ziffer(n) … genannten Krankheit(en)', 'text', 'arzt', (47.2, 69.5, 24.8, 2.1), [])
f('bemerkungen', 'Ergänzende Bemerkungen', 'text', 'arzt', (6.7, 75.2, 59.3, 10.7), [], lines=4)
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'praxis', (51.5, 89.5, 14.5, 2.1), [], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (67.4, 79.5, 22.8, 12.1),
  [{'id': 'm53.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-53', 'muster': '53', 'title': 'Anfrage zum Zusammenhang von Arbeitsunfähigkeitszeiten',
    'form_version': '10.2005', 'released': '2005-08-04', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Vorder- und Rückseite', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'pages': ['Vorderseite (Anfrage der Krankenkasse)', 'Rückseite (Angaben der Krankenkasse und Antwort des Vertragsarztes)'],
    'copies': [{'id': '53', 'label': 'Anfrage mit Antwortteil', 'recipient': 'Krankenkasse (Rücksendung im Freiumschlag)'}],
    'notes': [rule('m53.zweck'), rule('m53.abschnitt_1_2'),
              ms('m53.vorderseite', 'Die Vorderseite füllt die Krankenkasse aus: Anrede, Name, Geburtsdatum, Anschrift, Versichertennummer, „ist seit … arbeitsunfähig erkrankt / in stationärer Behandlung“ und die Frage nach dem ursächlichen Zusammenhang der Arbeitsunfähigkeitszeiten.', 'PDF-Seite 63'),
              ms('m53.kasse_teil', 'Der Teil „Von der Krankenkasse auszufüllen!“ (I. Arbeitsunfähig vom/bis wegen; II. Vorher bestand Arbeitsunfähigkeit wegen 1–6 mit vom/bis und behandelndem Arzt) steht über dem ärztlichen Teil und wird nicht von der Praxis ausgefüllt.'),
              ms('m53.erlaeuterung_krankheit', 'Aufdruck „Versicherungsrechtliche Erläuterungen“ zum Begriff „dieselbe Krankheit“: Fortlaufende Behandlungsbedürftigkeit ist nicht Voraussetzung; maßgeblich ist, ob die neue und die frühere Arbeitsunfähigkeit auf derselben Krankheitsursache beruhen oder in einem inneren Zusammenhang stehen.'),
              ms('m53.ebm_01621', 'Für die Beantwortung dieser Anfrage ist die Nr. 01621 EBM berechnungsfähig (Aufdruck).', 'PDF-Seite 63')],
    'groups': [
        {'id': 'dieselbe_krankheit', 'label': 'Dieselbe Krankheit (I. und II.)', 'select': 'genau_eins', 'rule': Q_I_II},
        {'id': 'weitere_krankheiten', 'label': 'III. Weitere Krankheiten hinzugetreten', 'select': 'genau_eins', 'rule': Q_III},
        {'id': 'nur_hinzugetreten', 'label': 'Arbeitsunfähigkeit nur noch von hinzugetretenen Krankheiten bedingt', 'select': 'genau_eins', 'rule': Q_NUR},
        {'id': 'hinzu_dieselbe', 'label': 'Hinzugetretene Krankheit und frühere Erkrankung (II.) dieselbe Krankheit', 'select': 'genau_eins', 'rule': Q_HINZU},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-53.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
