"""Erzeugt data/forms/muster-19.json (Notfall-/Vertretungsschein). Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 63)
und vom Vordruck selbst (Mustersammlung Seite 33–35); Lage der Felder nach Muster 19b (Seite 34, ohne Schwärzung).
python data/forms/generators/gen_m19.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '19' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def vordruck(rid, text, seite='33, Muster 19a (10.2014)'):
    return rule(rid, text=text, locator=f'PDF-Seite {seite}', artifact='mustersammlung')


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', (4.4, 3.5, 38.0, 31.6),
  [rule('m19.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('notfalldienst', 'ärztlicher Notfalldienst', 'checkbox', 'praxis', (44.3, 6.9, 2.2, 3.2), [], group='art', label_pos='rechts')
f('vertretung', 'Urlaubs- bzw. Krankheitsvertretung', 'checkbox', 'praxis', (56.4, 6.9, 2.2, 3.2), [], group='art', label_pos='rechts')
f('notfall', 'Notfall', 'checkbox', 'praxis', (73.3, 6.9, 2.2, 3.2), [], group='art', label_pos='rechts')
f('quartal', 'Quartal', 'quarter', 'praxis', (88.1, 6.9, 7.5, 3.2), [vordruck('m19.quartal', 'Quartal der Behandlung in der Form QJJ (Kästchen „Quartal“ auf dem Vordruck).')], format='QJJ')
f('unfall', 'Unfall, Unfallfolgen', 'checkbox', 'praxis', (44.3, 11.8, 2.2, 3.2), [vordruck('m19.unfall', 'Ankreuzen, wenn die Behandlung wegen eines Unfalls oder seiner Folgen erfolgt; bei Arbeitsunfällen, Berufskrankheiten und Schülerunfällen ist der Vordruck nicht zu verwenden.')], label_pos='rechts')
f('geschlecht', 'Geschlecht', 'letter', 'duria', (90.0, 11.8, 5.6, 3.2), [rule('m19.geschlecht')])
f('diagnosen', 'Diagnosen / ggf. Abrechnungsbegründungen', 'text', 'arzt', (44.3, 20.4, 51.3, 14.7),
  [vordruck('m19.diagnosen', 'Diagnosen bzw. ggf. Abrechnungsbegründungen eintragen; ICD-10-Kodes mit Diagnosesicherheit.')], lines=3)
f('au_bis', 'Arbeitsunfähigkeit bescheinigt bis', 'date', 'praxis', (56.4, 37.6, 13.3, 3.2), [vordruck('m19.au_bis', 'Wurde Arbeitsunfähigkeit bescheinigt, das Enddatum eintragen (TT MM JJ).')], format='TTMMJJ')
f('befunde', 'Befunde/Therapie', 'text', 'arzt', (3.1, 43.0, 66.8, 15.0), [vordruck('m19.befunde', 'Befunde und Therapie auf Teil b eintragen („bitte auf Teil b eintragen!“) – auf Teil a ist das Feld aus Datenschutzgründen geschwärzt.')], lines=3)
f('weiterbehandelnder_arzt', 'Teil b erhält weiterbehandelnder Arzt', 'text', 'praxis', (72.7, 37.6, 22.9, 20.3), [rule('m19.teil_b'), rule('m19.teil_b_entfaellt')], lines=3)
f('leistungen', 'Tag, Monat und Gebührenordnungspositionen (Abrechnung)', 'text', 'praxis', (3.1, 59.8, 67.0, 26.8),
  [vordruck('m19.leistungen', 'Je Behandlungstag Tag, Monat und die abgerechneten Gebührenordnungspositionen; die Abrechnung erfolgt über das PVS.')])
f('versichert', 'Ich bin bei der oben genannten Krankenkasse versichert (Datum, Unterschrift des Versicherten)', 'text', 'versicherter', (3.1, 86.9, 41.0, 10.0),
  [vordruck('m19.versichert', 'Die/der Versicherte bestätigt mit Datum und Unterschrift, bei der genannten Krankenkasse versichert zu sein.')])
f('stempel', 'Vertragsarztstempel / Unterschrift', 'stempel', 'arzt', (72.7, 71.9, 22.9, 22.6),
  [{'id': 'm19.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-19', 'muster': '19', 'title': 'Notfall-/Vertretungsschein',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 quer', 'width': 595.3, 'height': 419.5, 'tint': 'gelb'},
    'copies': [
        {'id': '19a', 'label': 'Teil a – Abrechnung', 'recipient': 'Kassenärztliche Vereinigung (über die Abrechnung)'},
        {'id': '19b', 'label': 'Teil b – Mitteilung', 'recipient': 'weiterbehandelnder Arzt'},
        {'id': '19c', 'label': 'Teil c', 'recipient': 'vertretender Arzt (verbleibt in der Praxis)'},
    ],
    'notes': [rule('m19.teil_a_schwaerzung'), rule('m19.teil_b'), rule('m19.teil_b_entfaellt'),
              vordruck('m19.arbeitsunfall', 'Nicht zu verwenden bei Arbeitsunfällen, Berufskrankheiten und Schülerunfällen.')],
    'groups': [{'id': 'art', 'label': 'Art der Inanspruchnahme', 'select': 'genau_eins',
                'rule': vordruck('m19.art', 'Anzukreuzen ist, ob die Behandlung im ärztlichen Notfalldienst, als Urlaubs- bzw. Krankheitsvertretung oder als Notfall erfolgt.')}],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-19.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
