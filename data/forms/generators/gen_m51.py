"""Erzeugt data/forms/muster-51.json (Anfrage zur Zuständigkeit eines sonstigen Kostenträgers).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 87), Lage der Felder aus der Mustersammlung (Seiten 60–61).
Die Vorderseite (Anfrage mit Sachverhalt) füllt die Krankenkasse aus; modelliert wird die Antwortseite des Vertragsarztes.
python data/forms/generators/gen_m51.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '51' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where='PDF-Seite 61'):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 51 (10.2005)'}}


fields = []
P = 1  # Rückseite
CB_W, CB_H = 3.0, 2.1


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by, 'page': P}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y, CB_W, CB_H), rules, **kw)


Z1 = rule('m51.ausfuellen')
Q_UEBERW = ms('m51.frage_ueberweisung', 'Frage: „Wurde der Patient wegen des Unfalls oder der Schädigung überwiesen?“ – nein oder ja (an einen anderen Arzt bzw. von einem anderen Arzt) mit Name und Anschrift des Arztes.')
Q_LEIST = ms('m51.frage_leistungen', 'Frage: „Wurden von Ihnen Leistungen (z. B. Arzneimittel, Heil-/Hilfsmittel, Krankentransport aufgrund des Unfalls) veranlasst / verordnet?“ – ja oder nein; bei ja genaue Bezeichnung.')
Q_DAUER = ms('m51.frage_behandlung_dauert', 'Frage: „Dauert die Behandlung noch an?“ – ja oder nein.')
Q_SPAET = ms('m51.frage_spaetfolgen', 'Frage: „Ist mit Spätfolgen zu rechnen?“ – ja, nein oder noch nicht absehbar.')
Q_DIAG = ms('m51.frage_diagnose_ser', 'Frage: „Steht die für die Bescheinigung / Verordnung (s. Vorderseite) maßgebliche Diagnose im ursächlichen Zusammenhang mit den anerkannten Versorgungsleiden?“ – ja, nein oder zweifelhaft.')
Q_AU = ms('m51.au_krankenhaus_ser', 'Nur bei Arbeitsunfähigkeit / Krankenhauseinweisung (Aufdruck): die Bescheinigung/Einweisung war ausschließlich/überwiegend wegen der anerkannten Schädigungsfolgen oder überwiegend wegen anderer Leiden, jeweils mit Zeitraum „vom … bis …“.')
IMMER = ms('m51.in_jedem_fall', 'Aufdruck: „Bitte in jedem Fall ausfüllen!“ – Behandlungstage mit EBM-Nr.')

# zu 1. Angaben bei Arbeitsunfall / sonstigem Unfall / Drittschädigung
cb('ueberw_nein', 'Wurde der Patient wegen des Unfalls oder der Schädigung überwiesen? nein', 6.7, 12.5, [Z1], group='ueberweisung')
cb('ueberw_ja', 'Wurde der Patient wegen des Unfalls oder der Schädigung überwiesen? ja, und zwar', 6.7, 15.4, group='ueberweisung')
cb('ueberw_an', 'an einen anderen Arzt', 27.3, 15.4, group='ueberweisung_richtung')
cb('ueberw_von', 'von einem anderen Arzt', 50.3, 15.4, group='ueberweisung_richtung')
f('ueberw_arzt_name', 'Name des Arztes', 'text', 'arzt', (6.7, 19.6, 39.3, 2.1), [])
f('ueberw_arzt_anschrift', 'Anschrift', 'text', 'arzt', (50.3, 19.6, 39.9, 2.1), [])
cb('leistungen_ja', 'Wurden von Ihnen Leistungen veranlasst / verordnet? ja', 61.2, 23.9, group='leistungen')
cb('leistungen_nein', 'Wurden von Ihnen Leistungen veranlasst / verordnet? nein', 72.1, 23.9, group='leistungen')
f('leistungen_welche', 'Wenn ja, welche? (bitte genaue Bezeichnung)', 'text', 'arzt', (6.7, 28.2, 83.5, 2.1), [])
cb('dauert_ja', 'Dauert die Behandlung noch an? ja', 39.4, 31.8, group='behandlung_dauert')
cb('dauert_nein', 'Dauert die Behandlung noch an? nein', 50.3, 31.8, group='behandlung_dauert')
cb('spaetfolgen_ja', 'Ist mit Spätfolgen zu rechnen? ja', 39.4, 34.6, group='spaetfolgen')
cb('spaetfolgen_nein', 'Ist mit Spätfolgen zu rechnen? nein', 50.3, 34.6, group='spaetfolgen')
cb('spaetfolgen_offen', 'Ist mit Spätfolgen zu rechnen? noch nicht absehbar', 61.2, 34.6, group='spaetfolgen')
z1_rows = [(6.7, 23.0, 23.0, y) for y in (41.0, 43.9, 46.7, 49.6)] + [(50.3, 66.6, 23.6, y) for y in (41.0, 43.9, 46.7, 49.6)]
for n, (xd, xe, we, y) in enumerate(z1_rows, 1):
    f(f'z1_tag_{n:02d}', f'zu 1.: Behandlungstag {n}', 'date', 'arzt', (xd, y, 14.5, 2.1), [IMMER] if n == 1 else [], format='TTMMJJ')
    f(f'z1_ebm_{n:02d}', f'zu 1.: EBM-Nr. zu Behandlungstag {n}', 'text', 'arzt', (xe, y, we, 2.1), [])

# zu 2. Angaben zum ursächlichen Zusammenhang mit dem Versorgungsleiden
cb('diagnose_ser_ja', 'Diagnose im ursächlichen Zusammenhang mit den anerkannten Versorgungsleiden? ja', 50.3, 56.7, [rule('m51.ser')], group='diagnose_ser')
cb('diagnose_ser_nein', 'Diagnose im ursächlichen Zusammenhang mit den anerkannten Versorgungsleiden? nein', 61.2, 56.7, group='diagnose_ser')
cb('diagnose_ser_zweifelhaft', 'Diagnose im ursächlichen Zusammenhang mit den anerkannten Versorgungsleiden? zweifelhaft', 72.1, 56.7, group='diagnose_ser')
cb('au_schaedigungsfolgen', 'ausschließlich / überwiegend wegen der anerkannten Schädigungsfolgen vom', 6.7, 63.8, group='au_ursache')
f('au_schaedigungsfolgen_vom', 'ausschließlich / überwiegend wegen der anerkannten Schädigungsfolgen vom', 'date', 'arzt', (40.6, 63.8, 14.5, 2.1), [], format='TTMMJJ')
f('au_schaedigungsfolgen_bis', 'ausschließlich / überwiegend wegen der anerkannten Schädigungsfolgen bis', 'date', 'arzt', (58.7, 63.8, 14.5, 2.1), [], format='TTMMJJ')
cb('au_andere', 'überwiegend wegen anderer Leiden vom', 6.7, 66.7, group='au_ursache')
f('au_andere_vom', 'überwiegend wegen anderer Leiden vom', 'date', 'arzt', (40.6, 66.7, 14.5, 2.1), [], format='TTMMJJ')
f('au_andere_bis', 'überwiegend wegen anderer Leiden bis', 'date', 'arzt', (58.7, 66.7, 14.5, 2.1), [], format='TTMMJJ')
for n, y in enumerate((73.8, 76.6, 79.5, 82.4, 85.2, 88.1, 90.9, 93.8), 1):
    f(f'z2_tag_{n:02d}', f'zu 2.: Behandlungstag {n}', 'date', 'arzt', (6.7, y, 14.5, 2.1), [IMMER] if n == 1 else [], format='TTMMJJ')
    f(f'z2_ebm_{n:02d}', f'zu 2.: EBM-Nr. zu Behandlungstag {n}', 'text', 'arzt', (23.0, y, 23.0, 2.1), [])
f('ausstellungsdatum', 'Ausstellungsdatum', 'date', 'praxis', (51.5, 93.8, 14.5, 2.1), [], format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (67.4, 83.8, 22.8, 12.1),
  [{'id': 'm51.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-51', 'muster': '51', 'title': 'Anfrage zur Zuständigkeit eines sonstigen Kostenträgers',
    'form_version': '10.2005', 'released': '2005-08-08', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Vorder- und Rückseite', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'pages': ['Vorderseite (Anfrage der Krankenkasse)', 'Rückseite (Antwort des Vertragsarztes)'],
    'copies': [{'id': '51', 'label': 'Anfrage mit Antwortseite', 'recipient': 'Krankenkasse (Rücksendung im Freiumschlag)'}],
    'notes': [rule('m51.zweck'), rule('m51.ausfuellen'),
              ms('m51.vorderseite', 'Die Vorderseite füllt die Krankenkasse aus: Anrede, Datum der Bescheinigung/Verordnung, Name, Geburtsdatum, Anschrift, Versichertennummer, Art der ausgestellten Unterlage (Arbeitsunfähigkeitsbescheinigung, Verordnung(en), Verordnung von Krankenhausbehandlung) und der Sachverhalt 1. (Arbeitsunfall, auch Wege-/Berufskrankheit, oder sonstiger Unfall bzw. Gewalteinwirkung) und/oder 2. (möglicher Zusammenhang mit anerkannten Versorgungsleiden). Der Arzt füllt nur die Rückseite („Vom Vertragsarzt auszufüllen!“) aus.', 'PDF-Seite 60'),
              ms('m51.ebm_01622', 'Für die Beantwortung dieser Anfrage ist die Nr. 01622 EBM berechnungsfähig (Aufdruck).', 'PDF-Seite 60')],
    'groups': [
        {'id': 'ueberweisung', 'label': 'Überweisung wegen des Unfalls oder der Schädigung', 'select': 'genau_eins', 'rule': Q_UEBERW},
        {'id': 'ueberweisung_richtung', 'label': 'Überweisung an bzw. von einem anderen Arzt', 'select': 'beliebig', 'rule': Q_UEBERW},
        {'id': 'leistungen', 'label': 'Leistungen veranlasst / verordnet', 'select': 'genau_eins', 'rule': Q_LEIST},
        {'id': 'behandlung_dauert', 'label': 'Behandlung dauert noch an', 'select': 'genau_eins', 'rule': Q_DAUER},
        {'id': 'spaetfolgen', 'label': 'Spätfolgen zu erwarten', 'select': 'genau_eins', 'rule': Q_SPAET},
        {'id': 'diagnose_ser', 'label': 'Diagnose im ursächlichen Zusammenhang mit anerkannten Versorgungsleiden', 'select': 'genau_eins', 'rule': Q_DIAG},
        {'id': 'au_ursache', 'label': 'Arbeitsunfähigkeit / Krankenhauseinweisung wegen Schädigungsfolgen oder anderer Leiden', 'select': 'beliebig', 'rule': Q_AU},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-51.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
