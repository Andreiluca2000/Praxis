"""Erzeugt data/forms/muster-65.json (Ärztliches Attest Kind).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 139–141), Lage der Felder aus der Mustersammlung (Seite 98 = Muster 65a; Seite 99 = 65b ist gleich aufgebaut).
python data/forms/generators/gen_m65.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '65' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 65a (10.2018)'}}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


# Mustersammlung S. 98 (Muster 65a)
f('personalien', 'Personalienfeld des Kindes (Krankenkasse bzw. Kostenträger, Name, Vorname, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (4.4, 1.7, 38.0, 15.7))
f('anamnese', 'I. Kurze Angaben zur Anamnese', 'text', 'arzt', (11.5, 22.5, 84.7, 4.9), [rule('m65.anamnese')], lines=2, marker='❶')
f('gesundheitsstoerungen', 'II. Vorliegende Gesundheitsprobleme, A. Gesundheitsstörungen', 'text', 'arzt', (11.5, 33.9, 84.7, 4.9),
  [rule('m65.gesundheitsstoerungen')], lines=2, marker='❷')
for n, y in enumerate((42.4, 45.3, 48.1), 1):
    f(f'erkrankung_{n}', f'II. Vorliegende Gesundheitsprobleme, B. Erkrankungen, Zeile {n}', 'text', 'arzt', (11.5, y, 68.9, 2.1),
      [rule('m65.erkrankungen')] if n == 1 else [], marker='❸')
    f(f'icd_{n}', f'Diagnoseschlüssel ICD-10-GM, Zeile {n}', 'text', 'arzt', (82.9, y, 13.3, 2.1),
      [rule('m65.erkrankungen')] if n == 1 else [], marker='❸')
f('weitere_informationen', 'II. Vorliegende Gesundheitsprobleme, C. Weitere relevante Informationen (z. B. Behinderungen, Entwicklungsverzögerungen)', 'text', 'arzt',
  (11.5, 53.8, 84.7, 4.9), [rule('m65.weitere_informationen')], lines=2, marker='❹')
f('krankenbehandlung', 'III. Bisherige Krankenbehandlung und andere Maßnahmen', 'text', 'arzt', (11.5, 62.4, 84.7, 4.9),
  [rule('m65.krankenbehandlung')], lines=2, marker='❺')
f('interventionen', 'IV. Empfohlene Interventionen während der Maßnahme', 'text', 'arzt', (11.5, 70.9, 84.7, 4.9),
  [rule('m65.interventionen')], lines=2, marker='❻')
f('zuweisung_ja', 'V. Hinweise für die Zuweisung, A. Anforderungen an die Einrichtung: ja, folgende', 'checkbox', 'arzt', (11.6, 82.4, 3.0, 2.1),
  [rule('m65.zuweisung')], marker='❼')
f('zuweisung_text', 'V. Hinweise für die Zuweisung, A. Anforderungen an die Einrichtung: folgende', 'text', 'arzt', (23.6, 82.3, 47.2, 5.0), lines=2, marker='❼')
f('datum', 'Ausstellungsdatum', 'date', 'praxis', (56.3, 93.7, 14.5, 2.1), format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (73.5, 83.8, 22.7, 12.0),
  [{'id': 'm65.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-65', 'muster': '65', 'title': 'Ärztliches Attest Kind',
    'form_version': '10.2018', 'released': '2018-03-29', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'copies': [{'id': '65a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse'},
               {'id': '65b', 'label': 'Ausfertigung für den Arzt', 'recipient': 'Praxis (verbleibt beim Arzt)'}],
    'notes': [rule('m65.zweck'), rule('m65.abgrenzung'), rule('m65.eigener_rehabedarf'),
              ms('m65.ebm_01622', 'Für das Ausstellen der ärztlichen Verordnung ist die Nr. 01622 EBM berechnungsfähig (Hinweis auf dem Vordruck).', 'PDF-Seite 98'),
              ms('m65.ausfertigungen', 'Zwei gleich aufgebaute Ausfertigungen: 65a „Ausfertigung für die Krankenkasse“ (PDF-Seite 98) und 65b „Ausfertigung für den Arzt“ (PDF-Seite 99); abgebildet ist 65a.', 'PDF-Seiten 98–99')],
    'groups': [],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-65.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
