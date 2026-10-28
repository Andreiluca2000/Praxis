"""Erzeugt data/forms/muster-52.json (Bericht für die Krankenkasse bei Fortbestehen der Arbeitsunfähigkeit).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 88–91), Lage der Felder aus der Mustersammlung (Seite 62).
python data/forms/generators/gen_m52.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '52' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def vordruck(rid, text):
    return rule(rid, text=text, locator='PDF-Seite 62, Muster 52 (4.2025)', artifact='mustersammlung')


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


CB = (2.9, 2.0)
f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', (4.4, 1.7, 38.0, 15.7),
  [rule('m52.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
for i, (x, w) in enumerate(((9.1, 13.9), (23.6, 13.9), (38.1, 13.9), (52.7, 13.9), (67.2, 13.9), (81.7, 14.5)), start=1):
    f(f'icd{i}', f'1. Diagnose {i} (ICD-10-Code)', 'text', 'arzt', (x, 21.0, w, 2.1), [rule('m52.diagnosen')] if i == 1 else [], marker='❶')
f('funktion', '1. ggf. sich daraus ergebende Funktionseinschränkungen', 'text', 'arzt', (9.1, 25.3, 87.1, 6.4), [rule('m52.diagnosen')], lines=3, marker='❶')
f('taetigkeit', '2.1 erwerbstätig als', 'text', 'praxis', (24.8, 35.3, 71.4, 2.1), [rule('m52.taetigkeit')], marker='❷')
f('stunden_woche', '2.1 regelmäßige Arbeitszeit (Stunden pro Woche)', 'number', 'praxis', (24.9, 38.1, 4.7, 2.1), [rule('m52.taetigkeit')], marker='❷')
f('alg', '2.2 Empfänger von Arbeitslosengeld', 'checkbox', 'praxis', (12.8, 42.5, 2.9, 2.0), [rule('m52.taetigkeit')], marker='❷')
f('alg_stunden', '2.2 der Arbeitsvermittlung zur Verfügung gestellt (Stunden pro Woche)', 'number', 'praxis', (80.6, 42.4, 4.7, 2.1), [rule('m52.taetigkeit')], marker='❷')
f('alg_leicht_nein', '2.2 leichte Tätigkeiten in diesem Umfang: nein', 'checkbox', 'arzt', (80.6, 45.3, *CB), [], group='alg_leicht', marker='❷')
f('alg_leicht_ja', '2.2 leichte Tätigkeiten in diesem Umfang: ja', 'checkbox', 'arzt', (89.0, 45.3, *CB), [], group='alg_leicht', marker='❷')
f('konservativ', '3. konservativ (ggf. wann und welche)', 'text', 'arzt', (24.8, 51.0, 71.4, 2.1), [rule('m52.massnahmen')], marker='❸')
f('operativ', '3. operativ (ggf. wann und welche)', 'text', 'arzt', (24.8, 53.8, 71.4, 2.1), [rule('m52.massnahmen')], marker='❸')
f('heilmittel', '3. Heilmittel (ggf. seit wann und welche)', 'text', 'arzt', (24.8, 56.7, 71.4, 2.1), [rule('m52.massnahmen')], marker='❸')
GILT = vordruck('m52.wiedereingliederung', 'Stufenweise Wiedereingliederung „gilt nicht für Arbeitslose“ (Aufdruck auf dem Vordruck).')
f('stw_geplant', '3. Stufenweise Wiedereingliederung geplant', 'checkbox', 'arzt', (34.6, 59.6, *CB), [GILT], group='stw', marker='❸')
f('stw_eingeleitet', '3. Stufenweise Wiedereingliederung eingeleitet', 'checkbox', 'arzt', (46.7, 59.6, *CB), [], group='stw', marker='❸')
f('reha_geplant', '3. Medizinische Rehabilitation geplant', 'checkbox', 'arzt', (34.6, 62.4, *CB), [], group='reha', marker='❸')
f('reha_beantragt', '3. Medizinische Rehabilitation beantragt', 'checkbox', 'arzt', (46.7, 62.4, *CB), [], group='reha', marker='❸')
f('schulung_geplant', '3. Patientenschulung geplant', 'checkbox', 'arzt', (34.6, 65.3, *CB), [], group='schulung', marker='❸')
f('schulung_eingeleitet', '3. Patientenschulung eingeleitet', 'checkbox', 'arzt', (46.7, 65.3, *CB), [], group='schulung', marker='❸')
f('sonstige', '3. Sonstige (therapeutische) Maßnahmen (ggf. wann und welche)', 'text', 'arzt', (9.1, 70.9, 61.7, 6.4), [rule('m52.massnahmen')], lines=3, marker='❸')
f('keine', '3. keine Maßnahmen', 'checkbox', 'arzt', (9.2, 78.1, *CB), [rule('m52.massnahmen')], marker='❸')
f('keine_begruendung', '3. Begründung, warum keine Maßnahmen', 'text', 'arzt', (24.8, 78.1, 46.0, 4.3), [rule('m52.massnahmen')], lines=2, marker='❸')
f('ueberw_nein', '4. Überweisung zur fachärztlichen Mitbehandlung: nein', 'checkbox', 'praxis', (9.2, 85.2, *CB), [], group='ueberweisung', marker='❹')
f('ueberw_ja', '4. Überweisung zur fachärztlichen Mitbehandlung: ja', 'checkbox', 'praxis', (18.9, 85.2, *CB), [], group='ueberweisung', marker='❹')
f('fachrichtung', '4. Fachrichtung', 'text', 'praxis', (34.5, 85.2, 36.3, 2.1), [rule('m52.ueberweisung')], marker='❹')
f('em_nein', '5. Erwerbsminderung: nein', 'checkbox', 'arzt', (9.2, 90.9, *CB), [], group='erwerbsminderung', marker='❺')
f('em_ja', '5. Erwerbsminderung besteht oder droht: ja', 'checkbox', 'arzt', (18.9, 90.9, *CB), [], group='erwerbsminderung', marker='❺')
f('datum', 'Ausstellungsdatum', 'date', 'praxis', (56.3, 93.7, 14.5, 2.1), [rule('m52.frist')], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / ärztliche Unterschrift', 'stempel', 'arzt', (73.5, 83.8, 22.7, 12.0),
  [{'id': 'm52.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-52', 'muster': '52', 'title': 'Bericht für die Krankenkasse bei Fortbestehen der Arbeitsunfähigkeit',
    'form_version': '4.2025', 'released': '2024-11-06', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'copies': [{'id': '52', 'label': 'Bericht', 'recipient': 'Krankenkasse (Freiumschlag der Kasse)'}],
    'notes': [rule('m52.anforderung'), rule('m52.frist'), rule('m52.au_rl'), rule('m52.einleitung'), rule('m52.erwerbsminderung'),
              vordruck('m52.ebm', 'Für das Ausstellen dieses Berichts ist die Nr. 01622 EBM berechnungsfähig (Aufdruck auf dem Vordruck).')],
    'groups': [
        {'id': 'alg_leicht', 'label': '2.2 Leichte Tätigkeiten im angegebenen Umfang möglich', 'select': 'genau_eins', 'rule': rule('m52.taetigkeit')},
        {'id': 'stw', 'label': 'Stufenweise Wiedereingliederung', 'select': 'beliebig', 'rule': rule('m52.einleitung')},
        {'id': 'reha', 'label': 'Medizinische Rehabilitation', 'select': 'beliebig', 'rule': rule('m52.einleitung')},
        {'id': 'schulung', 'label': 'Patientenschulung', 'select': 'beliebig', 'rule': rule('m52.einleitung')},
        {'id': 'ueberweisung', 'label': '4. Überweisung zur fachärztlichen Mitbehandlung', 'select': 'genau_eins', 'rule': rule('m52.ueberweisung')},
        {'id': 'erwerbsminderung', 'label': '5. Bestehende oder drohende Erwerbsminderung', 'select': 'genau_eins', 'rule': rule('m52.erwerbsminderung')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-52.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
