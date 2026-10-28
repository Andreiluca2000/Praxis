"""Erzeugt data/forms/muster-70a.json (Folge-Behandlungsplan für Maßnahmen zur künstlichen Befruchtung gemäß § 27a SGB V).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 144; die Angaben des Musters 70 gelten auch hier, S. 142–143), Lage der Felder aus der Mustersammlung (Seite 102, Ausfertigung 70Aa; Seite 103 = 70Ab deckungsgleich).
Abschnitt IV (Genehmigung durch die Krankenkasse(n)) füllt die Krankenkasse aus und wird nicht als Feld abgebildet.
python data/forms/generators/gen_m70a.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] in ('70', '70A') for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    """m70a.* direkt aus dem Katalog; m70.* (Angaben „über Muster 70 hinaus“, m70a.zusatz) unter m70a.-Kennung mit unveränderter Fundstelle."""
    r = R.get(rid, {})
    new_id = rid if rid.startswith('m70a.') else 'm70a.m70_' + rid.split('.', 1)[1]
    return {'id': new_id, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 70Aa (10.2014)'}}


fields = []
MASSNAHME = ms('m70a.massnahme', 'Geplante Behandlungsmaßnahme nach Nr. 10.1 bis 10.5 der Richtlinien über künstliche Befruchtung (Auswahl auf dem Vordruck).', 'PDF-Seite 102')
SIGN = {'id': 'm70a.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}
PERS = {'id': 'm70a.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


PERS_LABEL = 'Personalienfeld ({}) (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)'
f('personalien_frau', PERS_LABEL.format('♀'), 'personalien', 'duria', (4.3, 1.7, 38.1, 15.8), [rule('m70.formularkopf'), PERS])
f('personalien_mann', PERS_LABEL.format('♂, an dieser Stelle nicht bedruckbar: von Hand ausfüllen oder Personalfeldaufkleber verwenden'), 'personalien', 'praxis',
  (4.4, 20.4, 38.0, 15.7), [rule('m70.formularkopf'),
                            ms('m70a.personalfeld_mann', 'Das zweite Personalfeld ist an dieser Stelle nicht bedruckbar: von Hand ausfüllen oder Personalfeldaufkleber verwenden (auch auf dem Durchschlag).', 'PDF-Seite 102')])
f('vorplan_datum', 'zum Behandlungsplan vom', 'date', 'arzt', (66.7, 3.9, 10.9, 2.1), [rule('m70a.formularkopf')], format='TTMMJJ')
f('indikation', 'I Indikation(en) gemäß Nummern 11.1-11.5 der Richtlinien über künstliche Befruchtung', 'text', 'arzt', (46.0, 13.2, 52.0, 4.3), [rule('m70.indikationen')], lines=2, marker='1')
for n, (key, label) in enumerate([('insem_spontan', 'Insemination im Spontanzyklus (gemäß Nr. 10.1)'),
                                  ('insem_stimulation', 'Insemination nach hormoneller Stimulation (gemäß Nr. 10.2)'),
                                  ('ivf', 'In-Vitro-Fertilisation mit Embryotransfer (gemäß Nr. 10.3)'),
                                  ('gift', 'Intratubarer-Gameten-Transfer (gemäß Nr. 10.4)'),
                                  ('icsi', 'Intracytoplasmatische Spermieninjektion (gemäß Nr. 10.5)')]):
    f(key, f'II Geplante Behandlungsmaßnahme: {label}', 'checkbox', 'arzt', (46.0, round(22.5 + 2.12 * n, 1), 3.0, 2.1), [MASSNAHME] if n == 0 else [],
      group='massnahme')
f('bisherige_behandlungen', 'Anzahl und Art bereits ohne Eintritt einer klinisch nachgewiesenen Schwangerschaft erfolgter Behandlungen (gemäß Nr. 10.1-10.5)', 'text', 'arzt',
  (71.4, 34.6, 26.6, 2.1), [rule('m70a.position_ii'), rule('m70.bisherige_behandlungen')], marker='2')

# III Kostenschätzung: a = einmalig im Reproduktionsfall, b = pro Zyklusfall (jeweils ♀ und ♂)
SEX = (('f', '♀'), ('m', '♂'))
ROWS_A = [('ebm', 'Ärztliche Behandlung (EBM-Positionen)', 9.7, 32.6, 46.7), ('summe', 'Summe Ärztliche Behandlung (Euro)', 23.0, 19.3, 51.0),
          ('sach', 'Sachkosten und Sprechstundenbedarf (Euro)', 23.0, 19.3, 55.2), ('gesamt', 'Gesamtsumme für einmalig im Reproduktionsfall anfallende Leistungen (Euro)', 23.0, 19.3, 59.5)]
ROWS_B = [('ebm', 'Ärztliche Behandlung (EBM-Positionen)', 46.0, 31.3, 46.7), ('summe', 'Summe Ärztliche Behandlung (Euro)', 58.1, 19.2, 51.0),
          ('med', 'Medikamentenkosten (Euro)', 58.1, 19.2, 55.2), ('sach', 'Sachkosten und Sprechstundenbedarf (Euro)', 58.1, 19.2, 59.5),
          ('gesamt', 'Gesamtsumme pro Zyklusfall (Euro)', 58.1, 19.2, 63.8)]
for part, title, rows in (('a', 'Kosten für einmalig im Reproduktionsfall anfallende Leistungen', ROWS_A), ('b', 'Kosten pro Zyklusfall (ohne einmalig im Reproduktionsfall anfallende Leistungen)', ROWS_B)):
    for key, label, x, w, y in rows:
        for i, (sx, sym) in enumerate(SEX):
            r = []
            if part == 'a' and key == 'ebm' and sx == 'f':
                r = [rule('m70.kosten'), rule('m70.ebm')]
            f(f'kosten_{part}_{key}_{sx}', f'III {part} {title}: {label} {sym}', 'text', 'arzt', (x, round(y + 2.12 * i, 1), w, 2.1), r, marker='4' if key == 'ebm' else '3')
f('ort', 'Ort', 'text', 'arzt', (9.7, 66.0, 20.6, 2.1))
f('datum', 'Datum', 'date', 'praxis', (31.5, 65.9, 10.8, 2.1), [ms('m70a.datum', 'Ausstellungsdatum des Folge-Behandlungsplans (Feld „Datum“ neben „Ort“).', 'PDF-Seite 102')], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (78.7, 56.0, 19.2, 12.0), [SIGN])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-70a', 'muster': '70A',
    'title': 'Folge-Behandlungsplan für Maßnahmen zur künstlichen Befruchtung gemäß § 27a SGB V sowie der „Richtlinien über künstliche Befruchtung“ des Gemeinsamen Bundesausschusses für die hier genannten Ehegatten',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'copies': [
        {'id': '70Aa', 'label': 'Ausfertigung (nach Genehmigung zum Verbleib beim Vertragsarzt)', 'recipient': 'Ehepaar (legt es nacheinander beiden Krankenkassen zur Genehmigung vor), danach durchführender Arzt'},
        {'id': '70Ab', 'label': 'Ausfertigung für die Kassenärztliche Vereinigung', 'recipient': 'Kassenärztliche Vereinigung (mit der ersten Abrechnung)'},
    ],
    'notes': [rule('m70a.zusatz'), rule('m70.verfahrensweg'),
              ms('m70a.vorbehalt', 'Alle Angaben stehen unter dem Vorbehalt einer nachträglichen Änderung der diagnostischen und therapeutischen Einzelfallerfordernisse; Auflistung der Positionen ggf. auf separatem Beiblatt (Hinweis auf dem Vordruck).', 'PDF-Seite 102'),
              ms('m70a.genehmigung_kasse', 'Abschnitt IV „Genehmigung durch die Krankenkasse(n)“ (genehmigte Zyklen, nicht genehmigt, Ort, Datum, Stempel und Unterschrift der Krankenkasse, getrennt für ♀ und ♂) füllt die Krankenkasse aus, nicht die Praxis.', 'PDF-Seite 102'),
              ms('m70a.neuer_plan', 'Spätestens nach Ablauf eines Jahres seit der Genehmigung sowie bei Änderung der Behandlungsmethode ist ein neuer Folge-Behandlungsplan vorzulegen (Hinweis auf dem Vordruck).', 'PDF-Seite 102')],
    'groups': [{'id': 'massnahme', 'label': 'Geplante Behandlungsmaßnahme (gemäß Nr. 10.1–10.5)', 'select': 'beliebig', 'rule': MASSNAHME}],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-70a.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
