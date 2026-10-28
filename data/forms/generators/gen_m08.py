"""Erzeugt data/forms/muster-08.json (Sehhilfenverordnung).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 31–32), Lage der Felder aus der Mustersammlung (Seiten 13–14).
Nicht modelliert (nicht von der Praxis auszufüllen): Kästchenreihen IK/Rechnungsnummer/Belegnummer, Kostenrechnung des Leistungserbringers,
Entscheidung der Krankenkasse, Empfangsbestätigung, Bescheinigung des Leistungserbringers; die Achsen-Skalen (Halbkreise) sind nur Zeichnung.
python data/forms/generators/gen_m08.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '8' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 8 (10.2014)'}}


fields = []
CB = (4.1, 2.9)


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), page=0, filled_by='arzt', **kw):
    f(id_, label, 'checkbox', filled_by, (x, y) + CB, rules, page, **kw)


# Vorderseite (Mustersammlung S. 13)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria',
  (6.2, 2.5, 53.9, 22.2),
  [{'id': 'm08.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}])
cb('aenderung_ja', 'Befund: Änderung um mindestens 0,5 Dioptrien – ja', 45.6, 25.9, [rule('m08.folgeversorgung'), rule('m08.ankreuzen')], group='aenderung')
cb('aenderung_nein', 'Befund: Änderung um mindestens 0,5 Dioptrien – nein', 56.3, 25.9, group='aenderung')
cb('verbesserung_20', 'Wenn nein, wird eine Verbesserung der Sehschärfe um mindestens 20% erzielt? ja', 45.6, 29.9, [rule('m08.folgeversorgung')])
cb('erstversorgung', 'Erstversorgung', 77.3, 25.9, [rule('m08.ankreuzen')], group='versorgung')
cb('folgeversorgung', 'Folgeversorgung', 93.6, 25.9, group='versorgung')
cb('unfall', 'Unfall, Unfallfolgen', 77.3, 29.9)
cb('ser', 'Versorgungsleiden (BVG)', 93.6, 29.9, [rule('m08.ser')])
cb('who1', 'Sehbehinderung mindestens WHO 1', 77.3, 33.9, [rule('m08.indikation_ab_18'), rule('m08.ankreuzen')])
cb('reparatur', 'Reparatur', 77.3, 38.0, [rule('m08.reparatur_ersatz')])
cb('ersatz', 'Ersatz', 93.6, 38.0, [rule('m08.reparatur_ersatz')])
f('menge_art', 'Menge und Art der Verordnung', 'text', 'arzt', (6.1, 42.3, 91.4, 3.0), [rule('m08.menge_art')], lines=1)
f('diagnose_begruendung', 'Diagnose/Begründung', 'text', 'arzt', (6.1, 47.4, 91.4, 6.0), [rule('m08.diagnose_begruendung')], lines=2)

# Refraktionswerte: Zeilen F (Fern) / N (Nah) je rechts (R) und links (L); Spalten laut Vordruck
ROWS = [('f_r', 'F', 'R', 59.5), ('f_l', 'F', 'L', 62.5), ('n_r', 'N', 'R', 65.5), ('n_l', 'N', 'L', 68.5)]
COLS = [('sphaere', 'Sphäre', 13.5, 9.8, 'text'), ('zylinder', 'Zylinder', 23.3, 9.8, 'text'), ('achse', 'Achse', 33.1, 5.4, 'number'),
        ('prisma', 'Prisma', 38.5, 5.4, 'text'), ('basis', 'Basis', 43.9, 9.8, 'text'), ('scheitelabstand', 'Scheitelabstand', 53.7, 6.8, 'text')]
for rid, ent, seite, y in ROWS:
    for cid, clabel, x, w, kind in COLS:
        f(f'{cid}_{rid}', f'{ent} ({"Fern" if ent == "F" else "Nah"}) {seite}: {clabel}', kind, 'arzt', (x, y, w, 3.0))
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (6.2, 84.2, 50.5, 13.0),
  [{'id': 'm08.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

# Rückseite (Mustersammlung S. 14): Erklärung des Versicherten
ERKL = ms('m08.erklaerung', 'Bei Erstversorgung oder Verlust der Sehhilfe erklärt der Versicherte, dass er bisher noch keine Sehhilfe gehabt hat bzw. dass seine bisherige Sehhilfe verlorengegangen ist.', 'PDF-Seite 14')
cb('erklaerung_keine_sehhilfe', 'Ich erkläre, dass ich bisher noch keine Sehhilfe gehabt habe', 14.6, 7.3, [ERKL], page=1, filled_by='versicherter', group='erklaerung')
cb('erklaerung_verloren', 'Ich erkläre, dass meine bisherige Sehhilfe verlorengegangen ist', 14.6, 10.3, page=1, filled_by='versicherter', group='erklaerung')
f('erklaerung_datum', 'Datum (Erklärung des Versicherten)', 'date', 'versicherter', (2.7, 13.3, 41.2, 5.7), [ERKL], page=1)
f('erklaerung_unterschrift', 'Unterschrift des Versicherten', 'text', 'versicherter', (43.9, 13.3, 53.4, 5.7), [ERKL], page=1)

groups = [
    {'id': 'aenderung', 'label': 'Änderung um mindestens 0,5 Dioptrien', 'select': 'beliebig', 'rule': rule('m08.ankreuzen')},
    {'id': 'versorgung', 'label': 'Erst- oder Folgeversorgung', 'select': 'genau_eins', 'rule': rule('m08.ankreuzen')},
    {'id': 'erklaerung', 'label': 'Erklärung des Versicherten (bei Erstversorgung oder Verlust der Sehhilfe)', 'select': 'beliebig', 'rule': ERKL},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-08', 'muster': '8', 'title': 'Sehhilfenverordnung',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 hoch, Vorder- und Rückseite', 'width': 419.5, 'height': 595.3, 'tint': 'ohne'},
    'pages': ['Vorderseite', 'Rückseite'],
    'copies': [{'id': '8', 'label': 'Sehhilfenverordnung', 'recipient': 'Leistungserbringer (Abgabe der Sehhilfe); Entscheidung der Krankenkasse auf der Rückseite'}],
    'notes': [rule('m08.augenarzt'), rule('m08.therapeutisch'),
              ms('m08.nicht_praxis', 'Nicht von der Praxis auszufüllen: IK des Leistungserbringers, Kostenrechnung des Leistungserbringers, Entscheidung der Krankenkasse, Empfangsbestätigung und Bescheinigung des Leistungserbringers (Rückseite).', 'PDF-Seiten 13–14'),
              ms('m08.hinweis', 'Aufdruck für den Versicherten: Die Verordnung ist kein Gutschein für einen bestimmten Betrag; die Lieferung anderer Ware anstelle der verordneten Sehhilfen ist nicht gestattet.', 'PDF-Seite 14')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-08.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
