"""Erzeugt data/forms/muster-09.json (Bescheinigung einer Fehlgeburt, Frühgeburt oder Behinderung des Kindes).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 33–35), Lage der Felder aus der Mustersammlung (Seiten 17–19, Muster 9a/9b).
python data/forms/generators/gen_m09.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '9' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 9 (1.2026)'}}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


ONLY_9A = dict(only_copies=['9a'])
BACK = dict(page=1, only_copies=['9a'])
CB_W, CB_H = 3.3, 2.4

# Vorderseite 9a (Mustersammlung S. 17); 9b (S. 19) enthält nur Personalienfeld, 1. Fehlgeburt und Stempel
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, Vorname, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (6.2, 2.5, 53.9, 22.2),
  [{'id': 'm09.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}])
f('fehlgeburt_am', '1. Fehlgeburt am', 'date', 'arzt', (25.0, 26.2, 20.6, 2.5), [rule('m09.fehlgeburt_datum')], format='TTMMJJ', marker='❶')
for id_, label, y, rid in [('ssw_13', '13. Schwangerschaftswoche (Schutzfrist 2 Wochen)', 32.3, True),
                           ('ssw_17', '17. Schwangerschaftswoche (Schutzfrist 6 Wochen)', 36.4, False),
                           ('ssw_20', '20. Schwangerschaftswoche (Schutzfrist 8 Wochen)', 40.4, False)]:
    f(id_, f'Die oben bezeichnete Versicherte befand sich mindestens in der {label}', 'checkbox', 'arzt', (6.2, y, CB_W, CB_H),
      [rule('m09.ssw')] if rid else [], group='schwangerschaftswoche', marker='❷')
f('fruehgeburt_am', '2. Frühgeburt am', 'date', 'arzt', (25.0, 52.4, 20.6, 2.5), [rule('m09.fruehgeburt')], format='TTMMJJ', marker='❸', **ONLY_9A)
f('gewicht_unter', 'a) Geburtsgewicht unter 2.500 Gramm', 'checkbox', 'arzt', (6.2, 56.5, CB_W, CB_H), [rule('m09.gewicht_unter')], group='fruehgeburt_art', marker='❹', **ONLY_9A)
f('pflegebedarf', 'b) Geburtsgewicht ab 2.500 Gramm, es besteht jedoch ein wesentlich erweiterter Pflegebedarf wegen nicht voll ausgebildeter Reifezeichen oder verfrühter Beendigung der Schwangerschaft',
  'checkbox', 'arzt', (6.2, 60.5, CB_W, CB_H), [rule('m09.pflegebedarf')], group='fruehgeburt_art', marker='❺', **ONLY_9A)
f('behinderung', 'Bei dem Kind liegt eine Behinderung vor', 'checkbox', 'arzt', (6.2, 74.7, CB_W, CB_H),
  [rule('m09.behinderung'), rule('m09.frist_8_wochen')], marker='❻', **ONLY_9A)
f('stempel', 'Vertragsarztstempel / ärztliche Unterschrift', 'stempel', 'arzt', (63.0, 27.8, 32.2, 17.0),
  [{'id': 'm09.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

# Rückseite 9a (Mustersammlung S. 18): Antrag und Erklärung der Versicherten
ANTRAG = ms('m09.antrag_versicherte', 'Die Rückseite enthält den Antrag der Versicherten auf Auszahlung von Mutterschaftsgeld bzw. Verlängerung der Schutzfrist wegen Behinderung des Kindes sowie ihre Erklärung (Aufdruck).', 'PDF-Seite 18')
f('v_name', 'Name', 'text', 'versicherter', (6.1, 14.1, 43.8, 2.5), [ANTRAG], **BACK)
f('v_vorname', 'Vorname', 'text', 'versicherter', (50.7, 14.1, 44.6, 2.5), [], **BACK)
f('v_geburtsdatum', 'Geburtsdatum', 'date', 'versicherter', (6.3, 18.2, 20.6, 2.5), [], format='TTMMJJ', **BACK)
f('v_versichertennummer', 'Versichertennummer', 'text', 'versicherter', (50.8, 18.2, 34.1, 2.4), [], **BACK)
f('v_iban', 'IBAN', 'text', 'versicherter', (6.2, 22.2, 75.3, 2.4), [], **BACK)
f('v_bic', 'BIC', 'text', 'versicherter', (6.2, 26.2, 37.6, 2.4), [], **BACK)
f('v_kontoinhaber', 'Kontoinhaber (falls abweichend von antragstellender Person)', 'text', 'versicherter', (50.7, 26.2, 44.7, 2.5), [], **BACK)
f('beschaeftigt', 'Ich bin derzeit: beschäftigt', 'checkbox', 'versicherter', (6.2, 34.3, CB_W, CB_H), [], group='beschaeftigung', **BACK)
f('v_arbeitgeber', 'Arbeitgeber', 'text', 'versicherter', (11.2, 38.3, 61.9, 2.4), [], **BACK)
f('v_gekuendigt_befristet', 'gekündigt/befristet zum', 'date', 'versicherter', (74.8, 38.3, 20.4, 2.4), [], format='TTMMJJ', **BACK)
f('v_arbeitgeber_anschrift', 'Anschrift des Arbeitgebers', 'text', 'versicherter', (11.2, 42.4, 84.1, 2.4), [], **BACK)
f('arbeitslos', 'Ich bin derzeit: arbeitslos', 'checkbox', 'versicherter', (6.2, 46.5, CB_W, CB_H), [], group='beschaeftigung', **BACK)
f('selbstaendig', 'Ich bin derzeit: selbständig', 'checkbox', 'versicherter', (6.2, 50.5, CB_W, CB_H), [], group='beschaeftigung', **BACK)
f('kuenstlerin', 'Ich bin derzeit: Künstlerin/Publizistin', 'checkbox', 'versicherter', (6.2, 54.5, CB_W, CB_H), [], group='beschaeftigung', **BACK)
f('v_datum', 'Datum', 'date', 'versicherter', (40.5, 90.7, 20.4, 2.4), [], format='TTMMJJ', **BACK)
f('v_unterschrift', 'Unterschrift der Versicherten', 'text', 'versicherter', (63.0, 87.3, 32.2, 5.9), [], **BACK)

doc = {
    'schema_version': '1.0.0', 'id': 'muster-09', 'muster': '9', 'title': 'Bescheinigung einer Fehlgeburt, Frühgeburt oder Behinderung des Kindes',
    'form_version': '1.2026', 'released': '2025-08-15', 'status': 'entwurf',
    'paper': {'format': 'DIN A5 hoch, Vorder- und Rückseite (9a); 9b DIN A6 quer', 'width': 419.5, 'height': 595.3, 'tint': 'rot'},
    'pages': ['Vorderseite', 'Rückseite'],
    'copies': [
        {'id': '9a', 'label': 'Ausfertigung zur Vorlage bei der Krankenkasse', 'recipient': 'Krankenkasse (Rückseite mit Antrag und Erklärung der Versicherten)'},
        {'id': '9b', 'label': 'Ausfertigung zur Vorlage beim Arbeitgeber', 'recipient': 'Arbeitgeber (nur Bescheinigung einer Fehlgeburt; DIN A6 quer, ohne Rückseite)'},
    ],
    'notes': [rule('m09.zweck'), rule('m09.mutterschaftsgeld_dauer'), rule('m09.mehrlinge'),
              ms('m09.rueckseite_hinweis', 'Auf der Vorderseite 9a steht bei 1. und 3. „(Bitte auch Rückseite ausfüllen!)“; die Rückseite füllt die Versicherte aus.', 'PDF-Seite 17'),
              ms('m09.ausfertigung_9b', 'Muster 9b ist die Ausfertigung für den Arbeitgeber und enthält nur Personalienfeld, 1. Fehlgeburt (Datum, Schwangerschaftswoche) und Stempel.', 'PDF-Seite 19')],
    'groups': [
        {'id': 'schwangerschaftswoche', 'label': 'Die Versicherte befand sich mindestens in der … Schwangerschaftswoche', 'select': 'beliebig', 'rule': rule('m09.ssw')},
        {'id': 'fruehgeburt_art', 'label': 'Frühgeburt: Geburtsgewicht unter 2.500 Gramm oder ab 2.500 Gramm mit wesentlich erweitertem Pflegebedarf', 'select': 'beliebig', 'rule': rule('m09.fruehgeburt')},
        {'id': 'beschaeftigung', 'label': 'Ich bin derzeit (Angaben zum Beschäftigungsverhältnis, Versicherte)', 'select': 'beliebig',
         'rule': ms('m09.beschaeftigung', 'Die Versicherte kreuzt ihr Beschäftigungsverhältnis an (beschäftigt, arbeitslos, selbständig, Künstlerin/Publizistin).', 'PDF-Seite 18')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-09.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
