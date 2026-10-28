"""Erzeugt data/forms/muster-15.json (Ohrenärztliche Verordnung einer Hörhilfe).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 56), Lage der Felder aus der Mustersammlung (Seiten 29–30).
Nicht modelliert: IK/Rechnungsnummer/Belegnummer (Leistungserbringer), Weber-/Geräusch-Feld und Zeile „Sondenohr“ der Impedanz-Tabelle (Zellbedeutung nicht eindeutig),
Kostenvoranschläge des Hörgeräteakustikers/für Tinnitusmasker, Leistung der Krankenkasse, Empfangsbestätigung, Vermerkraum der Krankenkasse.
python data/forms/generators/gen_m15.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '15' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 15 (10.2014)'}}


fields = []
CB = (2.9, 2.0)


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), page=0, **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y) + CB, rules, page, **kw)


OHRBEFUND = ms('m15.ohrbefund', 'Ohrbefund je Ohr: Gehörgang (normal, operativ erweitert, eng) und Trommelfell (intakt, durchlöchert, feucht); die linke Vordruckhälfte (Beschriftung „Rechts“/R) gilt dem rechten, die rechte Hälfte (L) dem linken Ohr.', 'PDF-Seite 29')

# Vorderseite (Mustersammlung S. 29)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria',
  (4.4, 1.7, 38.0, 15.7),
  [{'id': 'm15.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}])
cb('traeger_ja', 'Der Anspruchsberechtigte war schon Träger eines Gerätes: ja', 84.2, 8.8, [rule('m15.erst_nachversorgung')], group='vorversorgung')
cb('traeger_nein', 'Der Anspruchsberechtigte war schon Träger eines Gerätes: nein', 92.6, 8.8, group='vorversorgung')
f('nachversorgung_begruendung', 'Falls ja, warum entspricht das bisher getragene Gerät nicht mehr den Anforderungen?', 'text', 'arzt', (45.3, 13.2, 50.2, 4.3),
  [rule('m15.erst_nachversorgung')], lines=2)

# Ohrbefund: linke Hälfte des Vordrucks = rechtes Ohr, rechte Hälfte = linkes Ohr
for ear, name, xs in [('r', 'rechts', (17.9, 30.2, 39.8)), ('l', 'links', (70.8, 83.1, 92.6))]:
    for (cid, clabel, y), x in zip([('gehoergang_normal', 'Gehörgang normal', 19.6), ('gehoergang_erweitert', 'Gehörgang operativ erweitert', 19.6), ('gehoergang_eng', 'Gehörgang eng', 19.6)], xs):
        cb(f'{cid}_{ear}', f'Ohrbefund {name}: {clabel}', x, y, [OHRBEFUND] if (cid, ear) == ('gehoergang_normal', 'r') else [], group=f'gehoergang_{ear}')
    for (cid, clabel, y), x in zip([('trommelfell_intakt', 'Trommelfell intakt', 21.7), ('trommelfell_durchloechert', 'Trommelfell durchlöchert', 21.7), ('trommelfell_feucht', 'Trommelfell feucht', 21.7)], xs):
        cb(f'{cid}_{ear}', f'Ohrbefund {name}: {clabel}', x, y, group=f'trommelfell_{ear}')

# Audiogramme (je Ohr eine Zeichenfläche)
f('tonaudiogramm_r', 'Rechts: Frequenz in kHz / Hörverlust in dB (Unbehaglichkeitsschwelle bitte eintragen)', 'text', 'arzt', (14.4, 27.7, 29.5, 23.4), [rule('m15.audiometrie')])
f('tonaudiogramm_l', 'Links: Frequenz in kHz / Hörverlust in dB (Unbehaglichkeitsschwelle bitte eintragen)', 'text', 'arzt', (67.3, 27.7, 29.5, 23.4), [rule('m15.audiometrie')])
f('sprachaudiogramm_r', 'Rechts: Verständlichkeit in % / Sprachschallpegel in dB', 'text', 'arzt', (14.4, 55.3, 28.3, 24.1), [rule('m15.audiometrie')])
f('sprachaudiogramm_l', 'Links: Verständlichkeit in % / Sprachschallpegel in dB', 'text', 'arzt', (67.3, 55.3, 28.3, 24.1), [rule('m15.audiometrie')])
f('diskrimination_r', 'Rechts: Diskriminationsverlust in %', 'number', 'arzt', (34.2, 79.4, 8.6, 2.1), [rule('m15.audiometrie')])
f('diskrimination_l', 'Links: Diskriminationsverlust in %', 'number', 'arzt', (87.1, 79.4, 8.6, 2.1), [rule('m15.audiometrie')])

# Impedanz-Tabelle (Spalten: rechts dB HL / dB SL | Beschriftung | links dB HL / dB SL)
f('mo_druck_r', 'Impedanz, MO-Druck mm H2O: rechts', 'number', 'arzt', (45.2, 58.0, 5.8, 2.6))
f('mo_druck_l', 'Impedanz, MO-Druck mm H2O: links', 'number', 'arzt', (56.7, 58.0, 5.6, 2.6))
for khz, label, y, h in [('0_5', '0,5 kHz', 63.0, 2.4), ('1', '1 kHz', 65.4, 2.3), ('2', '2 kHz', 67.7, 2.4), ('4', '4 kHz', 70.1, 2.3)]:
    for cid, side, unit, x, w in [('r_hl', 'rechts', 'dB HL', 45.2, 2.9), ('r_sl', 'rechts', 'dB SL', 48.1, 2.9), ('l_hl', 'links', 'dB HL', 56.7, 2.8), ('l_sl', 'links', 'dB SL', 59.5, 2.8)]:
        f(f'stapedius_{khz}_{cid}', f'Stapedius-Reflex {label}, {side}: {unit}', 'number', 'arzt', (x, y, w, h))
for cid, label, y in [('fluestersprache', 'Fl. Spr. (Zahlen)', 76.1), ('umgangssprache', 'Um. Spr. (Zahlen)', 78.8)]:
    f(f'{cid}_r', f'{label}: rechts', 'text', 'arzt', (45.2, y, 5.8, 2.7))
    f(f'{cid}_l', f'{label}: links', 'text', 'arzt', (56.7, y, 5.6, 2.7))

f('diagnose', 'Diagnose', 'text', 'arzt', (9.5, 82.7, 63.8, 4.2), lines=2)
SEITE = rule('m15.seite')
cb('hoerhilfe_rechts', 'Hörhilfe ist notwendig: rechts', 32.9, 87.0, [SEITE], group='hoerhilfe_seite')
cb('hoerhilfe_links', 'Hörhilfe ist notwendig: links', 43.4, 87.0, group='hoerhilfe_seite')
cb('hoerhilfe_beiderseits', 'Hörhilfe ist notwendig: beiderseits', 62.2, 87.0, group='hoerhilfe_seite')
f('tinnitus_rechts_khz', 'Tinnitusmasker / Tinnitusinstrument notwendig, rechts: kHz', 'number', 'arzt', (14.0, 91.2, 3.8, 2.1), [rule('m15.audiometrie'), SEITE])
f('tinnitus_rechts_db', 'Tinnitusmasker / Tinnitusinstrument notwendig, rechts: verdeckbar dB', 'number', 'arzt', (32.9, 91.2, 3.8, 2.1), [rule('m15.audiometrie')])
f('tinnitus_links_khz', 'Tinnitusmasker / Tinnitusinstrument notwendig, links: kHz', 'number', 'arzt', (43.3, 91.2, 3.8, 2.1), [rule('m15.audiometrie')])
f('tinnitus_links_db', 'Tinnitusmasker / Tinnitusinstrument notwendig, links: verdeckbar dB', 'number', 'arzt', (62.1, 91.2, 3.8, 2.1), [rule('m15.audiometrie')])
cb('unfall', 'Die Schwerhörigkeit ist Folge von Unfall, Unfallfolgen', 43.4, 94.1, [rule('m15.unfall')])
cb('ser', 'Die Schwerhörigkeit ist Folge von Versorgungsleiden (BVG)', 62.2, 94.1, [rule('m15.unfall')])
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (76.2, 87.1, 21.8, 10.6),
  [{'id': 'm15.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

# Rückseite (Mustersammlung S. 30): Ärztliche Bescheinigung
cb('bescheinigung_hoerhilfe', 'Ich habe mich davon überzeugt, dass durch die vorgeschlagene Hörhilfe eine ausreichende Hörverbesserung erzielt wird. Das vorgeschlagene Gerät ist zweckmäßig',
   2.9, 61.3, [rule('m15.zweckmaessigkeit')], page=1)
cb('bescheinigung_tinnitus', 'Ich habe mich davon überzeugt, dass der Tinnitusmasker/das Tinnitusinstrument ausreichend zweckmäßig ist', 2.9, 66.0, [rule('m15.zweckmaessigkeit')], page=1)
f('bescheinigung_datum', 'Ausgestellt am (Ärztliche Bescheinigung)', 'date', 'praxis', (37.7, 65.7, 19.5, 4.0), [rule('m15.zweckmaessigkeit')], page=1)
f('stempel_bescheinigung', 'Vertragsarztstempel/Unterschrift des Arztes (Ärztliche Bescheinigung)', 'stempel', 'arzt', (57.2, 57.9, 33.2, 11.8), page=1)

groups = [
    {'id': 'vorversorgung', 'label': 'War der Anspruchsberechtigte schon Träger eines Gerätes (Erst- oder Nachversorgung)', 'select': 'genau_eins', 'rule': rule('m15.erst_nachversorgung')},
    {'id': 'hoerhilfe_seite', 'label': 'Hörhilfe ist notwendig: rechts, links oder beiderseits', 'select': 'beliebig', 'rule': SEITE},
]
for ear, name in (('r', 'rechtes'), ('l', 'linkes')):
    groups.append({'id': f'gehoergang_{ear}', 'label': f'Ohrbefund {name} Ohr: Gehörgang', 'select': 'beliebig', 'rule': OHRBEFUND})
    groups.append({'id': f'trommelfell_{ear}', 'label': f'Ohrbefund {name} Ohr: Trommelfell', 'select': 'beliebig', 'rule': OHRBEFUND})
doc = {
    'schema_version': '1.0.0', 'id': 'muster-15', 'muster': '15', 'title': 'Ohrenärztliche Verordnung einer Hörhilfe',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Vorder- und Rückseite', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'pages': ['Vorderseite', 'Rückseite'],
    'copies': [{'id': '15', 'label': 'Ohrenärztliche Verordnung einer Hörhilfe', 'recipient': 'Leistungserbringer (Hörgeräteakustiker); Leistung der Krankenkasse auf der Rückseite'}],
    'notes': [rule('m15.verwendung'),
              ms('m15.versicherung_audiometrie', 'Aufdruck: Die audiometrischen Untersuchungen wurden vom Arzt bzw. unter seiner Verantwortung vorgenommen.', 'PDF-Seite 29'),
              ms('m15.festbetrag', 'Aufdruck „Wichtiger Hinweis für den Versicherten“: Die Krankenkassen übernehmen die Kosten für Hörgeräte/Tinnitusmasker/Tinnitusinstrumente bis zu einem Festbetrag.', 'PDF-Seite 30'),
              ms('m15.nicht_praxis', 'Nicht von der Praxis auszufüllen: IK des Leistungserbringers, Rechnungs- und Belegnummer, Kostenvoranschlag des Hörgeräteakustikers, Kostenvoranschlag für Tinnitusmasker/Tinnitusinstrument, Leistung der Krankenkasse, Empfangsbestätigung und Vermerkraum der Krankenkasse.', 'PDF-Seiten 29–30')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-15.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
