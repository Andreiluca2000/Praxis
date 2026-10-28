"""Erzeugt data/forms/muster-11.json (Bericht für den Medizinischen Dienst).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 42), Lage der Felder aus der Mustersammlung (Seite 22).
python data/forms/generators/gen_m11.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '11' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 11 (1.2015)'}}


fields = []
CB = (3.3, 2.4)


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y) + CB, rules, **kw)


# Mustersammlung S. 22
f('datum_untersuchung', 'Datum der letzten Untersuchung', 'date', 'arzt', (35.3, 16.2, 20.5, 2.4), [rule('m11.rueckruf')], format='TTMMJJ')
f('diagnose', 'Diagnose', 'text', 'arzt', (14.7, 19.4, 80.7, 5.3), [rule('m11.diagnose')], lines=2)
f('befunde', 'Befunde', 'text', 'arzt', (14.7, 26.5, 80.7, 11.6), [rule('m11.befunde')], lines=4)
cb('mitbehandlung_nein', 'Mitbehandlung: nein', 21.6, 39.4)
cb('mitbehandlung_ja', 'Mitbehandlung: ja, im Fachbereich', 31.9, 39.4)
f('mitbehandlung_fachbereich', 'Mitbehandlung im Fachbereich', 'text', 'arzt', (53.3, 39.4, 42.0, 2.5))
cb('droht_verschlimmerung', 'Es droht eine Verschlimmerung des Leidens', 21.6, 43.4)
cb('droht_behinderung', 'Es droht Behinderung', 79.9, 43.4)
f('besondere_hinweise', 'Besondere Hinweise', 'text', 'arzt', (24.1, 47.4, 71.2, 5.5), lines=2)
f('nicht_aufsuchen', 'Patientin / Patient kann den Medizinischen Dienst nicht aufsuchen, weil', 'text', 'arzt', (67.9, 54.6, 27.4, 2.6))
f('nicht_aufsuchen_2', 'Patientin / Patient kann den Medizinischen Dienst nicht aufsuchen, weil (weitere Zeilen)', 'text', 'arzt', (6.1, 57.5, 89.2, 5.8), lines=2)
f('begutachtung_nach', 'Eine Begutachtung ist voraussichtlich nach … Tagen / Wochen möglich (Nichtzutreffendes streichen)', 'number', 'arzt', (43.9, 64.6, 6.8, 2.4))
f('arbeitsfaehig_ab', 'Arbeitsfähig ab', 'date', 'arzt', (40.5, 68.6, 20.5, 2.4), format='TTMMJJ')
f('voraussichtlich_arbeitsfaehig_ab', 'Voraussichtlich arbeitsfähig ab', 'date', 'arzt', (40.5, 72.6, 20.5, 2.4), format='TTMMJJ')
for id_, label, x, y in [('beigefuegt_roentgen', 'Röntgenbefund', 6.1, 78.7), ('beigefuegt_ultraschall', 'Ultraschallbefund', 23.3, 78.7),
                         ('beigefuegt_ekg', 'EKG-Befund', 40.5, 78.7), ('beigefuegt_labor', 'Laborbefund', 6.1, 82.7),
                         ('beigefuegt_bericht', 'Arzt- oder Krankenhausbericht', 23.3, 82.7)]:
    cb(id_, f'Folgendes ist mit der Bitte um Rückgabe beigefügt: {label}', x, y, [rule('m11.befunde')] if id_ == 'beigefuegt_roentgen' else [], group='beigefuegt')
f('beigefuegt_sonstiges', 'Folgendes ist mit der Bitte um Rückgabe beigefügt: Sonstiges', 'text', 'arzt', (15.4, 85.7, 45.6, 2.5))
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'praxis', (40.5, 90.8, 20.5, 2.4), format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (63.0, 76.1, 32.3, 17.1),
  [{'id': 'm11.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

groups = [{'id': 'beigefuegt', 'label': 'Folgendes ist mit der Bitte um Rückgabe beigefügt', 'select': 'beliebig', 'rule': rule('m11.befunde')}]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-11', 'muster': '11', 'title': 'Bericht für den Medizinischen Dienst',
    'form_version': '1.2015', 'released': '2014-10-31', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 hoch', 'width': 419.5, 'height': 595.3, 'tint': 'ohne'},
    'copies': [{'id': '11', 'label': 'Bericht', 'recipient': 'Medizinischer Dienst (in der Regel über den zum MD bestellten Versicherten)'}],
    'notes': [rule('m11.zweck'), rule('m11.beurteilung'), rule('m11.uebergabe'), rule('m11.meinungsverschiedenheit'),
              ms('m11.nicht_ausfuellen', 'Der Vordruck ist nicht auszufüllen, wenn die Arbeitsunfähigkeit spätestens am Tag der Begutachtung durch den Medizinischen Dienst beendet ist (Hinweis auf dem Vordruck).', 'PDF-Seite 22'),
              ms('m11.ebm_01621', 'Für den Bericht des Arztes ist die Nr. 01621 EBM berechnungsfähig (Hinweis auf dem Vordruck).', 'PDF-Seite 22')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-11.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder', len(groups), 'Gruppen')
