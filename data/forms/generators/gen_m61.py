"""Erzeugt data/forms/muster-61.json (Teil A–E). Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 103–118)."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] in ('61 Teil A', '61 Teil B–E') for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []


def f(id_, label, kind, filled_by, page, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by, 'page': page}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, page, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', kw.pop('filled_by', 'praxis'), page, (x, y, 3.0, 2.1), rules, **kw)


PERS = 'Personalien (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)'
PERS_RULE = rule('m61.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')

# ---------- Teil A (Seite 0)
f('personalien_a', PERS, 'personalien', 'duria', 0, (4.2, 1.5, 38.2, 15.8), [PERS_RULE])


def diagnosen(prefix, page, rules_dx, rules_urs):
    for i, y in enumerate((26.3, 29.1, 32.0, 37.7, 40.5, 43.4), start=1):
        lab = 'Rehabilitationsbegründende Funktionsdiagnose' if i <= 3 else 'Weitere rehabilitationsrelevante Diagnose'
        f(f'{prefix}dx{i}', f'{lab} {i}', 'text', 'arzt', page, (12.7, y - 0.7, 41.2, 2.4), rules_dx if i == 1 else [], marker='❸' if page else '❶')
        f(f'{prefix}icd{i}', f'Diagnoseschlüssel ICD-10-GM {i}', 'text', 'arzt', page, (57.6, y - 0.7, 13.3, 2.4), [], marker='❸' if page else '❶')
        f(f'{prefix}urs{i}', f'Ursache {i} (1–5)', 'text', 'arzt', page, (74.5, y - 0.7, 2.6, 2.4), rules_urs if i == 1 else [], marker='❹' if page else '❷')


diagnosen('a_', 0, [rule('m61.a_diagnosen')], [rule('m61.a_ursachen')])
cb('a_beratung', 'Beratung der/des Versicherten', 0, 10.4, 50.2, [rule('m61.a_beratung')], group='a_anfrage', marker='❸')
cb('a_pruefung', 'Prüfung des zuständigen Rehabilitationsträgers', 0, 10.4, 58.8, [rule('m61.a_pruefung')], group='a_anfrage', marker='❹')
f('a_anmerkungen', 'ggf. weitere Anmerkungen', 'text', 'arzt', 0, (10.3, 70.8, 43.1, 4.6), [rule('m61.a_anmerkungen')], marker='❺', lines=2)
f('a_datum', 'Datum (Teil A)', 'date', 'praxis', 0, (58.1, 73.9, 13.9, 2.1), [], format='TTMMJJ')
f('a_stempel', 'Vertragsarztstempel / Unterschrift (Teil A)', 'stempel', 'arzt', 0, (73.6, 64.0, 22.8, 12.5), [])
cb('a_kk_kk', 'Zuständig: Krankenkasse (Teil B–E ausfüllen)', 0, 10.4, 82.3, [rule('m61.a_rueckmeldung')], filled_by='leistungserbringer', group='a_rueckmeldung', marker='❻')
cb('a_kk_rv', 'Zuständig: Rentenversicherung', 0, 10.4, 85.2, [], filled_by='leistungserbringer', group='a_rueckmeldung', marker='❻')
cb('a_kk_sonst', 'Zuständig: Sonstiges', 0, 10.4, 88.0, [], filled_by='leistungserbringer', group='a_rueckmeldung', marker='❻')

# ---------- Teil B (Seite 1)
f('personalien', PERS, 'personalien', 'duria', 1, (4.2, 1.5, 38.2, 15.8), [PERS_RULE])
cb('b_erwerb', 'Weder Minderung/erhebliche Gefährdung der Erwerbsfähigkeit noch Folge eines Arbeitsunfalls/einer Berufskrankheit', 1, 44.9, 8.9, [rule('m61.be_zustaendigkeit')], marker='❶')
cb('b_gleichrangig', 'Gleichrangige Zuständigkeit: Versicherte/r wünscht Reha zu Lasten der GKV', 1, 44.9, 15.3, [rule('m61.be_gleichrangig')], marker='❷')
diagnosen('', 1, [rule('m61.be_diagnosen')], [rule('m61.be_ursachen')])
f('anamnese', 'Kurze Angaben zur Anamnese und zu Krankenhaus-/Facharztbehandlung', 'text', 'arzt', 1, (12.7, 49.4, 83.5, 8.2), [rule('m61.be_anamnese')], marker='❺', lines=3)
f('befunde', 'Rehabilitationsrelevante Schädigungen und Befunde', 'text', 'arzt', 1, (12.7, 59.4, 83.5, 5.2), [rule('m61.be_schaedigungen')], marker='❻', lines=2)
TESTS = [  # id, label, x, y, w, bereich
    ('t_tug', 'TUG (sek)', 18.8, 69.5, 5.0, 'mobilitaet'), ('t_chair', 'Chair Rise (sek)', 33.3, 69.5, 4.9, 'mobilitaet'),
    ('t_hand_kg', 'Handkraft (kg)', 18.8, 72.3, 5.0, 'mobilitaet'), ('t_hand_kpa', 'Handkraft (kpa)', 33.5, 72.3, 7.3, 'mobilitaet'),
    ('t_demmi', 'DEMMI (/100)', 18.8, 75.2, 5.0, 'mobilitaet'), ('t_tinetti', 'Tinetti (/28)', 33.3, 75.2, 4.9, 'mobilitaet'),
    ('t_mmst', 'MMST (/30)', 48.5, 69.5, 4.8, 'kognition'), ('t_gds', 'GDS 15 (/15)', 48.5, 72.3, 4.8, 'kognition'), ('t_uhr', 'Uhrentest (/7)', 48.5, 75.2, 4.8, 'kognition'),
    ('t_schmerz', 'Schmerzskala (/10)', 65.3, 69.5, 4.9, 'schmerz'),
    ('t_ergo', 'Ergometrie (Watt)', 83.6, 69.5, 7.3, 'herz_lunge'), ('t_fev1', 'FEV1 (%)', 82.6, 72.3, 4.8, 'herz_lunge'),
    ('t_vk', 'VK (%)', 89.8, 72.3, 4.9, 'herz_lunge'), ('t_nyha', 'NYHA-Stadium', 81.4, 75.2, 2.4, 'herz_lunge'),
]
for i, (id_, label, x, y, w, _) in enumerate(TESTS):
    f(id_, f'Funktionstest {label}', 'text', 'arzt', 1, (x, y, w, 2.2), [rule('m61.be_funktionstests')] if i == 0 else [], marker='❼')
f('interventionen', 'Bisherige Interventionen/Maßnahmen einschl. Heilmittel (letzte 6 Monate)', 'text', 'arzt', 1, (12.7, 80.8, 83.5, 4.8), [rule('m61.be_interventionen')], marker='❽', lines=2)
cb('hm_nicht_ausreichend', 'Heilmittel zur Erreichung des Behandlungszieles nicht ausreichend', 1, 12.8, 86.6, [], marker='❽')
cb('hilfsmittel_nein', 'Rehabilitationsrelevante Hilfsmittel: nein', 1, 12.8, 90.9, [], group='hilfsmittel', marker='❽')
cb('hilfsmittel_ja', 'Rehabilitationsrelevante Hilfsmittel: ja', 1, 24.4, 90.9, [], group='hilfsmittel', marker='❽')
f('hilfsmittel_text', 'Hilfsmittel, welche?', 'text', 'arzt', 1, (36.4, 90.9, 59.8, 2.1), [], marker='❽')

# ---------- Teil C (Seite 2)
f('personalien_c', 'Name, Kostenträgerkennung, Versicherten-Nr.', 'personalien', 'duria', 2, (10.3, 1.6, 67.1, 3.0), [PERS_RULE])
COLS = [('k', 'keine Beeinträchtigungen', 62.3), ('e', 'Einschränkungen', 72.1), ('h', 'personelle Hilfe nötig', 81.8), ('n', 'nicht durchführbar', 92.6)]
F_ROWS = [('lernen', 'Lernen und Wissensanwendung', 10.3), ('aufgaben', 'Allgemeine Aufgaben und Anforderungen', 13.2), ('kommunikation', 'Kommunikation', 16.0),
          ('transfer', 'Transfer Bett/Stuhl bzw. Rollstuhl', 22.4), ('stehen', 'Stehen/Gehen', 24.5), ('treppen', 'Treppensteigen', 26.7), ('mob_sonst', 'Mobilität sonstige', 28.8),
          ('essen', 'Essen/Trinken', 35.2), ('kleiden', 'An-/Auskleiden', 37.3), ('waschen', 'Waschen', 39.5), ('baden', 'Baden/Duschen', 41.6), ('toilette', 'Toilettenbenutzung', 43.8),
          ('sv_sonst', 'Selbstversorgung sonstige', 45.9), ('haeuslich', 'Häusliches Leben', 48.8), ('interpersonell', 'Interpersonelle Aktivitäten', 51.7),
          ('lebensbereiche', 'Bedeutende Lebensbereiche', 54.5), ('gemeinschaft', 'Gemeinschaftsleben und soziales Leben', 59.5)]
for j, (rid, rlabel, y) in enumerate(F_ROWS):
    for k, (cid, clabel, x) in enumerate(COLS):
        cb(f'f_{rid}_{cid}', f'{rlabel}: {clabel}', 2, x, y, [rule('m61.be_beeintraechtigungen')] if j == 0 and k == 0 else [], group='aktivitaeten', marker='❾')
cb('f_mobilitaet_keine', 'Mobilität insgesamt: keine Beeinträchtigungen', 2, 62.3, 18.9, [], group='aktivitaeten', marker='❾')
cb('f_selbstversorgung_keine', 'Selbstversorgung insgesamt: keine Beeinträchtigungen', 2, 62.3, 31.7, [], group='aktivitaeten', marker='❾')
f('f_mob_sonst_text', 'Mobilität sonstige (Text)', 'text', 'arzt', 2, (22.0, 28.3, 38.0, 2.2), [])
f('f_sv_sonst_text', 'Selbstversorgung sonstige (Text)', 'text', 'arzt', 2, (22.0, 45.4, 38.0, 2.2), [])
f('kontext', 'Rehabilitationsrelevante umwelt- und personbezogene Faktoren', 'text', 'arzt', 2, (15.2, 70.6, 81.0, 8.0), [rule('m61.be_kontextfaktoren')], marker='❿', lines=3)
cb('r_bewegung', 'Risiko: Bewegungsmangel/Fehlhaltung', 2, 15.3, 80.9, [], marker='❿')
f('r_bmi', 'BMI', 'number', 'arzt', 2, (39.4, 80.9, 9.1, 2.1), [], marker='❿')
cb('r_ernaehrung', 'Risiko: Fehl-/Mangelernährung', 2, 52.7, 80.9, [], marker='❿')
cb('r_medikamente', 'Risiko: Medikamente', 2, 70.9, 80.9, [], marker='❿')
cb('r_nikotin', 'Risiko: Nikotin', 2, 87.9, 80.9, [], marker='❿')
cb('r_sonst', 'Risiko: Sonstiges (z. B. Suchtmittel)', 2, 15.3, 83.7, [], marker='❿')
f('r_sonst_text', 'Risiko sonstiges (Text)', 'text', 'arzt', 2, (35.8, 83.6, 60.4, 2.2), [])
cb('rf_ja', 'Ausreichende physische und psychische Belastbarkeit: ja', 2, 76.9, 92.3, [], group='rehafaehig', marker='⓫')
cb('rf_nein', 'Ausreichende physische und psychische Belastbarkeit: nein', 2, 87.9, 92.3, [], group='rehafaehig', marker='⓫')

# ---------- Teil D (Seite 3)
f('personalien_d', 'Name, Kostenträgerkennung, Versicherten-Nr.', 'personalien', 'duria', 3, (10.3, 1.6, 67.1, 3.0), [PERS_RULE])
f('ziele', 'Rehabilitationsziele (Schädigungen und Beeinträchtigungen)', 'text', 'arzt', 3, (12.7, 9.3, 83.5, 5.0), [rule('m61.be_ziele')], marker='⓬', lines=2)
f('ziele_patient', 'Rehabilitationsziele aus Sicht der Patientin/des Patienten, sofern abweichend', 'text', 'arzt', 3, (12.7, 16.6, 83.5, 2.2), [], marker='⓬')
cb('prog_ja', 'Positive Prognose: ja', 3, 10.4, 25.3, [rule('m61.be_prognose')], group='prognose', marker='⓭')
cb('prog_eingeschraenkt', 'Positive Prognose: eingeschränkt', 3, 18.8, 25.3, [], group='prognose', marker='⓭')
f('prog_text', 'Prognose eingeschränkt hinsichtlich', 'text', 'arzt', 3, (52.7, 25.2, 43.5, 5.0), [], marker='⓭', lines=2)
for id_, label, x, y in (('rf_ambulant', 'ambulant', 12.8, 35.3), ('rf_mobil', 'ambulant-mobil', 32.1, 35.3), ('rf_stationaer', 'stationär', 52.7, 35.3),
                         ('rf_muetter', 'Mütter-Leistung', 12.8, 38.1), ('rf_vaeter', 'Väter-Leistung', 32.1, 38.1),
                         ('rf_mutter_kind', 'als Mutter-Kind-Leistung', 52.7, 38.1), ('rf_vater_kind', 'als Vater-Kind-Leistung', 76.9, 38.1)):
    cb(id_, f'Rehabilitationsform: {label}', 3, x, y, [rule('m61.be_rehaform')] if id_ == 'rf_ambulant' else [], group='rehaform', marker='⓮')
f('schwerpunkt', 'Inhaltliche Schwerpunkte/Indikationen', 'text', 'arzt', 3, (12.7, 42.6, 62.3, 2.1), [], marker='⓮')
cb('geriatrisch', 'geriatr. Rehabilitation', 3, 76.9, 42.4, [rule('m61.be_geriatrie')], marker='⓮')
cb('bem_pflegend', 'Weitere Bemerkungen: pflegende/r Angehörige/r', 3, 12.8, 49.5, [], marker='⓮')
cb('bem_andere', 'Weitere Bemerkungen: andere', 3, 32.1, 49.5, [], marker='⓮')
f('bem_text', 'Weitere Bemerkungen/Begründungen', 'text', 'arzt', 3, (41.2, 49.5, 55.0, 2.1), [], marker='⓮')
cb('wf_neu', 'Wartefrist: neue Indikation', 3, 10.4, 56.7, [rule('m61.be_wartefrist')], group='wartefrist', marker='⓯')
cb('wf_verschlimmerung', 'Wartefrist: Verschlimmerung bei gleicher Indikation', 3, 29.7, 56.7, [], group='wartefrist', marker='⓯')
cb('entlastung', 'Zeitweise Entlastung und Distanzierung vom sozialen Umfeld nötig', 3, 10.4, 59.5, [rule('m61.be_entlastung')], marker='⓰')
cb('haeuslich_gesichert', 'Bei ambulanter Reha ist die häusliche Versorgung gesichert', 3, 10.4, 62.4, [rule('m61.be_ambulant')], marker='⓱')
cb('reise_oeffentlich', 'Reisefähigkeit: öffentliche Verkehrsmittel', 3, 10.4, 68.1, [rule('m61.be_reisefaehigkeit')], group='reise', marker='⓲')
cb('reise_pkw', 'Reisefähigkeit: PKW erforderlich', 3, 29.7, 68.1, [], group='reise', marker='⓲')
cb('reise_begleit', 'Reisefähigkeit: Begleitperson erforderlich', 3, 51.6, 68.1, [], group='reise', marker='⓲')
cb('pb_mitaufnahme', 'Mitaufnahme der/des Pflegebedürftigen gewünscht', 3, 10.4, 73.8, [rule('m61.be_pflegebeduerftige')], marker='⓳')
cb('pb_koordination', 'Koordination der Versorgung der/des Pflegebedürftigen gewünscht', 3, 10.4, 76.6, [], marker='⓳')
f('sonstiges', 'Sonstiges / Rückruf erbeten unter', 'text', 'arzt', 3, (10.3, 82.4, 61.7, 4.9), [rule('m61.be_sonstiges')], marker='⓴', lines=2)

# ---------- Teil E (Seite 4)
f('personalien_e', 'Name, Kostenträgerkennung, Versicherten-Nr.', 'personalien', 'duria', 4, (10.3, 1.6, 67.1, 3.0), [PERS_RULE])
cb('einw1_ja', 'Einwilligung Übermittlung MD-Stellungnahme an den Verordner: ja', 4, 12.8, 13.9, [rule('m61.be_einwilligungen')], group='einw1')
cb('einw1_nein', 'Einwilligung Übermittlung MD-Stellungnahme an den Verordner: nein', 4, 21.3, 13.9, [], group='einw1')
cb('einw2_ja', 'Einwilligung Übermittlung der Leistungsentscheidung an Angehörige/Einrichtungen: ja', 4, 12.8, 21.0, [], group='einw2')
cb('einw2_nein', 'Einwilligung Übermittlung der Leistungsentscheidung an Angehörige/Einrichtungen: nein', 4, 21.3, 21.0, [], group='einw2')
f('e_datum', 'Datum (Verordnung Teil B–E)', 'date', 'praxis', 4, (57.6, 35.6, 14.5, 2.2), [], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', 4, (73.6, 25.4, 22.8, 12.6),
  [{'id': 'm61.stempel', 'text': 'Vertragsarztstempel und persönliche Unterschrift erst nach vollständigem Ausfüllen.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])
f('versicherte', 'Angaben der/des Versicherten (Angehörige, Vertrauenspersonen, Einrichtungen) – füllt die/der Versicherte aus', 'text', 'leistungserbringer', 4, (12.7, 49.0, 83.5, 28.5),
  [rule('m61.be_angaben_versicherter')])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-61', 'muster': '61', 'title': 'Medizinische Rehabilitation (Teil A–E)',
    'form_version': '7.2022', 'released': '2022-03-23', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Teil A–E', 'width': 595.3, 'height': 841.9, 'tint': 'gelb'},
    'pages': ['Teil A', 'Teil B', 'Teil C', 'Teil D', 'Teil E'],
    'copies': [
        {'id': '61a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse'},
        {'id': '61b', 'label': 'Ausfertigung für den Vertragsarzt', 'recipient': 'verbleibt in der Praxis'},
    ],
    'notes': [rule('m61.a_zweck'), rule('m61.a_nur_teil_a'), rule('m61.a_klarheit'), rule('m61.be_voraussetzung'), rule('m61.be_vorsorge'), rule('m61.be_anlagen'),
              {'id': 'm61.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko, nicht mit roter Farbe.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}],
    'groups': [
        {'id': 'a_anfrage', 'label': 'Teil A: Hinweis/Anfrage an die Krankenkasse', 'select': 'genau_eins', 'rule': rule('m61.a_nur_teil_a')},
        {'id': 'a_rueckmeldung', 'label': 'Teil A III: zuständiger Träger (füllt die Krankenkasse aus)', 'select': 'beliebig', 'rule': rule('m61.a_rueckmeldung')},
        {'id': 'hilfsmittel', 'label': 'Rehabilitationsrelevante Hilfsmittel', 'select': 'genau_eins', 'rule': rule('m61.be_interventionen')},
        {'id': 'aktivitaeten', 'label': 'F. Beeinträchtigungen der Aktivitäten/Teilhabe (je Bereich ein Kreuz)', 'select': 'beliebig', 'rule': rule('m61.be_beeintraechtigungen')},
        {'id': 'rehafaehig', 'label': 'Rehabilitationsfähigkeit', 'select': 'genau_eins', 'rule': rule('m61.be_rehafaehigkeit')},
        {'id': 'prognose', 'label': 'Rehabilitationsprognose', 'select': 'genau_eins', 'rule': rule('m61.be_prognose')},
        {'id': 'rehaform', 'label': 'Empfohlene Rehabilitationsform', 'select': 'genau_eins', 'rule': rule('m61.be_rehaform')},
        {'id': 'wartefrist', 'label': 'Vor Ablauf der Wartefrist (4 Jahre) notwendig wegen', 'select': 'beliebig', 'rule': rule('m61.be_wartefrist')},
        {'id': 'reise', 'label': 'Reisefähigkeit', 'select': 'beliebig', 'rule': rule('m61.be_reisefaehigkeit')},
        {'id': 'einw1', 'label': 'Einwilligung 1: MD-Stellungnahme an den Verordner', 'select': 'genau_eins', 'rule': rule('m61.be_einwilligungen')},
        {'id': 'einw2', 'label': 'Einwilligung 2: Leistungsentscheidung an Angehörige/Einrichtungen', 'select': 'genau_eins', 'rule': rule('m61.be_einwilligungen')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-61.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
