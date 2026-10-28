"""Erzeugt data/forms/muster-05.json (Abrechnungsschein ambulante Behandlung, belegärztliche Behandlung, Abklärung somatischer Ursachen, anerkannte Psychotherapie).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 24–25), Lage der Felder aus der Mustersammlung (Seite 10).
python data/forms/generators/gen_m05.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '5' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 5 (10.2014)'}}


fields = []
CB = (2.3, 3.3)


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'praxis', (x, y) + CB, rules, **kw)


f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria',
  (4.3, 3.4, 38.0, 31.7),
  [{'id': 'm05.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}])
cb('ambulant', 'ambulante Behandlung', 44.2, 6.5, [rule('m05.ambulant_beleg')], group='behandlungsart')
cb('belegaerztlich', 'bei belegärztlicher Behandlung', 55.1, 6.5, group='behandlungsart')
cb('unfall', 'Unfall, Unfallfolgen', 68.4, 6.5, [rule('m05.unfall'), rule('m05.arbeitsunfall')])
f('quartal', 'Quartal', 'quarter', 'praxis', (88.1, 6.5, 7.5, 3.2), [rule('m05.quartal')], format='QJJ')
cb('konsiliar', 'Abklärung somatischer Ursachen vor Aufnahme einer Psychotherapie', 44.2, 11.8, [rule('m05.konsiliar')])
cb('psychotherapie', 'anerkannte Psychotherapie', 68.4, 11.8, [rule('m05.psychotherapie')])
f('geschlecht', 'Geschlecht', 'letter', 'duria', (93.8, 11.8, 1.8, 3.3), [rule('m05.geschlecht')])
f('diagnose1', 'Diagnosen / ggf. Abrechnungsbegründungen, 1. Zeile', 'text', 'arzt', (44.2, 20.4, 51.4, 3.3), [rule('m05.diagnosen'), rule('m05.platzmangel')])
f('diagnose2', 'Diagnosen / ggf. Abrechnungsbegründungen, 2. Zeile', 'text', 'arzt', (44.2, 26.1, 51.4, 3.3))
f('anerkennungsbescheid', 'Bei Psychotherapie: Datum des Anerkennungsbescheides', 'date', 'praxis', (84.2, 31.9, 11.3, 3.2), [rule('m05.psychotherapie')], format='TTMMJJ')
f('leistungen_links', 'Leistungen (linke Spalte): Tag, Mon., Gebührenordnungsposition', 'text', 'praxis', (4.3, 40.4, 33.1, 54.8),
  [rule('m05.leistungen'), rule('m05.begruendung_op'), rule('m05.labor_datum'), rule('m05.platzmangel')], lines=10)
f('leistungen_rechts', 'Leistungen (rechte Spalte): Tag, Mon., Gebührenordnungsposition', 'text', 'praxis', (38.2, 40.4, 33.1, 54.8), [rule('m05.leistungen')], lines=10)
f('entbindung', 'Mutmaßlicher Tag der Entbindung', 'date', 'praxis', (75.7, 46.1, 13.4, 3.3), [rule('m05.mutterschaft')], format='TTMMJJ')
f('belegarzt_von', 'Stationäre belegärztliche Behandlung von (Tag, Monat)', 'text', 'praxis', (75.7, 57.5, 8.5, 3.3), [rule('m05.belegarzt_zeitraum')])
f('belegarzt_bis', 'Stationäre belegärztliche Behandlung bis (Tag, Monat)', 'text', 'praxis', (87.8, 57.5, 8.5, 3.3), [rule('m05.belegarzt_zeitraum')])
f('versicherung_bestaetigung', 'Ich bin bei der oben genannten Krankenkasse versichert (Datum, Unterschrift)', 'text', 'versicherter', (72.6, 67.8, 23.8, 5.8),
  [rule('m05.patient_unterschrift'), rule('m05.unterschrift_entfaellt')])
f('stempel', 'Stempel des Vertragsarztes/Therapeuten', 'stempel', 'arzt', (72.2, 77.1, 24.6, 18.0),
  [{'id': 'm05.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

groups = [{'id': 'behandlungsart', 'label': 'Ambulante oder belegärztliche Behandlung', 'select': 'genau_eins', 'rule': rule('m05.ambulant_beleg')}]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-05', 'muster': '5',
    'title': 'Abrechnungsschein ambulante Behandlung, belegärztliche Behandlung, Abklärung somatischer Ursachen vor Aufnahme einer Psychotherapie, anerkannte Psychotherapie',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 quer', 'width': 595.3, 'height': 419.5, 'tint': 'blau'},
    'copies': [{'id': '5', 'label': 'Abrechnungsschein', 'recipient': 'Kassenärztliche Vereinigung (Quartalsabrechnung)'}],
    'notes': [rule('m05.arbeitsunfall'), rule('m05.datentraeger'),
              ms('m05.aufdruck', 'Aufdruck: Nicht zu verwenden bei Arbeitsunfällen, Berufskrankheiten und Schülerunfällen.', 'PDF-Seite 10')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-05.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
