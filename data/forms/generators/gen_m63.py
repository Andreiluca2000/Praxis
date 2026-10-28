"""Erzeugt data/forms/muster-63.json (Verordnung spezialisierter ambulanter Palliativversorgung, SAPV).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 131–132), Lage der Felder aus der Mustersammlung (Seite 89, Muster 63a).
python data/forms/generators/gen_m63.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '63' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def vordruck(rid, text):
    return rule(rid, text=text, locator='PDF-Seite 89, Muster 63a (10.2014)', artifact='mustersammlung')


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


CB = (2.9, 2.0)
f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', (4.4, 1.7, 38.0, 15.7),
  [rule('m63.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('erst', 'Erstverordnung', 'checkbox', 'praxis', (44.3, 7.6, *CB), [], group='verordnung', label_pos='rechts')
f('folge', 'Folgeverordnung', 'checkbox', 'praxis', (63.6, 7.6, *CB), [], group='verordnung', label_pos='rechts')
f('unfall', 'Unfall, Unfallfolgen', 'checkbox', 'praxis', (44.3, 11.1, *CB), [vordruck('m63.unfall', 'Ankreuzen, wenn die Versorgung wegen eines Unfalls oder seiner Folgen nötig ist.')], label_pos='rechts')
f('vom', 'Verordnungszeitraum vom', 'date', 'praxis', (47.9, 15.4, 14.4, 2.0), [rule('m63.angaben')], format='TTMMJJ')
f('bis', 'Verordnungszeitraum bis', 'date', 'praxis', (67.2, 15.4, 14.4, 2.0), [rule('m63.angaben')], format='TTMMJJ')
f('diagnosen', 'Verordnungsrelevante Diagnose(n) (ICD-10; ggf. Organmanifestationen)', 'text', 'arzt', (9.1, 20.3, 87.1, 4.3), [rule('m63.angaben')], lines=2)
for id_, label, b in (
        ('schmerz', 'ausgeprägte Schmerzsymptomatik', (38.2, 29.6)),
        ('urogenital', 'ausgeprägte urogenitale Symptomatik', (9.2, 32.5)),
        ('respiratorisch', 'ausgeprägte respiratorische / kardiale Symptomatik', (38.2, 32.5)),
        ('gastro', 'ausgeprägte gastrointestinale Symptomatik', (72.1, 32.5)),
        ('ulzerierend', 'ausgeprägte ulzerierende / exulzerierende Wunden oder Tumore', (9.2, 35.3)),
        ('neuro', 'ausgeprägte neurologische / psychiatrische / psychische Symptomatik', (38.2, 35.3)),
        ('sonstiges', 'sonstiges komplexes Symptomgeschehen', (72.1, 35.3))):
    f(id_, label, 'checkbox', 'arzt', (*b, *CB), [], group='symptome', label_pos='rechts')
f('beschreibung', 'Nähere Beschreibung des komplexen Symptomgeschehens und des besonderen Versorgungsbedarfs', 'text', 'arzt', (9.1, 41.7, 87.1, 4.3), [rule('m63.voraussetzung')], lines=2)
f('medikation', 'Aktuelle Medikation (ggf. einschließlich BtM)', 'text', 'arzt', (9.1, 48.8, 87.1, 8.6), [rule('m63.angaben')], lines=4)
f('beratung', 'Beratung', 'checkbox', 'arzt', (9.2, 61.0, *CB), [], group='massnahmen', label_pos='rechts')
f('beratung_arzt', 'Beratung a. des behandelnden Arztes', 'checkbox', 'arzt', (23.7, 61.0, *CB), [], group='beratung_wer', label_pos='rechts')
f('beratung_pflege', 'Beratung b. der behandelnden Pflegefachkraft', 'checkbox', 'arzt', (23.7, 63.1, *CB), [], group='beratung_wer', label_pos='rechts')
f('beratung_patient', 'Beratung c. des Patienten / der Angehörigen', 'checkbox', 'arzt', (23.7, 65.2, *CB), [], group='beratung_wer', label_pos='rechts')
f('koordination', 'Koordination der Palliativversorgung', 'checkbox', 'arzt', (63.6, 61.0, *CB), [], group='massnahmen', label_pos='rechts')
f('ausrichtung', 'mit folgender inhaltlicher Ausrichtung (Gegenstand, Häufigkeit, evtl. Beratung für Sonstige)', 'text', 'arzt', (9.1, 69.5, 87.1, 6.4), [rule('m63.angaben')], lines=3)
f('teilversorgung', 'Additiv unterstützende Teilversorgung', 'checkbox', 'arzt', (9.2, 78.1, *CB), [], group='massnahmen', label_pos='rechts')
f('vollversorgung', 'Vollständige Versorgung', 'checkbox', 'arzt', (33.4, 78.1, *CB), [], group='massnahmen', label_pos='rechts')
f('naehere_angaben', 'Nähere Angaben zu den notwendigen Maßnahmen der SAPV', 'text', 'arzt', (9.1, 82.3, 59.9, 10.7), [rule('m63.umfang')], lines=5)
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (70.5, 82.9, 26.5, 12.0), [rule('m63.aenderungen')])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-63', 'muster': '63', 'title': 'Verordnung spezialisierter ambulanter Palliativversorgung (SAPV)',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'copies': [
        {'id': '63a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse (Versicherte/r legt vor; Rückseite für den Antrag)'},
        {'id': '63b', 'label': 'Ausfertigung', 'recipient': 'SAPV-Leistungserbringer'},
        {'id': '63c', 'label': 'Ausfertigung', 'recipient': 'Versicherte/r'},
        {'id': '63d', 'label': 'Ausfertigung', 'recipient': 'Vertragsarzt'},
    ],
    'notes': [rule('m63.voraussetzung'), rule('m63.umfang'), rule('m63.abstimmung'), rule('m63.genehmigung'), rule('m63.kostenuebernahme_frist'),
              vordruck('m63.nicht_heilbar', 'Mit der Verordnung wird bestätigt: „Die Krankheit ist nicht heilbar, sie ist fortschreitend und weit fortgeschritten.“ (Aufdruck auf dem Vordruck).')],
    'groups': [
        {'id': 'verordnung', 'label': 'Erst- oder Folgeverordnung', 'select': 'genau_eins',
         'rule': vordruck('m63.erst_folge', 'Erst- oder Folgeverordnung ankreuzen; für die Erstverordnung ist die Kostenpauschale 01425, für die Folgeverordnung 01426 berechnungsfähig (Aufdruck).')},
        {'id': 'symptome', 'label': 'Komplexes Symptomgeschehen', 'select': 'beliebig', 'rule': rule('m63.voraussetzung')},
        {'id': 'massnahmen', 'label': 'Folgende Maßnahmen sind notwendig', 'select': 'beliebig', 'rule': rule('m63.angaben')},
        {'id': 'beratung_wer', 'label': 'Beratung von wem', 'select': 'beliebig', 'rule': rule('m63.angaben')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-63.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
