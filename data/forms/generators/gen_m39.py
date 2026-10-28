"""Erzeugt data/forms/muster-39.json (Krebsfrüherkennung Zervix-Karzinom).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 82–85), Lage der Felder aus der Mustersammlung (Seite 56, Ausfertigung 39a; Seite 57 = 39b ist deckungsgleich).
Linker Bereich (❶–❻): untersuchender Arzt (Gynäkologe); rechter Bereich (❼–❽): zytologisch tätiger Arzt.
python data/forms/generators/gen_m39.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '39' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []
CB = (3.0, 2.1)
SIGN = {'id': 'm39.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}
PERS = {'id': 'm39.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), who='arzt', **kw):
    f(id_, label, 'checkbox', who, (x, y) + CB, rules, **kw)


def zy(id_, label, x, y, rules=(), **kw):
    cb(id_, label, x, y, rules, who='leistungserbringer', **kw)


f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (4.3, 1.7, 38.1, 15.8), [PERS])

# ❶ Alterskategorie
cb('alter_20_29', 'Alterskategorie 20-29 Jahre', 9.2, 19.6, [rule('m39.alterskategorie')], group='alterskategorie', marker='❶')
cb('alter_30_34', 'Alterskategorie 30-34 Jahre', 23.7, 19.6, group='alterskategorie', marker='❶')
cb('alter_ab_35', 'Alterskategorie ab 35 Jahre', 37.0, 19.6, group='alterskategorie', marker='❶')
# ❷ Auftrag
cb('auftrag_primaer', 'Auftrag: Primärscreening', 9.2, 24.6, [rule('m39.auftrag')], group='auftrag', marker='❷')
cb('auftrag_abklaerung', 'Auftrag: Abklärungsdiagnostik', 23.7, 24.6, group='auftrag', marker='❷')
cb('auftrag_zytologie', 'Auftrag: Zytologie', 9.2, 26.8, group='auftrag', marker='❷')
cb('auftrag_hpv', 'Auftrag: HPV-Test', 23.7, 26.8, group='auftrag', marker='❷')
cb('auftrag_ko', 'Auftrag: Ko-Testung (Zyt.+HPV)', 37.0, 26.8, group='auftrag', marker='❷')
# ❸ Anamnese
cb('vor_nein', 'Wurde bereits eine Krebsfrüherkennungsuntersuchung durchgeführt? nein', 9.2, 33.9, [rule('m39.anamnese')], group='vorunters', marker='❸')
cb('vor_ja', 'Wurde bereits eine Krebsfrüherkennungsuntersuchung durchgeführt? ja, zuletzt', 23.7, 33.9, group='vorunters', marker='❸')
f('vor_datum', 'ja, zuletzt (Monat/Jahr)', 'date', 'arzt', (37.0, 33.9, 9.6, 2.1), format='MMJJ', marker='❸')
f('vor_gruppe', 'Gruppe (zytologischer Vorbefund)', 'text', 'arzt', (14.6, 37.2, 4.8, 1.8), marker='❸')
cb('impf_vollstaendig', 'HPV-Impfung vollständig', 9.2, 41.0, [rule('m39.anamnese')], group='hpv_impfung', marker='❸')
cb('impf_unvollstaendig', 'HPV-Impfung unvollständig', 9.2, 43.2, group='hpv_impfung', marker='❸')
cb('impf_keine', 'HPV-Impfung keine', 9.2, 45.3, group='hpv_impfung', marker='❸')
cb('impf_unklar', 'HPV-Impfung unklar', 9.2, 47.4, group='hpv_impfung', marker='❸')
cb('vor_hpv_nicht_vor', 'HPV-HR-Testergebnis liegt nicht vor', 23.7, 41.0, group='vor_hpv', marker='❸')
cb('vor_hpv_vor', 'HPV-HR-Testergebnis liegt vor', 23.7, 43.2, group='vor_hpv', marker='❸')
cb('vor_hpv_positiv', 'HPV-HR-Testergebnis positiv', 27.3, 45.3, group='vor_hpv', marker='❸')
cb('vor_hpv_negativ', 'HPV-HR-Testergebnis negativ', 27.3, 47.4, group='vor_hpv', marker='❸')
cb('vor_hpv_nicht_verwertbar', 'HPV-HR-Testergebnis nicht verwertbar', 27.3, 49.6, group='vor_hpv', marker='❸')
cb('op_nein', 'Gynäkologische OP, Strahlen- oder Chemotherapie des Genitales: nein', 9.2, 53.9, group='op', marker='❸')
cb('op_ja', 'Gynäkologische OP, Strahlen- oder Chemotherapie des Genitales: ja', 18.8, 53.9, group='op', marker='❸')
f('op_welche', 'Welche?', 'text', 'arzt', (30.9, 54.2, 16.3, 1.8), marker='❸')
f('op_wann', 'Wann?', 'text', 'arzt', (30.9, 56.3, 16.3, 1.8), marker='❸')
# ❹ Jetzt
f('letzte_periode', 'Jetzt: Letzte Periode', 'date', 'arzt', (15.2, 59.5, 14.4, 2.2), [rule('m39.jetzt')], format='TTMMJJ', marker='❹')
for key, label, y in [('gravid', 'Gravidität', 62.4), ('ausfluss', 'Ausfluss / pathologische Blutung', 64.5), ('iup', 'IUP', 66.7),
                      ('hormon', 'Einnahme von Ovulationshemmer / sonstige Hormonanwendung', 68.8)]:
    cb(f'{key}_nein', f'{label}: nein', 38.2, y, group=key, marker='❹')
    cb(f'{key}_ja', f'{label}: ja', 44.2, y, group=key, marker='❹')
# ❺ Klinischer Befund
cb('befund_unauffaellig', 'Klinischer Befund unauffällig', 24.9, 73.1, [rule('m39.klinischer_befund')], group='klinischer_befund', marker='❺')
cb('befund_auffaellig', 'Klinischer Befund auffällig', 38.2, 73.1, group='klinischer_befund', marker='❺')
# ❻ Erläuterungen
f('erlaeuterungen', 'Erläuterungen (ggf. gyn. Befunde (Vulva, Vagina, Portio); Diagnosen; sonstige Anmerkungen)', 'text', 'arzt', (9.2, 76.7, 38.0, 16.3),
  [rule('m39.erlaeuterungen')], lines=8, marker='❻')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (72.8, 83.8, 22.8, 12.1), [SIGN])

# ❼ Zytologischer Befund / Kombinationsbefund (zytologisch tätiger Arzt)
f('z_eingangsdatum', 'Eingangsdatum', 'date', 'leistungserbringer', (50.9, 15.4, 14.4, 2.1), [rule('m39.zytologie_befund')], format='TTMMJJ', marker='❼')
zy('z_endozervikal_vorhanden', 'Endozervikale Zellen vorhanden', 50.9, 19.6, group='endozervikal', marker='❼')
zy('z_endozervikal_nicht', 'Endozervikale Zellen nicht vorhanden', 67.2, 19.6, group='endozervikal', marker='❼')
f('z_proliferationsgrad', 'Proliferationsgrad', 'text', 'leistungserbringer', (63.5, 22.2, 20.0, 1.8), marker='❼')
zy('z_doederlein', 'Döderleinflora', 50.9, 24.6, marker='❼')
zy('z_misch', 'Mischflora', 67.2, 24.6, marker='❼')
zy('z_kokken', 'Kokkenflora', 81.1, 24.6, marker='❼')
zy('z_trichomonaden', 'Trichomonaden', 50.9, 26.8, marker='❼')
zy('z_candida', 'Candida', 67.2, 26.8, marker='❼')
zy('z_gardnerella', 'Gardnerella', 81.1, 26.8, marker='❼')
f('z_gruppe', 'Gruppe', 'text', 'leistungserbringer', (56.3, 30.0, 4.8, 1.8), marker='❼')
zy('z_hpv_positiv', 'HPV-HR-Testergebnis positiv, wenn ja: Liegt HPV-Typ 16 oder HPV-Typ 18 vor?', 50.9, 33.9, group='z_hpv', marker='❼')
zy('z_typ_ja', 'Liegt HPV-Typ 16 oder HPV-Typ 18 vor? ja', 54.4, 36.0, group='z_typ', marker='❼')
zy('z_typ_nein', 'Liegt HPV-Typ 16 oder HPV-Typ 18 vor? nein', 67.2, 36.0, group='z_typ', marker='❼')
zy('z_typ_nicht_diff', 'Liegt HPV-Typ 16 oder HPV-Typ 18 vor? nicht differenzierbar', 81.1, 36.1, group='z_typ', marker='❼')
zy('z_hpv_negativ', 'HPV-HR-Testergebnis negativ', 50.9, 38.2, group='z_hpv', marker='❼')
zy('z_hpv_nicht_verwertbar', 'HPV-HR-Testergebnis nicht verwertbar', 50.9, 40.3, group='z_hpv', marker='❼')
f('z_bemerkungen', 'Bemerkungen', 'text', 'leistungserbringer', (50.9, 43.5, 43.5, 21.0), lines=10, marker='❼')
# ❽ Zusammenfassende Empfehlung
zy('e_zytologische_kontrolle', 'Zusammenfassende Empfehlung: zytologische Kontrolle', 50.9, 62.4, [rule('m39.empfehlung')], marker='❽')
zy('e_nach_entzuendung', 'zytologische Kontrolle nach Entzündungsbehandlung', 54.5, 64.5, marker='❽')
zy('e_nach_oestrogen', 'zytologische Kontrolle nach Östrogenbehandlung', 54.5, 66.7, marker='❽')
zy('e_hpv', 'Zusammenfassende Empfehlung: HPV-Test', 50.9, 68.8, marker='❽')
zy('e_ko', 'Zusammenfassende Empfehlung: Ko-Test', 50.9, 71.0, marker='❽')
zy('e_kolposkopie', 'Zusammenfassende Empfehlung: Abklärungskolposkopie', 50.9, 73.1, marker='❽')
zy('e_zeitraum_in', 'Zeitraum: in … Monaten', 50.9, 77.4, group='e_zeitraum', marker='❽')
f('e_monate', 'Zeitraum: in … Monaten (Anzahl)', 'number', 'leistungserbringer', (56.3, 77.5, 4.2, 2.0), marker='❽')
zy('e_zeitraum_sofort', 'Zeitraum: sofort', 50.9, 79.5, group='e_zeitraum', marker='❽')
f('stempel_zytologe', 'Vertragsarztstempel / Unterschrift des zytologisch tätigen Arztes', 'stempel', 'leistungserbringer', (72.8, 71.0, 22.8, 12.1), marker='❽')

groups = [
    {'id': 'alterskategorie', 'label': 'Alterskategorie', 'select': 'genau_eins', 'rule': rule('m39.alterskategorie')},
    {'id': 'auftrag', 'label': 'Auftrag (Primärscreening / Abklärungsdiagnostik; Zytologie / HPV-Test / Ko-Testung)', 'select': 'beliebig', 'rule': rule('m39.auftrag')},
    {'id': 'vorunters', 'label': 'Wurde bereits eine Krebsfrüherkennungsuntersuchung durchgeführt?', 'select': 'beliebig', 'rule': rule('m39.anamnese')},
    {'id': 'hpv_impfung', 'label': 'HPV-Impfung', 'select': 'beliebig', 'rule': rule('m39.anamnese')},
    {'id': 'vor_hpv', 'label': 'Vorbefund HPV-HR-Testergebnis', 'select': 'beliebig', 'rule': rule('m39.anamnese')},
    {'id': 'op', 'label': 'Gynäkologische OP, Strahlen- oder Chemotherapie des Genitales', 'select': 'beliebig', 'rule': rule('m39.anamnese')},
    {'id': 'gravid', 'label': 'Gravidität', 'select': 'beliebig', 'rule': rule('m39.jetzt')},
    {'id': 'ausfluss', 'label': 'Ausfluss / pathologische Blutung', 'select': 'beliebig', 'rule': rule('m39.jetzt')},
    {'id': 'iup', 'label': 'IUP', 'select': 'beliebig', 'rule': rule('m39.jetzt')},
    {'id': 'hormon', 'label': 'Einnahme von Ovulationshemmer / sonstige Hormonanwendung', 'select': 'beliebig', 'rule': rule('m39.jetzt')},
    {'id': 'klinischer_befund', 'label': 'Klinischer Befund', 'select': 'beliebig', 'rule': rule('m39.klinischer_befund')},
    {'id': 'endozervikal', 'label': 'Endozervikale Zellen', 'select': 'beliebig', 'rule': rule('m39.zytologie_befund')},
    {'id': 'z_hpv', 'label': 'HPV-HR-Testergebnis (zytologischer Befund)', 'select': 'beliebig', 'rule': rule('m39.zytologie_befund')},
    {'id': 'z_typ', 'label': 'Liegt HPV-Typ 16 oder HPV-Typ 18 vor?', 'select': 'beliebig', 'rule': rule('m39.zytologie_befund')},
    {'id': 'e_zeitraum', 'label': 'Zeitraum der empfohlenen Folgeuntersuchung', 'select': 'beliebig', 'rule': rule('m39.empfehlung')},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-39', 'muster': '39', 'title': 'Krebsfrüherkennung Zervix-Karzinom',
    'form_version': '1.2021', 'released': '2020-11-10', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'copies': [
        {'id': '39a', 'label': 'Ausfertigung für den untersuchenden Arzt', 'recipient': 'untersuchender Arzt (kommt mit dem Befund vom Zytologen zurück)'},
        {'id': '39b', 'label': 'Ausfertigung für den zytologisch tätigen Arzt', 'recipient': 'verbleibt beim zytologisch tätigen Arzt'},
    ],
    'notes': [rule('m39.zweck'), rule('m39.arbeitsteilung'), rule('m39.digital'), rule('m39.behandlungstag')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-39.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
