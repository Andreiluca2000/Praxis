"""Erzeugt data/forms/muster-20.json (Stufenweise Wiedereingliederung in das Erwerbsleben – Wiedereingliederungsplan).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 64–65), Lage der Felder aus der Mustersammlung (Seite 36, Muster 20a).
python data/forms/generators/gen_m20.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '20' for r in e['rules']}


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


f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., BSNR, LANR, Datum)', 'personalien', 'duria', (4.4, 1.7, 38.0, 15.7),
  [rule('m20.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('taetigkeit', 'zuletzt ausgeübte Tätigkeit', 'text', 'praxis', (44.2, 9.6, 52.0, 7.8), [rule('m20.letzte_taetigkeit')], lines=3, marker='❶')
f('stunden_vorher', 'Stunden täglich (vor Beginn der AU)', 'number', 'praxis', (89.6, 15.3, 6.7, 2.1), [rule('m20.letzte_taetigkeit')], marker='❶')
for i, y in enumerate((28.2, 31.0, 33.9, 36.7), start=1):
    rr = [rule('m20.gestaltung')] if i == 1 else []
    f(f'vom{i}', f'Stufe {i}: vom', 'date', 'praxis', (9.2, y, 14.4, 2.1), rr, format='TTMMJJ', marker='❷')
    f(f'bis{i}', f'Stufe {i}: bis', 'date', 'praxis', (26.1, y, 14.4, 2.1), [rule('m20.dauer')] if i == 1 else [], format='TTMMJJ', marker='❷')
    f(f'art{i}', f'Stufe {i}: Art der Tätigkeit (ggf. Einschränkungen)', 'text', 'praxis', (44.2, y, 43.5, 2.1), rr, marker='❷')
    f(f'std{i}', f'Stufe {i}: Stunden täglich', 'number', 'praxis', (89.6, y, 6.7, 2.1), rr, marker='❷')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (73.4, 41.0, 22.7, 12.0),
  [{'id': 'm20.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])
f('erklaerung_versicherter', 'Erklärung des Versicherten (Einverständnis, Datum, Unterschrift)', 'text', 'versicherter', (9.1, 55.4, 87.0, 9.4), [rule('m20.einverstaendnis_versicherter')], marker='❸')
f('erklaerung_arbeitgeber', 'Erklärung des Arbeitgebers (Einverständnis, Voraussetzungen, Arbeitsentgelt, Stempel)', 'text', 'arbeitgeber', (9.1, 66.8, 87.0, 28.6), [rule('m20.zustimmung_arbeitgeber')], marker='❹')

doc = {
    'schema_version': '1.0.0', 'id': 'muster-20', 'muster': '20', 'title': 'Stufenweise Wiedereingliederung in das Erwerbsleben (Wiedereingliederungsplan)',
    'form_version': '1.2019', 'released': '2018-10-15', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'gelb'},
    'copies': [
        {'id': '20a', 'label': 'Ausfertigung für den Arbeitgeber', 'recipient': 'Arbeitgeber'},
        {'id': '20b', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse'},
        {'id': '20c', 'label': 'Ausfertigung für den Versicherten', 'recipient': 'Versicherte/r'},
        {'id': '20d', 'label': 'Ausfertigung für den Vertragsarzt', 'recipient': 'Praxis'},
    ],
    'notes': [rule('m20.au_besteht'), rule('m20.zusammenarbeit'), rule('m20.grundlage'), rule('m20.aenderungen'),
              {'id': 'm20.ebm', 'text': 'Für die Erstellung des ärztlichen Wiedereingliederungsplanes ist die Nr. 01622 EBM berechnungsfähig (Aufdruck auf dem Vordruck).', 'source': {'artifact': 'mustersammlung', 'locator': 'PDF-Seite 36, Muster 20a (1.2019)'}}],
    'groups': [],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-20.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
