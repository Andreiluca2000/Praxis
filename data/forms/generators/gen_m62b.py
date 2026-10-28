"""Erzeugt data/forms/muster-62b.json (Verordnung außerklinischer Intensivpflege).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 123–127), Lage der Felder aus der Mustersammlung (Seiten 82/83 = Ausfertigung 62Ba, Vorder- und Rückseite;
Seiten 84/85 = 62Bb/62Bc, deckungsgleiche Vorderseiten).
python data/forms/generators/gen_m62b.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '62B' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 62Ba (1.2023)'}}


fields = []
CB = (2.9, 2.0)
SIGN = {'id': 'm62b.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}
PERS = {'id': 'm62b.personalien', 'text': 'Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.',
        'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 5 und Nr. 6, S. 5'}}
BACK_ONLY = ['62Ba']
ANTRAG_HINWEIS = ms('m62b.antrag_vorabinfo', 'Der Antrag des Versicherten ist bei Vorabinformation aus dem Krankenhaus nicht auszufüllen (Hinweis auf dem Vordruck).', 'PDF-Seite 83')
LE_HINWEIS = ms('m62b.le_vorabinfo', 'Die Angaben des Leistungserbringers nach § 132l Abs. 5 SGB V sind bei Vorabinformation aus dem Krankenhaus nicht auszufüllen (Hinweis auf dem Vordruck).', 'PDF-Seite 83')


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), who='arzt', page=0, **kw):
    f(id_, label, 'checkbox', who, (x, y) + CB, rules, page, **kw)


# ---------- Vorderseite (Mustersammlung S. 82)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (4.4, 1.7, 38.0, 15.7), [PERS])
for n, x in enumerate((45.4, 58.1, 70.8, 83.5), start=1):
    f(f'diagnose_{n}', f'Verordnungsrelevante Diagnose(n) (ICD-10-Code) {n}', 'text', 'arzt', (x, 6.8, 12.1 if n < 4 else 12.7, 2.1),
      [rule('m62b.diagnosen')] if n == 1 else [], marker='❶')
f('vom', 'vom', 'date', 'arzt', (49.1, 9.6, 14.4, 2.1), [rule('m62b.zeitraum')], format='TTMMJJ', marker='❷')
f('bis', 'bis', 'date', 'arzt', (68.5, 9.6, 14.4, 2.1), format='TTMMJJ', marker='❷')
f('entlassdatum', 'Voraussichtliches Entlassdatum (nur durch Krankenhaus anzugeben)', 'date', 'krankenhaus', (68.5, 12.5, 14.4, 2.1), [rule('m62b.entlassdatum')],
  format='TTMMJJ', marker='❸')
cb('erstverordnung', 'Erstverordnung', 4.4, 18.2, [rule('m62b.erst_folge')], group='verordnungsart', marker='❹')
cb('folgeverordnung', 'Folgeverordnung', 17.7, 18.2, group='verordnungsart', marker='❹')
cb('vorabinformation', 'Vorabinformation aus dem Krankenhaus vor Entlassung gemäß § 10 Abs. 4 Satz 1 AKI-Richtlinie (fakultativ I bis III)', 32.2, 18.2,
   [rule('m62b.vorabinfo')], who='krankenhaus', marker='❺')
cb('unfall', 'Unfall', 85.4, 18.2, [rule('m62b.unfall')], marker='❻')

# I. Klinischer Status (❼)
cb('beatmung', 'Beatmung, seit', 10.4, 23.9, [rule('m62b.klinischer_status')], marker='❼')
f('beatmung_seit', 'Beatmung, seit', 'date', 'arzt', (31.0, 23.9, 14.4, 2.1), format='TTMMJJ', marker='❼')
cb('form_invasiv', 'Beatmungsform: invasiv', 14.0, 28.2, group='beatmungsform', marker='❼')
cb('form_nicht_invasiv', 'Beatmungsform: nicht invasiv, Maskentyp', 14.0, 31.1, group='beatmungsform', marker='❼')
f('maskentyp', 'nicht invasiv, Maskentyp', 'text', 'arzt', (30.9, 31.0, 14.5, 2.1), marker='❼')
f('dauer_tag', 'Beatmungsdauer: Stunden pro Tag', 'number', 'arzt', (62.4, 28.2, 4.7, 2.1), marker='❼')
f('dauer_nacht', 'Beatmungsdauer: Stunden pro Nacht', 'number', 'arzt', (62.4, 31.0, 4.7, 2.1), marker='❼')
f('spontan_tag', 'Spontanatmungszeit: Stunden pro Tag', 'number', 'arzt', (79.3, 28.2, 4.7, 2.1), marker='❼')
f('spontan_nacht', 'Spontanatmungszeit: Stunden pro Nacht', 'number', 'arzt', (79.3, 31.0, 4.7, 2.1), marker='❼')
cb('tracheostoma', 'Tracheostoma, seit', 10.4, 33.9, marker='❼')
f('tracheostoma_seit', 'Tracheostoma, seit', 'date', 'arzt', (31.0, 33.9, 14.4, 2.1), format='TTMMJJ', marker='❼')
cb('kanuele_geblockt', 'Trachealkanüle: geblockt', 14.0, 38.2, group='trachealkanuele', marker='❼')
cb('kanuele_ungeblockt', 'Trachealkanüle: ungeblockt', 31.0, 38.2, group='trachealkanuele', marker='❼')
cb('kanuele_sprechventil', 'Trachealkanüle: Sprechventil', 47.9, 38.2, group='trachealkanuele', marker='❼')
f('entblockungszeiten', 'Entblockungszeiten', 'text', 'arzt', (62.3, 38.1, 33.3, 2.1), marker='❼')
cb('absaugpflicht', 'Endotracheale Absaugpflicht', 10.4, 41.1, marker='❼')
f('absaugfrequenz', 'durchschnittliche tgl. Absaugfrequenz', 'number', 'arzt', (53.9, 41.0, 6.3, 2.1), marker='❼')
cb('absaug_regelmaessig', 'zu regelmäßigen Zeiten', 62.4, 41.1, group='absaugzeiten', marker='❼')
cb('absaug_unregelmaessig', 'zu unregelmäßigen Zeiten', 79.3, 41.1, group='absaugzeiten', marker='❼')
cb('vitale_einschraenkung', 'Sonstige vitale Funktionseinschränkungen, Art und Häufigkeit', 10.4, 43.9, marker='❼')
f('vitale_art_1', 'Sonstige vitale Funktionseinschränkungen, Art und Häufigkeit', 'text', 'arzt', (58.7, 43.9, 37.5, 2.1), marker='❼')
f('vitale_art_2', 'Sonstige vitale Funktionseinschränkungen, Art und Häufigkeit (2. Zeile)', 'text', 'arzt', (10.3, 46.7, 85.9, 2.1), marker='❼')
cb('bewusstseinsstoerung', 'Bewusstseinsstörung, Art', 10.4, 49.6, marker='❼')
f('bewusstseinsstoerung_art', 'Bewusstseinsstörung, Art', 'text', 'arzt', (34.5, 49.6, 61.7, 2.1), marker='❼')
for y, key, label in [(54.6, 'uneingeschraenkt', 'uneingeschränkt'), (56.7, 'eingeschraenkt', 'eingeschränkt'), (58.9, 'nicht_moeglich', 'nicht möglich')]:
    cb(f'mitwirkung_{key}', f'Mitwirkung bei AKI: {label}', 11.0, y, group='mitwirkung', marker='❼')
    cb(f'kommunikation_{key}', f'Kommunikation/Verständigung: {label}', 27.3, y, group='kommunikation', marker='❼')
for y, key, label in [(54.6, 'ort', 'Ort'), (56.7, 'zeit', 'Zeit'), (58.9, 'person', 'Person'), (61.0, 'situation', 'Situation'), (63.1, 'nicht_vorhanden', 'nicht vorhanden')]:
    cb(f'orientierung_{key}', f'Orientierung vorhanden, zu: {label}', 43.7, y, group='orientierung', marker='❼')
for y, key, label in [(54.6, 'uneingeschraenkt', 'uneingeschränkt'), (56.7, 'bettkante', 'bis an die Bettkante in den Rollstuhl'), (58.9, 'stehfaehig', 'stehfähig, gehfähig'),
                      (61.0, 'immobil', 'immobil')]:
    cb(f'mobilitaet_{key}', f'Mobilität vorhanden: {label}', 54.5, y, group='mobilitaet', marker='❼')
for y, key, label in [(54.6, 'nackengriff', 'Nackengriff'), (56.7, 'schuerzengriff', 'Schürzengriff'), (58.9, 'faustschluss', 'Faustschluss'), (61.0, 'pinzettengriff', 'Pinzettengriff')]:
    cb(f'mobilitaet_{key}', f'Mobilität vorhanden: {label}', 72.1, y, group='mobilitaet', marker='❼')
for y, key, label in [(54.6, 'nein', 'nein'), (56.7, 'ja', 'ja'), (58.9, 'teilweise', 'teilweise')]:
    cb(f'ernaehrung_{key}', f'Orale Ernährung: {label}', 86.0, y, group='ernaehrung', marker='❼')
# II. Erforderlicher Leistungsumfang der AKI (❽)
f('stunden_je_tag', 'Erforderlicher Leistungsumfang der AKI: Stunden je Tag', 'number', 'arzt', (49.1, 65.9, 4.7, 2.1), [rule('m62b.leistungsumfang')], marker='❽')
# III. Weitere Hinweise
cb('entfall_erhebung', 'Innerhalb von mindestens zwei Jahren wurde zweimal in Folge im Rahmen einer unmittelbar persönlichen Erhebung festgestellt, dass keine Aussicht auf nachhaltige Besserung der zu Grunde liegenden Funktionsstörung besteht und eine Entwöhnung oder Dekanülierung dauerhaft nicht möglich ist. Eine regelmäßige Erhebung des Beatmungsentwöhnungs- bzw. Dekanülierungspotenzials ist nicht mehr angezeigt.',
   10.4, 71.7, [rule('m62b.erhebung_entfall')], marker='❾')
cb('opt_angezeigt', 'Erhebungen nach Muster 62A zum Zwecke der Therapieoptimierung und zur Verbesserung der Lebensqualität sind weiterhin angezeigt', 10.4, 79.5,
   [rule('m62b.therapieoptimierung')], group='therapieoptimierung', marker='❿')
cb('opt_nicht_angezeigt', 'Erhebungen nach Muster 62A zum Zwecke der Therapieoptimierung und zur Verbesserung der Lebensqualität sind nicht mehr angezeigt', 27.3, 79.5,
   group='therapieoptimierung', marker='❿')
cb('opt_abgelehnt', 'Erhebungen nach Muster 62A zum Zwecke der Therapieoptimierung und zur Verbesserung der Lebensqualität werden durch den Patienten nicht mehr gewünscht', 47.9, 79.5,
   group='therapieoptimierung', marker='❿')
f('erlaeuterungen', 'Weitere Erläuterungen', 'text', 'arzt', (10.3, 83.8, 62.3, 2.1), [rule('m62b.erlaeuterungen')], marker='⓫')
f('konsilpartner', 'Konsilpartner bei nicht beatmungspflichtigen oder nicht trachealkanülierten Versicherten, wenn die Verordnung durch eine nicht auf die Erkrankung spezialisierte Fachärztin oder Facharzt erfolgt',
  'text', 'arzt', (10.3, 89.5, 62.3, 2.1), [rule('m62b.konsilpartner')], marker='⓬')
f('sonstige_hinweise', 'Sonstige Hinweise (z.B. zu Kommunikation, Mitwirkung, Mobilität, Ernährung)', 'text', 'arzt', (10.3, 93.7, 62.3, 2.1), [rule('m62b.sonstige_hinweise')], marker='⓭')
f('stempel', 'Vertragsarztstempel/Unterschrift des verordnenden Arztes', 'stempel', 'arzt', (73.5, 83.8, 22.7, 12.0), [SIGN])

# ---------- Rückseite (Mustersammlung S. 83), nur Ausfertigung 62Ba
f('personalien_rueck', 'Name, Vorname des Versicherten / Kostenträgerkennung / Versicherten-Nr.', 'personalien', 'duria', (4.4, 1.7, 67.0, 2.8), [PERS], page=1, only_copies=BACK_ONLY)
f('antrag_vom', 'Ich beantrage außerklinische Intensivpflege für die Zeit vom', 'date', 'versicherter', (45.5, 8.2, 14.4, 2.1), [ANTRAG_HINWEIS], page=1, format='TTMMJJ', only_copies=BACK_ONLY)
f('antrag_bis', 'bis', 'date', 'versicherter', (64.8, 8.2, 14.4, 2.1), page=1, format='TTMMJJ', only_copies=BACK_ONLY)
for key, label, x, y in [('haushalt', 'in meinem Haushalt', 4.4, 11.1), ('pflegeeinrichtung', 'in einer vollstationären Pflegeeinrichtung', 4.4, 13.3),
                         ('fremder_haushalt', 'im Haushalt einer sonstigen Person', 27.3, 11.1), ('schule', 'in einer Schule, Kindergarten', 27.3, 13.3),
                         ('wohnform', 'in einer betreuten Wohnform', 27.3, 15.4), ('werkstatt', 'in einer Werkstatt für behinderte Menschen', 62.4, 11.1),
                         ('wohneinheit', 'in einer Wohneinheit', 62.4, 13.3), ('sonstige_einrichtung', 'in einer sonstigen Einrichtung', 62.4, 15.4)]:
    cb(f'ort_{key}', f'Leistungsort: {label}', x, y, who='versicherter', page=1, group='leistungsort', only_copies=BACK_ONLY)
f('leistungsort', 'Leistungsort: Name des Leistungsortes, Straße, Haus-Nr, PLZ, Ort', 'text', 'versicherter', (4.3, 18.9, 85.9, 8.6), page=1, lines=3, only_copies=BACK_ONLY)
cb('angehoerige_ja', 'Ja, es wird die Übernahme folgender Maßnahmen der außerklinischen Intensivpflege durch An- und Zugehörige angestrebt', 4.4, 29.6, who='versicherter', page=1,
   group='angehoerige_uebernahme', only_copies=BACK_ONLY)
f('angehoerige_massnahmen', 'Übernahme folgender Maßnahmen der außerklinischen Intensivpflege durch An- und Zugehörige', 'text', 'versicherter', (7.9, 31.7, 82.2, 4.3), page=1, lines=2,
  only_copies=BACK_ONLY)
cb('angehoerige_nein', 'Nein, es wird keine Übernahme von Maßnahmen der außerklinischen Intensivpflege durch An- und Zugehörige angestrebt', 4.4, 36.8, who='versicherter', page=1,
   group='angehoerige_uebernahme', only_copies=BACK_ONLY)
f('angehoerige', 'An der Versorgung beteiligte An- und Zugehörige: Name, Straße, Haus-Nr, PLZ, Ort', 'text', 'versicherter', (4.3, 41.7, 61.7, 8.6), page=1, lines=3, only_copies=BACK_ONLY)
f('datum_versicherter', 'Datum (Versicherte/r)', 'date', 'versicherter', (75.7, 49.6, 14.4, 2.1), page=1, format='TTMMJJ', only_copies=BACK_ONLY)
f('bevollmaechtigte', 'Bevollmächtigte/r bzw. Betreuer/in: Name, Straße, Haus-Nr, PLZ, Ort, Telefonnummer (freiwillige Angabe)', 'text', 'versicherter', (4.3, 53.1, 61.7, 11.4), page=1, lines=4,
  only_copies=BACK_ONLY)
f('unterschrift_versicherter', 'Unterschrift des Versicherten oder des gesetzlichen Vertreters', 'text', 'versicherter', (67.4, 52.5, 22.7, 12.0), page=1, only_copies=BACK_ONLY)
f('le_vom', 'Die außerklinische Intensivpflege wird täglich in der Zeit vom', 'date', 'leistungserbringer', (8.0, 70.9, 14.4, 2.1), [LE_HINWEIS], page=1, format='TTMMJJ', only_copies=BACK_ONLY)
f('le_bis', 'bis', 'date', 'leistungserbringer', (26.1, 70.9, 14.4, 2.1), page=1, format='TTMMJJ', only_copies=BACK_ONLY)
f('le_stunden', 'im Umfang von … Stunden erbracht', 'number', 'leistungserbringer', (52.7, 70.9, 4.7, 2.1), page=1, only_copies=BACK_ONLY)
f('le_adresse', 'Zugelassener Leistungserbringer (§ 132l Abs. 5 SGB V): Name, Straße, Haus-Nr, PLZ, Ort', 'text', 'leistungserbringer', (4.3, 75.9, 61.7, 8.6), page=1, lines=3,
  only_copies=BACK_ONLY)
f('le_ik', 'Institutionskennzeichen', 'text', 'leistungserbringer', (4.3, 84.5, 21.8, 2.9), page=1, only_copies=BACK_ONLY)
f('le_ansprechpartner', 'Ansprechpartner (Name)', 'text', 'leistungserbringer', (4.3, 87.3, 61.7, 2.9), page=1, only_copies=BACK_ONLY)
f('le_telefon', 'Telefonnummer', 'text', 'leistungserbringer', (4.3, 90.2, 30.8, 2.9), page=1, only_copies=BACK_ONLY)
f('le_fax', 'Fax-Nr.', 'text', 'leistungserbringer', (35.1, 90.2, 30.9, 2.9), page=1, only_copies=BACK_ONLY)
f('le_email', 'E-Mail-Adresse', 'text', 'leistungserbringer', (4.3, 93.0, 61.7, 2.9), page=1, only_copies=BACK_ONLY)
f('le_datum', 'Datum (Leistungserbringer)', 'date', 'leistungserbringer', (75.7, 80.9, 14.4, 2.1), page=1, format='TTMMJJ', only_copies=BACK_ONLY)
f('le_stempel', 'Stempel / Unterschrift des Leistungserbringers', 'stempel', 'leistungserbringer', (67.4, 83.8, 22.7, 12.0), page=1, only_copies=BACK_ONLY)

groups = [
    {'id': 'verordnungsart', 'label': 'Erstverordnung oder Folgeverordnung', 'select': 'beliebig', 'rule': rule('m62b.erst_folge')},
    {'id': 'beatmungsform', 'label': 'Beatmungsform', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'trachealkanuele', 'label': 'Trachealkanüle', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'absaugzeiten', 'label': 'Absaugung zu regelmäßigen / unregelmäßigen Zeiten', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'mitwirkung', 'label': 'Mitwirkung bei AKI', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'kommunikation', 'label': 'Kommunikation/Verständigung', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'orientierung', 'label': 'Orientierung vorhanden, zu', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'mobilitaet', 'label': 'Mobilität vorhanden', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'ernaehrung', 'label': 'Orale Ernährung', 'select': 'beliebig', 'rule': rule('m62b.klinischer_status')},
    {'id': 'therapieoptimierung', 'label': 'Erhebungen nach Muster 62A zum Zwecke der Therapieoptimierung', 'select': 'beliebig', 'rule': rule('m62b.therapieoptimierung')},
    {'id': 'leistungsort', 'label': 'Leistungsort (Antrag des Versicherten)', 'select': 'beliebig', 'rule': ANTRAG_HINWEIS},
    {'id': 'angehoerige_uebernahme', 'label': 'Übernahme von Maßnahmen durch An- und Zugehörige', 'select': 'beliebig', 'rule': ANTRAG_HINWEIS},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-62b', 'muster': '62B', 'title': 'Verordnung außerklinischer Intensivpflege',
    'form_version': '1.2023', 'released': '2022-05-30', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Vorder- und Rückseite (Rückseite nur bei 62Ba)', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'pages': ['Vorderseite', 'Rückseite'],
    'copies': [
        {'id': '62Ba', 'label': 'Ausfertigung für die Krankenkasse (rückseitig der Antrag des Versicherten)', 'recipient': 'Krankenkasse'},
        {'id': '62Bb', 'label': 'Ausfertigung für den Leistungserbringer nach § 132l', 'recipient': 'Leistungserbringer nach § 132l Abs. 5 SGB V'},
        {'id': '62Bc', 'label': 'Ausfertigung für den verordnenden Arzt', 'recipient': 'verbleibt in der Praxis'},
    ],
    'notes': [rule('m62b.potenzialerhebung'), rule('m62b.folgeverordnung_dauer'), rule('m62b.exemplare')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-62b.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
