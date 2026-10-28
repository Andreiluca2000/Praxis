"""Erzeugt data/forms/muster-22.json (Konsiliarbericht vor Aufnahme einer Psychotherapie, Ausfertigungen 22a–22d).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 68–69), Lage der Felder aus der Mustersammlung (Seiten 41–44, modelliert nach 22a auf Seite 41;
Abweichungen von 22b/22d über only_copies).
python data/forms/generators/gen_m22.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '22' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 22 (10.2014)'}}


CHIFFRE = ms('m22.chiffre', 'Auf Muster 22b steht statt der Personalien des Patienten die Chiffre: Anfangsbuchstabe des Familiennamens und Geburtsdatum.', 'PDF-Seite 42')
fields = []
CB = (1.8, 1.3)
EINSICHT = ['22a', '22b', '22c']  # auf 22d (Krankenkasse) ist der Bereich der Berichtsangaben geschwärzt


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y) + CB, rules, **kw)


f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria',
  (4.3, 1.7, 38.0, 15.8),
  [{'id': 'm22.personalien', 'text': 'Der Konsiliararzt liest die elektronische Gesundheitskarte des Patienten ein.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Muster 22, Nr. 4, S. 68'}}],
  only_copies=['22a', '22c', '22d'])
f('chiffre_buchstabe', 'Chiffre des Patienten: Anfangsbuchstabe des Familiennamens', 'letter', 'praxis', (68.4, 15.4, 2.3, 2.1), [CHIFFRE], only_copies=['22b'])
f('chiffre_geburtsdatum', 'Chiffre des Patienten: Geburtsdatum', 'date', 'praxis', (72.0, 15.3, 14.5, 2.1), [CHIFFRE], format='TTMMJJ', only_copies=['22b'])
f('arztnummer', 'Arztnummer (des überweisenden Therapeuten)', 'text', 'praxis', (74.4, 7.5, 21.8, 2.1), [rule('m22.egk_ueberweisender')])
f('betriebsstaettennummer', 'Betriebsstättennummer (des überweisenden Therapeuten)', 'text', 'praxis', (74.4, 11.0, 21.8, 2.1), [rule('m22.egk_ueberweisender')])
f('name_therapeut', 'Auf Veranlassung von: Name des Therapeuten', 'text', 'praxis', (46.0, 10.9, 27.2, 2.3), [rule('m22.egk_ueberweisender')])
f('bericht', 'Es sollen ggf. Angaben zu folgenden Inhalten gemacht werden (Aktuelle Beschwerden, Befund, Anamnese, Diagnosen, Vor- und Parallelbehandlungen, Befunde zur Begleitbehandlung)',
  'text', 'arzt', (9.5, 29.0, 86.7, 31.0), [rule('m22.inhalt'), rule('m22.pflichtangaben'), rule('m22.einsicht')], only_copies=EINSICHT)
for id_, label, x in [('psych_erforderlich', 'erforderlich', 38.6), ('psych_nicht_erforderlich', 'nicht erforderlich', 53.1),
                      ('psych_erfolgt', 'erfolgt', 73.7), ('psych_veranlasst', 'veranlasst', 84.5)]:
    cb(id_, f'Psychiatrische bzw. kinder- und jugendpsychiatrische Abklärung ist {label}', x, 62.1, group='psych_abklaerung', only_copies=EINSICHT)
f('massnahmen', 'Sind ärztliche/ärztlich veranlasste Maßnahmen bzw. Untersuchungen notwendig bzw. veranlasst und ggf. welche?', 'text', 'arzt',
  (12.7, 66.6, 83.5, 5.2), [rule('m22.einsicht')], lines=2, only_copies=EINSICHT)
cb('kontraindikation', 'Aufgrund somatischer/psychiatrischer Befunde bestehen derzeit Kontraindikationen für eine psychotherapeutische Behandlung (Begründung s. o.)', 9.2, 76.4,
   [rule('m22.kontraindikation')])
cb('mitbehandlung', 'Ärztliche Mitbehandlung ist erforderlich', 9.2, 80.6, [rule('m22.kontraindikation')])
f('art_massnahme', 'Art der Maßnahme', 'text', 'arzt', (12.7, 81.5, 55.7, 4.5), [rule('m22.kontraindikation')], lines=2)
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'praxis', (54.0, 92.3, 14.5, 2.1),
  [ms('m22.datum', 'Ausstellungsdatum der Bescheinigung im Datumsfeld (TTMMJJ).', 'PDF-Seite 41')], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (73.4, 82.4, 22.8, 12.1),
  [{'id': 'm22.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

groups = [
    {'id': 'psych_abklaerung', 'label': 'Psychiatrische bzw. kinder- und jugendpsychiatrische Abklärung ist', 'select': 'beliebig',
     'rule': ms('m22.psych_abklaerung', 'Für die psychiatrische bzw. kinder- und jugendpsychiatrische Abklärung sind die Felder erforderlich, nicht erforderlich, erfolgt und veranlasst vorgesehen.', 'PDF-Seite 41')},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-22', 'muster': '22', 'title': 'Konsiliarbericht vor Aufnahme einer Psychotherapie durch Psychologische Psychotherapeuten und Kinder- und Jugendlichenpsychotherapeuten',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'copies': [
        {'id': '22a', 'label': 'Ausfertigung für den Therapeuten', 'recipient': 'Psychotherapeut (Original; der Konsiliararzt übersendet es ihm)'},
        {'id': '22b', 'label': 'Ausfertigung für den Gutachter', 'recipient': 'Gutachter/Obergutachter (ggf. im verschlossenen Umschlag dem Bericht beigefügt)'},
        {'id': '22c', 'label': 'Ausfertigung für den Vertragsarzt', 'recipient': 'verbleibt beim Konsiliararzt'},
        {'id': '22d', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse des Patienten (der Konsiliararzt übersendet sie direkt; ohne Einsicht in die Berichtsangaben)'},
    ],
    'notes': [rule('m22.ueberweisung'), rule('m22.frist'), rule('m22.versand'),
              ms('m22.ebm_01612', 'Aufdruck: Für diese Bescheinigung ist die Nr. 01612 EBM berechnungsfähig.', 'PDF-Seite 41'),
              ms('m22.kasse_22d', 'Auf Muster 22d (Krankenkasse) ist der Bereich der Berichtsangaben geschwärzt (Beschwerden/Befund, psychiatrische Abklärung, Maßnahmen); sichtbar bleiben Kontraindikation, Mitbehandlung, Datum und Stempel.', 'PDF-Seite 44')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-22.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
