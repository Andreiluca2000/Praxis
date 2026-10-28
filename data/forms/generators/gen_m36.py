"""Erzeugt data/forms/muster-36.json (Empfehlung zur verhaltensbezogenen Primärprävention gem. § 20 Abs. 5 SGB V).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 80), Lage der Felder aus der Mustersammlung (Seite 55).
python data/forms/generators/gen_m36.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '36' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where='PDF-Seite 55'):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 36 (7.2017)'}}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


CB = (2.8, 4.0)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, Vorname des Versicherten, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (6.2, 4.9, 53.9, 44.5),
  [{'id': 'm36.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}])
for id_, label, y in [('bewegung', 'Bewegungsgewohnheiten', 17.3), ('ernaehrung', 'Ernährung', 21.2), ('stress', 'Stressmanagement', 25.3), ('sucht', 'Suchtmittelkonsum', 29.3)]:
    f(id_, label, 'checkbox', 'arzt', (62.8, y) + CB, [rule('m36.handlungsfelder')] if id_ == 'bewegung' else [], group='handlungsfelder', marker='❶')
f('sonstiges', 'Sonstiges', 'text', 'arzt', (72.1, 33.3, 23.2, 4.0), [rule('m36.handlungsfelder')], marker='❶')
f('hinweise', 'Hinweise des behandelnden Arztes (z.B. Kontraindikationen, Konkretisierung zur Präventionsempfehlung)', 'text', 'arzt', (6.1, 69.6, 54.1, 24.2),
  [rule('m36.hinweise')], marker='❷', lines=4)
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (62.8, 59.7, 32.5, 34.0),
  [{'id': 'm36.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-36', 'muster': '36', 'title': 'Empfehlung zur verhaltensbezogenen Primärprävention gem. § 20 Abs. 5 SGB V',
    'form_version': '7.2017', 'released': '2017-05-09', 'status': 'entwurf',
    'paper': {'format': 'DIN A6 quer', 'width': 419.5, 'height': 297.6, 'tint': 'ohne'},
    'copies': [{'id': '36', 'label': 'Präventionsempfehlung', 'recipient': 'Patient (beantragt damit bei seiner Krankenkasse einen Kurs zur Primärprävention)'}],
    'notes': [rule('m36.zweck'),
              ms('m36.hinweis_kasse', 'Aufdruck: Der Patient soll sich bei seiner Krankenkasse über die geprüften und anerkannten Präventionsangebote und die Fördervoraussetzungen informieren.')],
    'groups': [{'id': 'handlungsfelder', 'label': 'Empfohlene Handlungsfelder', 'select': 'beliebig', 'rule': rule('m36.handlungsfelder')}],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-36.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
