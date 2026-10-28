"""Erzeugt data/forms/muster-62a.json (Ergebnis der Erhebung des Beatmungsentwöhnungs- bzw. Dekanülierungspotenzials gemäß AKI-Richtlinie).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 119–122), Lage der Felder aus der Mustersammlung (Seite 79, Ausfertigung 62Aa; Seiten 80/81 deckungsgleich).
python data/forms/generators/gen_m62a.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '62A' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []
CB = (2.9, 2.0)
SIGN = {'id': 'm62a.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}
PERS = {'id': 'm62a.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
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
f('massnahmen', 'Maßnahmen zur Prüfung des Potenzials oder der Therapieoptimierung (z.B. Spontanatmungstest durchgeführt, NIV-Versuch, FEES, Entblockungsversuche)',
  'text', 'arzt', (10.3, 21.0, 85.9, 7.8), [rule('m62a.massnahmen')], lines=3, marker='❶')
f('schluckdiagnostik', 'Befunde der ärztlichen Schluckdiagnostik', 'text', 'arzt', (10.3, 31.0, 85.9, 2.1), [rule('m62a.schluck')], marker='❷')

# ❸ Ergebnis der Erhebung
cb('vor_beatmung', 'Potenzial liegt vor: zur Beatmungsentwöhnung', 45.5, 38.2, [rule('m62a.ergebnis')], group='potenzial_vor', marker='❸')
cb('vor_dekanuelierung', 'Potenzial liegt vor: zur Dekanülierung', 70.9, 38.2, group='potenzial_vor', marker='❸')
f('empfehlung_einrichtung', 'Empfehlung zur Beatmungsentwöhnung bzw. Dekanülierung in folgenden spezialisierten Einrichtungen', 'text', 'arzt', (10.3, 42.4, 72.0, 5.0), lines=2, marker='❸')
f('termin', 'geplanter Termin', 'date', 'arzt', (84.2, 42.4, 9.5, 2.1), format='MMJJ', marker='❸')
cb('persp_beatmung', 'Potenzial kann perspektivisch vorliegen: zur Beatmungsentwöhnung', 45.5, 48.2, group='potenzial_perspektivisch', marker='❸')
cb('persp_dekanuelierung', 'Potenzial kann perspektivisch vorliegen: zur Dekanülierung', 70.9, 48.2, group='potenzial_perspektivisch', marker='❸')
f('vorbereitende_massnahmen', 'erforderliche vorbereitende Maßnahmen (bspw. Lagerungstherapie, Mobilisation, Physiotherapie, Logopädie, Atmungstherapie)', 'text', 'arzt',
  (10.3, 52.4, 85.9, 5.0), lines=2, marker='❸')
cb('nicht_beatmung', 'Potenzial liegt nicht vor: zur Beatmungsentwöhnung', 45.5, 58.2, group='potenzial_nicht', marker='❸')
cb('nicht_dekanuelierung', 'Potenzial liegt nicht vor: zur Dekanülierung', 70.9, 58.1, group='potenzial_nicht', marker='❸')
f('begruendung', 'Begründung (Potenzial liegt nicht vor)', 'text', 'arzt', (10.3, 62.4, 85.9, 2.1), marker='❸')
f('therapieoptimierung', 'Maßnahmen der Therapieoptimierung (ggf. Einweisung in spezialisierte Einrichtung) sowie weitere Hinweise zum klinischen Status', 'text', 'arzt',
  (10.3, 68.1, 85.9, 4.9), [rule('m62a.therapieoptimierung')], lines=2, marker='❹')
cb('entfall_erhebung', 'Innerhalb von mindestens zwei Jahren wurde zweimal in Folge im Rahmen einer unmittelbar persönlichen Erhebung festgestellt, dass keine Aussicht auf nachhaltige Besserung der zu Grunde liegenden Funktionsstörung besteht und eine Entwöhnung oder Dekanülierung dauerhaft nicht möglich ist. Eine regelmäßige Erhebung des Beatmungsentwöhnungs- bzw. Dekanülierungspotenzials ist nicht mehr angezeigt.',
   10.4, 73.8, [rule('m62a.entfall_erhebung')], marker='❺')
cb('entfall_therapieoptimierung', 'Eine Erhebung zum Zwecke der Therapieoptimierung und zur Verbesserung der Lebensqualität ist nicht mehr angezeigt.', 10.4, 79.5,
   [rule('m62a.therapieoptimierung_entfall')], marker='❻')
f('erlaeuterungen', 'Weitere Erläuterungen', 'text', 'arzt', (10.3, 85.2, 42.9, 10.6), [rule('m62a.erlaeuterungen_datum')], lines=4, marker='❼')
f('datum_erhebung', 'Ergebnis der Erhebung festgestellt am', 'date', 'arzt', (56.4, 88.0, 14.4, 2.1), format='TTMMJJ', marker='❽')
f('datum_naechste', 'Erneute Erhebung geplant am', 'date', 'arzt', (56.4, 93.7, 14.4, 2.1), format='TTMMJJ', marker='❾')
f('stempel', 'Vertragsarztstempel / ärztliche Unterschrift', 'stempel', 'arzt', (73.5, 83.8, 22.7, 12.0), [SIGN])

groups = [
    {'id': 'potenzial_vor', 'label': 'Potenzial liegt vor', 'select': 'beliebig', 'rule': rule('m62a.ergebnis')},
    {'id': 'potenzial_perspektivisch', 'label': 'Potenzial kann perspektivisch vorliegen', 'select': 'beliebig', 'rule': rule('m62a.ergebnis')},
    {'id': 'potenzial_nicht', 'label': 'Potenzial liegt nicht vor', 'select': 'beliebig', 'rule': rule('m62a.ergebnis')},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-62a', 'muster': '62A',
    'title': 'Ergebnis der Erhebung des Beatmungsentwöhnungs- bzw. Dekanülierungspotenzials gemäß AKI-Richtlinie des G-BA',
    'form_version': '1.2023', 'released': '2022-05-10', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'copies': [
        {'id': '62Aa', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse'},
        {'id': '62Ab', 'label': 'Ausfertigung für den verordnenden Arzt', 'recipient': 'verordnende Ärztin / verordnender Arzt'},
        {'id': '62Ac', 'label': 'Ausfertigung für den potenzialerhebenden Arzt', 'recipient': 'verbleibt beim potenzialerhebenden Arzt'},
    ],
    'notes': [rule('m62a.voraussetzung'), rule('m62a.qualifikation'), rule('m62a.persoenlich'), rule('m62a.intervall'), rule('m62a.empfaenger')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-62a.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
