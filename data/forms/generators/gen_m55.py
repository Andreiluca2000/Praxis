"""Erzeugt data/forms/muster-55.json (Bescheinigung einer schwerwiegenden chronischen Erkrankung gem. § 62 SGB V).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 93–94), Lage der Felder aus der Mustersammlung (Seite 65).
python data/forms/generators/gen_m55.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '55' for r in e['rules']}


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


f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', (6.2, 4.9, 53.9, 44.5),
  [rule('m55.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('seit', 'Seit (Dauerbehandlung wegen derselben Erkrankung)', 'date', 'praxis', (68.0, 24.2, 20.6, 5.0), [rule('m55.dauerbehandlung')], format='TTMMJJ', marker='❶')
for i, x in enumerate((6.1, 25.0, 43.8), start=1):
    f(f'icd{i}', f'Dauerdiagnose {i} (ICD-10-Code)', 'text', 'arzt', (x, 56.5, 16.3, 5.0), [rule('m55.diagnosen')] if i == 1 else [], marker='❷')
f('versorgung_unbefristet', 'ja, Ende der Dauerbehandlung derzeit nicht absehbar', 'checkbox', 'praxis', (6.2, 69.7, 2.7, 3.8), [], group='versorgung', marker='❸', label_pos='rechts')
f('versorgung_bis', 'ja, voraussichtlich bis', 'checkbox', 'praxis', (6.2, 73.8, 2.7, 3.8), [], group='versorgung', marker='❸', label_pos='rechts')
f('bis', 'voraussichtlich bis (MMJJ)', 'date', 'praxis', (30.1, 73.6, 10.3, 4.0), [rule('m55.versorgung')], format='MMJJ', marker='❸')
f('versorgung_nein', 'nein', 'checkbox', 'praxis', (6.2, 77.8, 2.7, 3.7), [], group='versorgung', marker='❸', label_pos='rechts')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (63.0, 59.7, 32.2, 34.0),
  [{'id': 'm55.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-55', 'muster': '55', 'title': 'Bescheinigung einer schwerwiegenden chronischen Erkrankung gem. § 62 SGB V',
    'form_version': '10.2016', 'released': '2016-07-08', 'status': 'entwurf',
    'paper': {'format': 'DIN A6 quer', 'width': 419.5, 'height': 297.6, 'tint': 'gelb'},
    'copies': [{'id': '55', 'label': 'Bescheinigung', 'recipient': 'Krankenkasse (über die Versicherte/den Versicherten)'}],
    'notes': [rule('m55.anlass'), rule('m55.mehrfach'), rule('m55.chroniker_rl'), rule('m55.rueckseite'),
              {'id': 'm55.ebm', 'text': 'Die Vergütung für das Ausstellen erfolgt über die hausärztliche Versichertenpauschale bzw. ist die Nr. 01610 EBM berechnungsfähig (Aufdruck auf dem Vordruck).', 'source': {'artifact': 'mustersammlung', 'locator': 'PDF-Seite 65, Muster 55 (10.2016)'}}],
    'groups': [{'id': 'versorgung', 'label': 'Kontinuierliche medizinische Versorgung weiterhin erforderlich', 'select': 'genau_eins', 'rule': rule('m55.versorgung')}],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-55.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
