"""Erzeugt data/forms/muster-26.json (Verordnung Soziotherapie) und muster-27.json (Soziotherapeutischer Betreuungsplan).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 71–76), Lage der Felder aus der Mustersammlung (Seite 46 = 26a, Seite 49 = 27a).
python data/forms/generators/gen_m26_27.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] in ('26', '27') for r in e['rules']}

PERS = 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)'
UNTERSCHRIFT = 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.'


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def form(muster):
    fields = []

    def f(id_, label, kind, filled_by, b, rules=(), **kw):
        d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
        d.update({k: v for k, v in kw.items() if v is not None})
        d['box'] = dict(zip('xywh', b))
        d['rules'] = list(rules)
        fields.append(d)
    f('personalien', PERS, 'personalien', 'duria', (4.4, 1.7, 38.0, 15.7),
      [rule(f'm{muster}.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
    return fields, f


def write(name, doc):
    json.dump(doc, open(f'{root}/data/forms/{name}.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print(name, len(doc['fields']), 'Felder')


# Muster 26 – Verordnung Soziotherapie
fields, f = form('26')
CB = (2.9, 2.0)
f('diagnose', 'Diagnose (ICD-10-Code)', 'text', 'arzt', (54.5, 9.6, 33.3, 2.1), [rule('m26.diagnose')], marker='❶')
f('gaf', 'Schweregrad (lt. GAF-Skala)', 'text', 'arzt', (54.5, 12.4, 33.3, 2.1), [rule('m26.gaf_40_50'), rule('m26.gaf_unter_40')], marker='❷')
f('seit', 'Erkrankung besteht seit (falls bekannt)', 'date', 'praxis', (73.2, 15.3, 14.5, 2.1), [rule('m26.erkrankung_seit')], format='TTMMJJ', marker='❸')
f('faehigkeit', 'Art und Ausprägung der Fähigkeitsstörungen', 'text', 'arzt', (10.3, 18.9, 85.9, 7.1), [rule('m26.faehigkeitsstoerung')], lines=3, marker='❹')
f('comorbiditaeten', 'Art und Ausprägung der Co-Morbiditäten / Sonstige Einschränkungen', 'text', 'arzt', (10.3, 28.2, 85.9, 7.1), [rule('m26.comorbiditaeten')], lines=3, marker='❺')
f('versicherter', 'Angaben des Versicherten (Straße, PLZ, Ort, Telefon)', 'text', 'duria', (10.3, 37.4, 42.3, 8.8), [rule('m26.versicherter')], marker='❻')
f('wohnform', 'Wohnform (z. B. alleinstehend in eigener Wohnung, Familie/Eltern, in Einrichtung)', 'text', 'praxis', (10.3, 47.0, 42.3, 1.8), [rule('m26.versicherter')], marker='❻')
f('angehoeriger', 'Angaben des nächsten Angehörigen (Name, Anschrift, Telefon)', 'text', 'praxis', (53.9, 37.4, 42.3, 11.4), [rule('m26.angehoeriger')], marker='❼')
f('betreuer_nein', 'Gesetzlicher Betreuer bestellt: Nein', 'checkbox', 'praxis', (39.4, 51.0, *CB), [], group='betreuer', marker='❽')
f('betreuer_ja', 'Gesetzlicher Betreuer bestellt: Ja', 'checkbox', 'praxis', (47.9, 51.0, *CB), [], group='betreuer', marker='❽')
f('betreuer_angelegenheiten', 'Wenn ja, für welche Angelegenheiten?', 'text', 'praxis', (10.3, 56.0, 42.3, 5.7), [rule('m26.betreuer')], lines=2, marker='❽')
f('betreuer_kontakt', 'Angaben zum Betreuer (Name, Anschrift, Telefon)', 'text', 'praxis', (53.9, 50.3, 42.3, 11.4), [rule('m26.betreuer')], marker='❽')
f('einheiten_gesamt', 'Voraussichtliche Anzahl der Therapieeinheiten', 'text', 'arzt', (27.9, 62.3, 13.3, 2.1), [rule('m26.einheiten_dauer')], marker='❾')
f('dauer', 'Voraussichtliche Dauer der Therapie', 'text', 'arzt', (27.9, 65.2, 13.3, 2.1), [rule('m26.einheiten_dauer')], marker='❿')
f('einheiten_beantragt', 'Beantragte Anzahl der Therapieeinheiten', 'text', 'arzt', (58.7, 62.3, 13.3, 2.1), [rule('m26.max_30')], marker='⓫')
f('bereits', 'Bereits durchgeführte Leistungen', 'text', 'praxis', (58.7, 65.2, 13.3, 2.1), [rule('m26.bereits_erbracht')], marker='⓬')
f('prognose', 'Prognose', 'text', 'arzt', (10.3, 68.8, 61.7, 7.1), [rule('m26.prognose')], lines=3, marker='⓭')
f('kh_vermieden', 'Krankenhausbehandlung wird vermieden', 'checkbox', 'arzt', (30.4, 76.7, *CB), [], group='krankenhaus', marker='⓮')
f('kh_verkuerzt', 'Krankenhausbehandlung wird verkürzt', 'checkbox', 'arzt', (46.0, 76.7, 3.0, 2.1), [], group='krankenhaus', marker='⓮')
f('kh_nicht_ausfuehrbar', 'Krankenhausbehandlung ist nicht ausführbar', 'checkbox', 'arzt', (59.4, 76.7, 3.0, 2.1), [], group='krankenhaus', marker='⓮')
f('begruendung', 'Begründung', 'text', 'arzt', (10.3, 79.5, 61.7, 7.1), [rule('m26.krankenhaus')], lines=3, marker='⓮')
f('datum', 'Datum', 'date', 'praxis', (57.6, 93.7, 14.4, 2.0), [rule('m26.vorlage_frist')], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (73.5, 83.8, 22.7, 12.0),
  [{'id': 'm26.unterschrift', 'text': UNTERSCHRIFT, 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])
write('muster-26', {
    'schema_version': '1.0.0', 'id': 'muster-26', 'muster': '26', 'title': 'Verordnung Soziotherapie gemäß § 37a SGB V',
    'form_version': '10.2017', 'released': '2017-07-07', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'blau'},
    'copies': [{'id': '26a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse (mit Muster 27)'},
               {'id': '26b', 'label': '1. Durchschlag', 'recipient': 'soziotherapeutischer Leistungserbringer'},
               {'id': '26c', 'label': '2. Durchschlag', 'recipient': 'verordnender Arzt'}],
    'notes': [rule('m26.berechtigte'), rule('m26.kooperation'), rule('m26.st_rl'), rule('m26.durchschlaege'), rule('m26.vorlage_frist'), rule('m26.genehmigung'),
              rule('m26.ebm', text='Für das Ausstellen der Erstverordnung ist die Nr. 30810, für die Folgeverordnung die Nr. 30811 EBM berechnungsfähig (Aufdruck).',
                   locator='PDF-Seite 46, Muster 26a (10.2017)', artifact='mustersammlung')],
    'groups': [{'id': 'betreuer', 'label': 'Gesetzlicher Betreuer bestellt', 'select': 'genau_eins', 'rule': rule('m26.betreuer')},
               {'id': 'krankenhaus', 'label': 'Krankenhausbehandlung', 'select': 'genau_eins', 'rule': rule('m26.krankenhaus')}],
    'fields': fields,
})

# Muster 27 – Soziotherapeutischer Betreuungsplan
fields, f = form('27')
f('ik', 'IK des Leistungserbringers', 'text', 'praxis', (52.4, 14.7, 42.9, 2.9), [rule('m27.ik')], marker='❶')
f('ziele', 'Therapieziele (Nah- und Fernziele)', 'text', 'arzt', (9.5, 21.0, 85.7, 10.6), [rule('m27.therapieziele')], lines=4, marker='❷')
for i, y in enumerate((35.7, 38.6, 41.4, 44.3, 47.1, 50.0, 52.8, 55.7, 58.5), start=1):
    f(f'massnahme{i}', f'Maßnahme {i} (verordnet bzw. empfohlen, zu koordinieren)', 'text', 'arzt', (13.0, round(y - 2.0, 1), 82.2, 2.4), [rule('m27.massnahmen')] if i == 1 else [], marker='❸')
for i, y in enumerate((66.0, 68.8, 71.7, 74.5), start=1):
    rr = [rule('m27.durchfuehrung')] if i == 1 else []
    f(f'art{i}', f'Durchführung {i}: Art der Maßnahme', 'text', 'praxis', (9.5, y, 42.9, 2.8), rr, marker='❹')
    f(f'frequenz{i}', f'Durchführung {i}: Frequenz pro Woche/Monat', 'text', 'praxis', (52.4, y, 21.9, 2.8), rr, marker='❹')
    f(f'zeitraum{i}', f'Durchführung {i}: Zeitraum', 'text', 'praxis', (74.3, y, 20.9, 2.8), rr, marker='❹')
f('datum', 'Ausstellungsdatum', 'date', 'praxis', (9.6, 84.5, 23.3, 5.7), [rule('m27.vorlage')], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (34.3, 84.5, 22.9, 12.1),
  [{'id': 'm27.unterschrift', 'text': UNTERSCHRIFT, 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])
f('unterschrift_therapeut', 'Datum / Unterschrift des Therapeuten', 'text', 'leistungserbringer', (58.6, 84.5, 36.6, 5.7), [rule('m27.therapieziele')])
f('unterschrift_patient', 'Datum / Unterschrift des Patienten', 'text', 'versicherter', (58.6, 90.9, 36.6, 5.7), [rule('m27.therapieziele')])
write('muster-27', {
    'schema_version': '1.0.0', 'id': 'muster-27', 'muster': '27', 'title': 'Soziotherapeutischer Betreuungsplan gemäß § 37a SGB V',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'blau'},
    'copies': [{'id': '27a', 'label': 'Original', 'recipient': 'Krankenkasse (mit Muster 26)'},
               {'id': '27b', 'label': '1. Durchschlag', 'recipient': 'soziotherapeutischer Leistungserbringer'},
               {'id': '27c', 'label': '2. Durchschlag', 'recipient': 'verordnender Arzt'}],
    'notes': [rule('m27.abstimmung'), rule('m27.vorlage'), rule('m27.kostenuebernahme'), rule('m27.st_rl')],
    'groups': [],
    'fields': fields,
})
