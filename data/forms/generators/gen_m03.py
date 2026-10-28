"""Erzeugt data/forms/muster-03.json (Zeugnis über den mutmaßlichen Tag der Entbindung).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 16), Lage der Felder aus der Mustersammlung (Seiten 5–7, Muster 3a/3b).
python data/forms/generators/gen_m03.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '3' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 3 (10.2014)'}}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


BACK = dict(page=1, only_copies=['3a'])
VERS = ms('m03.rueckseite', 'Die Rückseite füllt die Versicherte vor der Weitergabe des Vordrucks an die Krankenkasse aus (Aufdruck); sie gibt es nur bei Muster 3a.', 'PDF-Seite 6')

# Vorderseite 3a/3b (Mustersammlung S. 5 und 7)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, Vorname, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (6.2, 4.9, 53.9, 44.5),
  [{'id': 'm03.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}])
f('entbindung_am', 'dass die oben bezeichnete Versicherte voraussichtlich entbinden wird am', 'date', 'arzt', (39.5, 56.5, 20.6, 5.0), [rule('m03.daten')], format='TTMMJJ')
f('untersuchung_am', 'Die Bescheinigung erteile ich auf Grund der von mir vorgenommenen Untersuchung am', 'date', 'arzt', (39.5, 64.6, 20.6, 5.0),
  [rule('m03.untersuchung'), rule('m03.daten')], format='TTMMJJ')
f('feststellungen', 'Ggf. besondere Feststellungen', 'text', 'arzt', (6.2, 73.8, 54.2, 19.9), [], lines=3)
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (63.0, 59.7, 32.2, 34.0),
  [{'id': 'm03.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

# Rückseite 3a (Mustersammlung S. 6), von der Versicherten auszufüllen
f('v_name', 'Name, Vorname', 'text', 'versicherter', (4.4, 12.2, 69.5, 5.0), [VERS], **BACK)
f('v_geburtsdatum', 'Geburtsdatum', 'date', 'versicherter', (74.7, 12.1, 20.6, 5.0), [], format='TTMMJJ', **BACK)
f('v_plz', 'PLZ', 'text', 'versicherter', (4.5, 20.2, 17.2, 5.0), [], **BACK)
f('v_wohnort', 'Wohnort', 'text', 'versicherter', (22.4, 20.2, 26.6, 5.0), [], **BACK)
f('v_strasse', 'Straße, Haus-Nr.', 'text', 'versicherter', (49.8, 20.2, 45.5, 5.0), [], **BACK)
f('v_kontoinhaber', 'Kontoinhaber', 'text', 'versicherter', (4.4, 28.3, 91.0, 5.0), [], **BACK)
f('v_iban', 'IBAN', 'text', 'versicherter', (4.4, 36.4, 75.3, 5.0), [], **BACK)
f('v_geldinstitut', 'Geldinstitut', 'text', 'versicherter', (4.4, 44.4, 52.3, 5.0), [], **BACK)
f('v_bic', 'BIC', 'text', 'versicherter', (57.7, 44.4, 37.6, 5.0), [], **BACK)
for id_, label, y in [('beschaeftigt', 'beschäftigt, bei', 56.4), ('selbstaendig', 'selbständig', 68.5), ('arbeitslos', 'arbeitslos', 76.6),
                      ('kuenstlerin', 'Künstlerin / Publizistin', 84.7)]:
    f(id_, f'Ich bin derzeit: {label}', 'checkbox', 'versicherter', (4.5, y, 3.3, 5.0), [], group='beschaeftigung', **BACK)
f('v_arbeitgeber', 'beschäftigt, bei', 'text', 'versicherter', (21.5, 56.5, 52.3, 4.9), [], **BACK)
f('v_arbeitgeber_anschrift', 'Anschrift des Arbeitgebers', 'text', 'versicherter', (21.5, 64.6, 73.8, 4.9), [], **BACK)
f('v_gekuendigt_befristet', 'gekündigt / befristet zum', 'date', 'versicherter', (74.7, 56.4, 20.6, 5.0), [], format='TTMMJJ', **BACK)
f('v_datum', 'Datum', 'date', 'versicherter', (40.5, 87.8, 20.5, 5.9), [], format='TTMMJJ', **BACK)
f('v_unterschrift', 'Unterschrift der Versicherten', 'text', 'versicherter', (63.0, 83.9, 32.2, 9.8), [], **BACK)

doc = {
    'schema_version': '1.0.0', 'id': 'muster-03', 'muster': '3', 'title': 'Zeugnis über den mutmaßlichen Tag der Entbindung',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A6 quer, Vorder- und Rückseite (Rückseite nur 3a)', 'width': 419.5, 'height': 297.6, 'tint': 'gelb'},
    'pages': ['Vorderseite', 'Rückseite'],
    'copies': [
        {'id': '3a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse (Beantragung von Mutterschaftsgeld; Rückseite von der Versicherten auszufüllen)'},
        {'id': '3b', 'label': 'Ausfertigung für die Versicherte (z. B. zur Vorlage beim Arbeitgeber)', 'recipient': 'Versicherte (z. B. Arbeitgeber)'},
    ],
    'notes': [rule('m03.untersuchung'), rule('m03.daten'), rule('m03.dokumentation'), rule('m03.abgegolten'),
              ms('m03.ausfertigung_3b', 'Muster 3b hat keine Rückseite; die Zeile „voraussichtlich entbinden wird am“ trägt dort keine Beschriftung (Datumsfeld T T M M J J ist vorhanden).', 'PDF-Seite 7')],
    'groups': [
        {'id': 'beschaeftigung', 'label': 'Ich bin derzeit (Angaben zum Beschäftigungsverhältnis, Versicherte)', 'select': 'beliebig',
         'rule': ms('m03.beschaeftigung', 'Die Versicherte kreuzt ihr Beschäftigungsverhältnis an (beschäftigt, selbständig, arbeitslos, Künstlerin/Publizistin).', 'PDF-Seite 6')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-03.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
