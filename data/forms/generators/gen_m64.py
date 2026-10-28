"""Erzeugt data/forms/muster-64.json (Verordnung medizinischer Vorsorge für Mütter oder Väter gem. § 24 SGB V, Teil A und B)
und data/forms/layout/muster-64.json (zwei Seiten). Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 133–138),
Lage der Felder aus der Mustersammlung (Seite 94 = Teil Aa, Seite 96 = Teil Ba).
python data/forms/generators/gen_m64.py ."""
import json
import subprocess
import sys
import tempfile

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '64' for r in e['rules']}
PDF = f'{root}/data/forms/sources/kbv-mustersammlung-2026-05.pdf'


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []


def f(id_, label, kind, filled_by, page, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


CB = (2.9, 2.0)
# Teil A
f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', 0, (4.4, 1.7, 38.0, 15.7),
  [rule('m64.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('risiko', 'I. A. Vorsorgerelevante Gesundheitsstörungen einschließlich Risikofaktoren', 'text', 'arzt', 0, (11.5, 23.9, 84.7, 4.9), [rule('m64.diagnosen')], lines=2, marker='❶')
for i, y in enumerate((32.4, 35.3, 38.1), start=1):
    f(f'dx{i}', f'I. B. Vorsorgerelevante Erkrankung {i}', 'text', 'arzt', 0, (11.5, y, 68.9, 2.1), [rule('m64.diagnosen')] if i == 1 else [], marker='❶')
    f(f'icd{i}', f'I. B. Diagnoseschlüssel {i} (ICD-10-GM)', 'text', 'arzt', 0, (82.9, y, 13.3, 2.1), [rule('m64.diagnosen')] if i == 1 else [], marker='❶')
f('anamnese', 'II. A. Kurze Angaben zur Anamnese', 'text', 'arzt', 0, (11.5, 45.3, 84.7, 7.8), [rule('m64.anamnese')], lines=3, marker='❷')
f('beeintraechtigungen', 'II. B. Vorübergehende Beeinträchtigungen der Aktivitäten/Teilhabe', 'text', 'arzt', 0, (11.5, 58.1, 84.7, 7.8), [rule('m64.beeintraechtigungen')], lines=3, marker='❸')
KONTEXT = [
    ('k_mehrfach', 'Mehrfachbelastung durch Beruf/Familie', 11.6, 69.6), ('k_unterstuetzung', 'mangelnde Unterstützung bei der Kindererziehung', 11.6, 72.4),
    ('k_erziehung', 'Erziehungsschwierigkeiten', 11.6, 75.3), ('k_alltag', 'Schwierigkeiten bei der Problembewältigung (Alltagsprobleme)', 11.6, 78.1),
    ('k_grundkompetenz', 'mangelnde Grundkompetenzen im Zusammenhang mit den Aufgaben einer Mutter/eines Vaters', 11.6, 81.0),
    ('k_betreuungsaufwand', 'erhöhter Betreuungsaufwand durch chronisch erkrankte, verhaltensauffällige oder behinderte Kinder, Frühgeborene, Mehrlinge', 11.6, 83.8),
    ('k_anerkennung', 'fehlende Anerkennung der Mutter-/Vaterrolle', 34.0, 69.6), ('k_partner', 'Partner-/Eheprobleme/Trennung vom Partner', 34.0, 72.4),
    ('k_pflege', 'Pflege von Familienangehörigen', 34.0, 75.3), ('k_tod', 'Tod des Partners/naher Angehöriger', 54.5, 69.6),
    ('k_teenager', 'Teenagerschwangerschaft', 54.5, 72.4), ('k_isolation', 'soziale Isolation', 54.5, 75.3), ('k_finanzen', 'finanzielle Sorgen', 54.5, 78.1),
    ('k_zeitdruck', 'ständiger Zeitdruck', 54.5, 81.0), ('k_allein', 'allein erziehend', 54.5, 83.8),
    ('k_beziehung', 'beeinträchtigte Mutter-/Vater-Kind-Beziehung', 72.1, 69.8), ('k_ueberforderung', 'Überforderungssituation am Arbeitsplatz/in der Schule', 72.1, 72.6),
    ('k_sprache', 'sprachliche Verständigungsschwierigkeiten', 72.1, 75.3), ('k_arbeitszeiten', 'besonders belastende/unregelmäßige Arbeitszeiten', 72.1, 78.1),
    ('k_arbeitsplatz', 'drohender Arbeitsplatzverlust/Arbeitslosigkeit', 72.1, 81.0), ('k_gleichberechtigung', 'nicht gleichberechtigte Stellung der Frau/des Mannes in der Familie', 72.1, 83.8),
]
for id_, label, x, y in KONTEXT:
    f(id_, label, 'checkbox', 'praxis', 0, (x, y, *CB), [], group='kontext', label_pos='rechts', marker='❹')
f('kontext_text', 'andere Kontextfaktoren; ggf. nähere Erläuterungen', 'text', 'praxis', 0, (11.5, 89.5, 84.7, 4.9), [rule('m64.kontextfaktoren')], lines=2, marker='❹')
# Teil B
f('personalien_b', 'Name, Kostenträgerkennung, Versicherten-Nr.', 'personalien', 'duria', 1, (10.4, 1.7, 67.0, 2.8),
  [rule('m64.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
f('interventionen', 'III. A. Bisherige ärztliche/psychotherapeutische Interventionen einschließlich Arzneimittel-/Heilmitteltherapie', 'text', 'arzt', 1, (11.5, 9.6, 84.7, 7.8), [rule('m64.krankenbehandlung')], lines=3, marker='❺')
f('heilmittel_nicht_ausreichend', 'Heilmittel zur Erreichung des Behandlungsziels nicht ausreichend / nicht zielführend', 'checkbox', 'arzt', 1, (11.6, 18.2, *CB), [rule('m64.krankenbehandlung')], label_pos='rechts', marker='❺')
f('andere_massnahmen', 'III. B. Bisherige andere Maßnahmen', 'text', 'arzt', 1, (11.5, 23.9, 84.7, 4.9), [rule('m64.krankenbehandlung')], lines=2, marker='❺')
f('ziele', 'IV. Vorsorgeziele', 'text', 'arzt', 1, (11.5, 33.9, 84.7, 4.9), [rule('m64.vorsorgeziele')], lines=2, marker='❻')
for id_, label, x in (('muetter', 'Mütter-Leistung', 11.6), ('vaeter', 'Väter-Leistung', 34.6), ('mutter_kind', 'Mutter-Kind-Leistung', 56.4), ('vater_kind', 'Vater-Kind-Leistung', 79.3)):
    f(id_, label, 'checkbox', 'arzt', 1, (x, 43.9, *CB), [], group='leistungsform', label_pos='rechts', marker='❼')
for i, y in enumerate((52.4, 55.3, 58.1), start=1):
    rr = [rule('m64.kinder')] if i == 1 else []
    f(f'kind{i}_name', f'Kind {i}: Name', 'text', 'praxis', 1, (11.5, y, 36.3, 2.1), rr, marker='❽')
    f(f'kind{i}_geb', f'Kind {i}: Geburtsdatum', 'date', 'praxis', 1, (49.0, y, 14.5, 2.1), rr, format='TTMMJJ', marker='❽')
    f(f'kind{i}_attest', f'Kind {i}: s. Attest Kind (Behandlungsnotwendigkeit)', 'checkbox', 'arzt', 1, (68.5, y, *CB), [], marker='❽')
    f(f'kind{i}_beziehung', f'Kind {i}: belastete Mutter-/Vater-Kind-Beziehung', 'checkbox', 'arzt', 1, (79.3, y, *CB), [], marker='❽')
    f(f'kind{i}_psychosozial', f'Kind {i}: psychosoziale Gründe/Betreuung notwendig', 'checkbox', 'arzt', 1, (90.2, y, *CB), [], marker='❽')
f('einrichtung_ja', 'VI. A. Anforderungen an die Einrichtung: ja, folgende', 'checkbox', 'arzt', 1, (11.6, 68.1, *CB), [rule('m64.einrichtung')], marker='❾')
f('einrichtung', 'VI. A. Anforderungen an die Einrichtung', 'text', 'arzt', 1, (26.1, 68.1, 70.1, 2.1), [rule('m64.einrichtung')], marker='❾')
f('wartefrist_ja', 'VI. B. Vor Ablauf der Wartefrist von 4 Jahren dringend notwendig: ja', 'checkbox', 'arzt', 1, (11.6, 73.8, *CB), [rule('m64.wartefrist')], marker='❿')
f('wartefrist', 'VI. B. Erläuterung der Dringlichkeit', 'text', 'arzt', 1, (26.1, 73.8, 70.1, 2.1), [rule('m64.wartefrist')], marker='❿')
f('sonstiges', 'VI. C. Sonstiges (z. B. Reisefähigkeit, Schwangerschaft)', 'text', 'arzt', 1, (11.5, 79.5, 59.3, 4.9), [rule('m64.sonstige_rueckruf')], lines=2, marker='⓫')
f('rueckruf', 'VI. D. Rückruf erbeten unter Telefon-Nummer', 'text', 'praxis', 1, (11.5, 88.0, 59.3, 2.1), [rule('m64.sonstige_rueckruf')], marker='⓬')
f('datum', 'Ausstellungsdatum', 'date', 'praxis', 1, (56.3, 93.7, 14.5, 2.1), [], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', 1, (73.5, 83.8, 22.7, 12.0),
  [{'id': 'm64.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-64', 'muster': '64', 'title': 'Verordnung medizinischer Vorsorge für Mütter oder Väter gemäß § 24 SGB V',
    'form_version': '10.2018', 'released': '2018-03-29', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'pages': ['Teil A', 'Teil B'],
    'copies': [{'id': '64a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse'},
               {'id': '64b', 'label': 'Ausfertigung', 'recipient': 'Versicherte/r bzw. Praxis'}],
    'notes': [rule('m64.vorhalten'), rule('m64.abgrenzung'), rule('m64.belastbarkeit'), rule('m64.vorsorgebeduerftigkeit'),
              rule('m64.ebm', text='Für das Ausstellen der ärztlichen Verordnung ist die Nr. 01624 EBM berechnungsfähig (Aufdruck).', locator='PDF-Seite 96, Muster 64 Ba (10.2018)', artifact='mustersammlung')],
    'groups': [{'id': 'kontext', 'label': 'II. C. Kontextfaktoren', 'select': 'beliebig', 'rule': rule('m64.kontextfaktoren')},
               {'id': 'leistungsform', 'label': 'V. A. Empfohlene Leistungsform', 'select': 'genau_eins', 'rule': rule('m64.leistungsform')}],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-64.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)

pages = []
for pg in (94, 96):
    with tempfile.TemporaryDirectory() as tmp:
        out = f'{tmp}/p.json'
        subprocess.run([sys.executable, f'{root}/data/forms/layout/extract_layout.py', PDF, str(pg), 'muster-64', out], check=True, capture_output=True)
        p = json.load(open(out, encoding='utf-8'))
    pages.append({k: v for k, v in p.items() if k != 'form'})
json.dump({'form': 'muster-64', 'pages': pages}, open(f'{root}/data/forms/layout/muster-64.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(len(fields), 'Felder, Seiten', len(pages))
