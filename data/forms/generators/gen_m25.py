"""Erzeugt data/forms/muster-25.json (Anregung einer ambulanten Vorsorgeleistung in anerkannten Kurorten gem. § 23 Abs. 2 SGB V).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 70), Lage der Felder aus der Mustersammlung (Seite 45, Rückseite mit den Angaben des Vertragsarztes).
python data/forms/generators/gen_m25.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '25' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where='PDF-Seite 45'):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 25 (7.2009)'}}


fields = []
CB = (1.8, 1.3)


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y) + CB, rules, **kw)


# Leistungsart (Erläuterungen Nr. 3)
cb('art_schwaechung', 'bei Schwächung der Gesundheit / zur Krankheitsverhütung', 52.0, 4.2, [rule('m25.rueckseite')], group='vorsorgeart')
cb('art_verschlimmerung', 'zur Vermeidung der Verschlimmerung behandlungsbedürftiger Krankheiten', 52.0, 7.1, group='vorsorgeart')
cb('art_kinder', 'bei Gefährdung der gesundheitlichen Entwicklung von Kindern', 52.0, 10.0, group='vorsorgeart')
f('behandlung_seit', 'Der/die Versicherte ist bei mir in Behandlung seit:', 'date', 'praxis', (38.1, 13.2, 14.2, 1.6), [], format='TTMMJJ')

# Risikofaktoren / Beschwerden
RISK = ms('m25.risikofaktoren', 'Abschnitt „Risikofaktoren/Gefährdung, Regulations-/Befindlichkeitsstörungen, Beschwerden“: zutreffende Risikofaktoren ankreuzen, unter „Sonstige“ und „aktuelle Beschwerden“ im Klartext ergänzen.')
cb('rf_blutdruck', 'erhöhter Blutdruck', 4.3, 17.4, [RISK], group='risikofaktoren')
cb('rf_bewegungsmangel', 'Bewegungsmangel/Fehlhaltung', 25.8, 17.4, group='risikofaktoren')
cb('rf_uebergewicht', 'Übergewicht/Fehlernährung', 52.0, 17.4, group='risikofaktoren')
cb('rf_stress', 'Stress', 71.5, 17.4, group='risikofaktoren')
cb('rf_rauchen', 'Rauchen', 89.1, 17.4, group='risikofaktoren')
cb('rf_sonstige', 'Sonstige Risikofaktoren', 4.3, 20.2, group='risikofaktoren')
f('rf_sonstige_text', 'Sonstige Risikofaktoren (Text)', 'text', 'arzt', (21.4, 19.4, 75.3, 1.9), [])
cb('beschwerden_cb', 'aktuelle Beschwerden (ggf. auch Regulations-/Befindlichkeitsstörungen):', 4.3, 23.1, group='risikofaktoren')
f('beschwerden', 'aktuelle Beschwerden (ggf. auch Regulations-/Befindlichkeitsstörungen), Zeile 1', 'text', 'arzt', (52.4, 22.6, 44.3, 1.7), [])
f('beschwerden_2', 'aktuelle Beschwerden, Zeile 2', 'text', 'arzt', (4.3, 26.4, 92.4, 1.9), [])

# Relevante Diagnosen (Erläuterungen Nr. 4)
for n, y in ((1, 30.3), (2, 32.7), (3, 35.0)):
    f(f'diagnose_{n}', f'Relevante Diagnose {n}. (in der Reihenfolge ihrer med. Bedeutung; Klarschrift)', 'text', 'arzt', (6.0, y, 63.1, 2.4),
      [rule('m25.diagnose_klartext')] if n == 1 else [])
    f(f'seit_{n}', f'Diagnose {n}.: seit wann?', 'text', 'arzt', (69.1, y, 9.5, 2.4), [])
    f(f'ursache_{n}', f'Diagnose {n}.: Ursache (1 = Unfallfolgen; 2 = Berufskrankheit; 3 = Gesundheitsschäden nach dem BVG)', 'number', 'arzt', (78.6, y, 9.5, 2.4),
      [rule('m25.ursache_ser')] if n == 1 else [])
    f(f'verlauf_{n}', f'Diagnose {n}.: Verlauf (1 = chronisch rezidivierend; 2 = chronisch progredient; 3 = konstitutionell/umweltbedingte Neigung zu rezidivierenden somatischen Erkrankungen)',
      'number', 'arzt', (88.1, y, 9.6, 2.4), [])

# Befund
f('befund', 'Schädigungen/Funktionsstörungen/Befund', 'text', 'arzt', (4.3, 44.0, 92.4, 5.4), [], lines=3)
f('letzte_untersuchung', 'Datum der letzten Untersuchung', 'date', 'arzt', (85.3, 42.6, 11.4, 1.3), [], format='TTMMJJ')
BEFUNDE = ms('m25.befunde', 'Aktuelle Befunde (z. B. Röntgen, EKG, Labor) / Untersuchungsberichte: ankreuzen, ob sie bei Bedarf durch den MDK angefordert werden können oder nicht vorliegen.')
cb('befunde_mdk', 'können bei Bedarf durch den MDK angefordert werden', 4.3, 51.5, [BEFUNDE], group='befunde')
cb('befunde_nicht_vorhanden', 'liegen nicht vor', 52.0, 51.5, group='befunde')
f('vorsorgeziel', 'Angestrebtes Vorsorgeziel (z. B. Schmerzlinderung, Verbesserung der Beweglichkeit, Abbau von Risikofaktoren, Verhaltensänderung)', 'text', 'arzt', (4.3, 55.2, 92.4, 2.3), [], lines=1)

# Bisherige Maßnahmen (letzte 12 Monate)
MASS = ms('m25.massnahmen', 'Abschnitt „Welche Behandlungen, Maßnahmen/Hilfen wurden in den letzten 12 Monaten durchgeführt?“: Zutreffendes ankreuzen, unter „Sonstige“ im Klartext ergänzen.')
for id_, label, x, y in [('m_krankengymnastik', 'Krankengymnastik', 4.3, 60.0), ('m_psychotherapie', 'Psychotherapie', 4.3, 61.2),
                         ('m_physik', 'Physik. Therapie', 31.0, 60.0), ('m_patientenschulung', 'Patientenschulung', 31.0, 61.2),
                         ('m_sprachtherapie', 'Stimm-, Sprech- oder Sprachtherapie', 52.0, 60.0), ('m_rehasport', 'Rehasport/Funktionstraining', 52.0, 61.2),
                         ('m_ergotherapie', 'Ergotherapie', 80.1, 60.0), ('m_selbsthilfe', 'Selbsthilfegruppe', 80.1, 61.2),
                         ('m_sonstige', 'Sonstige (z.B. Hilfsmittelversorgung):', 4.3, 64.0)]:
    cb(id_, label, x, y, [MASS] if id_ == 'm_krankengymnastik' else [], group='massnahmen')
f('m_sonstige_text', 'Sonstige (z.B. Hilfsmittelversorgung), Text', 'text', 'arzt', (31.0, 63.7, 65.7, 1.6), [])

# Wartezeit
f('wartezeit_begruendung', 'Die Vorsorgeleistung ist vor Ablauf der gesetzlichen Wartezeit von 3 Jahren medizinisch dringend erforderlich (z.B. Verschlimmerung durch akuten Schub, andere Krankheit), weil',
  'text', 'arzt', (4.3, 70.3, 92.4, 5.1),
  [ms('m25.wartezeit', 'Nur ausfüllen, sofern in den letzten 3 Jahren eine medizinische Vorsorgeleistung durchgeführt wurde (Aufdruck); dann Begründung der dringenden Erforderlichkeit vor Ablauf der Wartezeit von 3 Jahren.')],
  lines=2)

# Kurort
KURORT = rule('m25.kurort')
cb('kurort_anf_nein', 'Besondere Anforderungen an den Kurort: nein', 4.3, 77.8, [KURORT], group='kurort_anforderungen')
cb('kurort_anf_ja', 'Besondere Anforderungen an den Kurort: ja, welche', 11.5, 77.8, group='kurort_anforderungen')
f('kurort_anf_text', 'Besondere Anforderungen an den Kurort (z.B. Klima, Allergiefaktoren): welche', 'text', 'arzt', (20.5, 77.4, 50.3, 1.5), [KURORT])
f('kurort', 'empfohlener Kurort', 'text', 'arzt', (16.7, 80.3, 38.1, 1.5), [KURORT])
f('dauer_wochen', 'Dauer (Wochen)', 'number', 'arzt', (60.5, 80.3, 4.8, 1.5), [])
cb('kompaktkur_ja', 'Durchführung der Vorsorgeleistung in kompakter Form (Kompaktkur): ja', 56.2, 83.2, [rule('m25.kompaktkur')], group='kompaktkur')
cb('kompaktkur_nein', 'Durchführung der Vorsorgeleistung in kompakter Form (Kompaktkur): nein', 65.8, 83.2, group='kompaktkur')
f('bemerkungen', 'Ggf. weitere Bemerkungen', 'text', 'arzt', (22.4, 86.4, 51.4, 1.5), [])
f('bemerkungen_2', 'Ggf. weitere Bemerkungen, Zeile 2', 'text', 'arzt', (4.3, 89.0, 69.5, 1.6), [])
f('ort_datum', 'Ort und Datum', 'text', 'praxis', (58.6, 93.1, 15.2, 1.5), [])
f('stempel', 'Unterschrift und Stempel des Vertragsarztes', 'stempel', 'arzt', (74.8, 86.2, 22.8, 11.7),
  [{'id': 'm25.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-25', 'muster': '25', 'title': 'Anregung einer ambulanten Vorsorgeleistung in anerkannten Kurorten gemäß § 23 Abs. 2 SGB V',
    'form_version': '7.2009', 'released': '2009-07-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch (Rückseite mit den Angaben des Vertragsarztes)', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'copies': [{'id': '25', 'label': 'Anregung mit Angaben des Vertragsarztes (Rückseite)',
                'recipient': 'Krankenkasse (prüft die Leistungspflicht und stellt den Kurarztschein aus)'}],
    'notes': [rule('m25.vorhalten'), rule('m25.rueckseite'), rule('m25.kurarztschein'),
              ms('m25.ebm_01623', 'Für die Angaben des Arztes ist die Nr. 01623 EBM berechnungsfähig (Aufdruck auf dem Vordruck).'),
              ms('m25.auskunftspflicht', 'Hinweis auf dem Vordruck: Die erfragten Angaben werden für die Entscheidung über den Antrag des Versicherten benötigt; nach §§ 100 SGB X und 73 Abs. 2 Ziff. 9 SGB V besteht eine Pflicht zur Berichterteilung.'),
              ms('m25.gueltig', 'Die Mustersammlung nennt „gültig seit Juli 2009“ und kein Freigabedatum; released ist deshalb der 01.07.2009.')],
    'groups': [
        {'id': 'vorsorgeart', 'label': 'Art der anzuregenden Vorsorgeleistung', 'select': 'beliebig', 'rule': rule('m25.rueckseite')},
        {'id': 'risikofaktoren', 'label': 'Risikofaktoren/Gefährdung, Regulations-/Befindlichkeitsstörungen, Beschwerden', 'select': 'beliebig', 'rule': RISK},
        {'id': 'befunde', 'label': 'Aktuelle Befunde / Untersuchungsberichte', 'select': 'beliebig', 'rule': BEFUNDE},
        {'id': 'massnahmen', 'label': 'Behandlungen, Maßnahmen/Hilfen in den letzten 12 Monaten', 'select': 'beliebig', 'rule': MASS},
        {'id': 'kurort_anforderungen', 'label': 'Besondere Anforderungen an den Kurort', 'select': 'genau_eins', 'rule': KURORT},
        {'id': 'kompaktkur', 'label': 'Durchführung in kompakter Form (Kompaktkur)', 'select': 'genau_eins', 'rule': rule('m25.kompaktkur')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-25.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
