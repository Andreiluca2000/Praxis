"""Erzeugt data/forms/muster-28.json (Verordnung bei Überweisung zur Indikationsstellung für Soziotherapie, max. 5 Therapieeinheiten).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 77–79), Lage der Felder aus der Mustersammlung (Seite 52, Ausfertigung 28a).
python data/forms/generators/gen_m28.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '28' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 28a (10.2017)'}}


fields = []
CB = (3.0, 2.1)
SIGN = {'id': 'm28.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}
PERS = {'id': 'm28.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
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
f('diagnose', 'Diagnose (ICD-10-Code)', 'text', 'arzt', (54.5, 12.5, 33.3, 2.1), [rule('m28.diagnose')], marker='❶')
f('erkrankung_seit', 'Erkrankung besteht seit (falls bekannt)', 'date', 'arzt', (73.2, 15.3, 14.5, 2.1), [rule('m28.erkrankung_seit')], format='TTMMJJ', marker='❷')
cb('kh_vermieden', 'Krankenhausbehandlung wird vermieden', 30.4, 18.9, [rule('m28.krankenhaus')], group='krankenhaus', marker='❸')
cb('kh_verkuerzt', 'Krankenhausbehandlung wird verkürzt', 44.9, 18.9, group='krankenhaus', marker='❸')
cb('kh_nicht_ausfuehrbar', 'Krankenhausbehandlung ist nicht ausführbar', 59.3, 18.9, group='krankenhaus', marker='❸')
f('le_name', 'Name des soziotherapeutischen Leistungserbringers (Erklärung des Arztes: ziehe ich folgenden soziotherapeutischen Leistungserbringer hinzu)', 'text', 'arzt',
  (10.4, 28.4, 42.9, 1.9), [rule('m28.erklaerung'), rule('m28.leistungserbringer')], marker='❹')
f('le_strasse', 'Straße (soziotherapeutischer Leistungserbringer)', 'text', 'arzt', (10.4, 31.3, 42.9, 1.8), marker='❹')
f('le_plz', 'PLZ (soziotherapeutischer Leistungserbringer)', 'text', 'arzt', (10.4, 34.2, 12.1, 1.8), marker='❹')
f('le_ort', 'Ort (soziotherapeutischer Leistungserbringer)', 'text', 'arzt', (23.0, 34.2, 30.3, 1.8), marker='❹')
f('datum', 'Datum', 'date', 'praxis', (57.6, 38.1, 14.4, 2.1),
  [ms('m28.datum', 'Ausstellungsdatum der Verordnung (Feld „Datum“ neben dem Vertragsarztstempel).', 'PDF-Seite 52')], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (73.5, 28.2, 22.7, 12.0), [SIGN])

# Felder ab ❺ füllt der soziotherapeutische Leistungserbringer aus
f('ik', 'IK des Leistungserbringers', 'text', 'leistungserbringer', (29.8, 46.8, 21.6, 2.0), [rule('m28.ik')], marker='❺')
for n in range(1, 6):
    y = (55.3, 58.2, 61.0, 63.9, 66.7)[n - 1]
    f(f'leistung_datum_{n}', f'Abrechnung des soziotherapeutischen Leistungserbringers, Zeile {n}: Datum', 'date', 'leistungserbringer', (10.4, y, 14.4, 2.0),
      [rule('m28.abrechnung')] if n == 1 else [], format='TTMMJJ', marker='❻')
    f(f'leistung_{n}', f'Abrechnung des soziotherapeutischen Leistungserbringers, Zeile {n}: Leistung', 'text', 'leistungserbringer', (26.1, y, 70.2, 2.1), marker='❻')
f('kontoinhaber', 'Bemerkungen zur Abrechnung: Kontoinhaber', 'text', 'leistungserbringer', (10.3, 75.2, 61.7, 2.1), [rule('m28.bemerkungen')], marker='❼')
f('iban', 'Bemerkungen zur Abrechnung: IBAN', 'text', 'leistungserbringer', (10.4, 79.5, 53.1, 2.0), marker='❼')
f('bic', 'Bemerkungen zur Abrechnung: BIC', 'text', 'leistungserbringer', (10.4, 83.8, 26.5, 2.0), marker='❼')
f('geldinstitut', 'Bemerkungen zur Abrechnung: Geldinstitut', 'text', 'leistungserbringer', (38.1, 83.8, 33.9, 2.1), marker='❼')
f('datum_le', 'Datum (soziotherapeutischer Leistungserbringer)', 'date', 'leistungserbringer', (57.5, 93.7, 14.5, 2.1), format='TTMMJJ', marker='❼')
f('stempel_le', 'Stempel und Unterschrift des soziotherapeutischen Leistungserbringers', 'stempel', 'leistungserbringer', (73.5, 83.8, 22.7, 12.0), marker='❼')

doc = {
    'schema_version': '1.0.0', 'id': 'muster-28', 'muster': '28',
    'title': 'Verordnung bei Überweisung zur Indikationsstellung für Soziotherapie gemäß § 37a SGB V im Umfang von maximal 5 Therapieeinheiten',
    'form_version': '10.2017', 'released': '2017-07-07', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'blau'},
    'copies': [
        {'id': '28a', 'label': 'Ausfertigung für die Krankenkasse (Original)', 'recipient': 'Krankenkasse (vom soziotherapeutischen Leistungserbringer weiterzuleiten)'},
        {'id': '28b', 'label': 'Ausfertigung für den soziotherapeutischen Leistungserbringer (1. Durchschlag)', 'recipient': 'soziotherapeutischer Leistungserbringer'},
        {'id': '28c', 'label': 'Ausfertigung für den verordnenden Arzt (2. Durchschlag)', 'recipient': 'verbleibt in der Praxis'},
    ],
    'notes': [rule('m28.voraussetzung'), rule('m28.st_rl_durchschlaege'), rule('m28.keine_genehmigung'),
              ms('m28.ebm_30800', 'Für das Ausstellen dieses Vordrucks ist die Nr. 30800 EBM berechnungsfähig (Hinweis auf dem Vordruck).', 'PDF-Seite 52'),
              ms('m28.le_erklaerung', 'Der soziotherapeutische Leistungserbringer erklärt auf dem Vordruck, dass er einen Vertrag gem. § 132b SGB V geschlossen hat oder eine vergleichbare Abrechnungsgenehmigung der zuständigen Krankenkasse vorliegt.', 'PDF-Seite 52'),
              ms('m28.weiterleitung', 'Die Ausfertigung für die Krankenkasse ist vom soziotherapeutischen Leistungserbringer an die Krankenkasse weiterzuleiten (Hinweis auf dem Vordruck).', 'PDF-Seite 52')],
    'groups': [{'id': 'krankenhaus', 'label': 'Krankenhausbehandlung wird vermieden / wird verkürzt / ist nicht ausführbar', 'select': 'beliebig', 'rule': rule('m28.krankenhaus')}],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-28.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
