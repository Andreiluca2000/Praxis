"""Erzeugt data/forms/muster-12.json (Verordnung häuslicher Krankenpflege). Regeln aus data/forms/catalog.json (KBV-Erläuterungen)."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '12' for r in e['rules']}


def rule(rid, artifact='erlaeuterungen', text=None, locator=None):
    r = R.get(rid)
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def box(x, y, w, h):
    return {'x': x, 'y': y, 'w': w, 'h': h}


fields = []


def f(id_, label, kind, filled_by, b, rules=(), **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = box(*b)
    d['rules'] = list(rules)
    fields.append(d)


# Kopf
f('personalien', 'Personalienfeld (Kasse, Name, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, BSNR, LANR, Datum)', 'personalien', 'duria', (4.2, 1.5, 38.2, 15.8),
  [rule('m12.personalien', text='Die Daten der eGK werden maschinell über Kartenterminal und Praxis-EDV übertragen.', locator='Allgemeines Nr. 5 und Nr. 6, S. 5')])
for i, x in enumerate((45.4, 58.2, 71.0, 83.8), start=1):
    f(f'icd{i}', f'Verordnungsrelevante Diagnose {i} (ICD-10-Code)', 'text', 'arzt', (x, 5.4, 12.3, 2.3), [rule('m12.diagnosen')] if i == 1 else [], marker='❶')
f('einschraenkungen', 'Einschränkungen, die häusliche Krankenpflege erforderlich machen', 'text', 'arzt', (45.4, 10.9, 50.9, 4.9), [rule('m12.einschraenkungen')], marker='❷', lines=2)
f('erst', 'Erstverordnung', 'checkbox', 'praxis', (4.4, 18.2, 3.0, 2.1), [], group='art', marker='❸')
f('folge', 'Folgeverordnung', 'checkbox', 'praxis', (15.3, 18.2, 3.0, 2.1), [], group='art', marker='❸')
f('unfall', 'Unfall', 'checkbox', 'praxis', (26.7, 18.2, 2.9, 2.1), [rule('m12.unfall')], marker='❹')
f('ser', 'SER', 'checkbox', 'praxis', (35.8, 18.2, 2.9, 2.1), [rule('m12.ser')], marker='❺')
f('vom', 'vom (nur bei ärztlicher Festlegung von Häufigkeit und Dauer)', 'date', 'praxis', (49.5, 18.3, 13.6, 2.2), [rule('m12.zeitraum'), rule('m12.hybrid'), rule('m12.blanko')], format='TTMMJJ', marker='❻')
f('bis', 'bis', 'date', 'praxis', (70.1, 18.3, 13.6, 2.2), [], format='TTMMJJ', marker='❻')

# Tabelle: Pflegefachkraft-Spalte (x 69.7), Häufigkeit (73.6–84.2), Dauer (84.2–96.4)
def row(id_, label, y, pfk=True, rules=(), x=9.2, marker=None, label_box=None):
    f(id_, label, 'checkbox', 'praxis', (x, y, 3.0, 2.1), rules, marker=marker)
    if pfk:
        f(f'{id_}_pfk', f'{label}: Häufigkeit/Dauer durch Pflegefachkraft', 'checkbox', 'praxis', (69.7, y, 3.0, 2.1), [rule('m12.pflegefachkraft_leistungen')], marker='❼')
    f(f'{id_}_hf', f'{label}: Häufigkeit (tgl./wtl./mtl.)', 'text', 'praxis', (73.6, y, 10.6, 2.1), [rule('m12.haeufigkeit_dauer')], marker='❽')
    f(f'{id_}_dauer', f'{label}: Dauer (TTMM–TTMM), nur bei Abweichung', 'text', 'praxis', (84.2, y, 12.2, 2.1), [], marker='❽')


f('praeparate', 'Medikamentengabe, Präparate', 'text', 'arzt', (24.2, 23.6, 45.0, 4.0), [rule('m12.medikamentengabe')], marker='❿', lines=2)
row('medibox', 'Herrichten der Medikamentenbox', 28.2, pfk=False, marker='❿')
row('medigabe', 'Medikamentengabe', 30.3, pfk=False, marker='❿')
row('injektion', 'Injektionen', 32.4, pfk=False, marker='❿')
f('inj_herrichten', 'Injektionen herrichten', 'checkbox', 'praxis', (23.7, 32.4, 3.0, 2.1), [], marker='❿')
f('inj_im', 'intramuskulär', 'checkbox', 'praxis', (38.1, 32.4, 3.0, 2.1), [], marker='❿')
f('inj_sc', 'subkutan', 'checkbox', 'praxis', (56.3, 32.4, 3.0, 2.1), [], marker='❿')
row('bz', 'Blutzuckermessung: Erst- oder Neueinstellung (max. 4 Wochen und max. 3x täglich)', 36.7, pfk=False, marker='⓫',
    rules=[rule('m12.blutzucker'), rule('m12.bz_grenze', artifact='mustersammlung', text='Blutzuckermessung bei Erst- oder Neueinstellung: höchstens 4 Wochen und höchstens 3x täglich (Aufdruck des Vordrucks).', locator='PDF-Seite 23, Muster 12a (7.2024), Feld Blutzuckermessung')])
f('bz_intensiv', 'Blutzuckermessung bei intensivierter Insulintherapie', 'checkbox', 'praxis', (38.1, 36.7, 3.0, 2.1), [], marker='⓫')
f('k_rechts', 'Kompression rechts', 'checkbox', 'praxis', (38.1, 39.6, 3.0, 2.1), [], group='seite', marker='⓬')
f('k_links', 'Kompression links', 'checkbox', 'praxis', (47.9, 39.6, 3.0, 2.1), [], group='seite', marker='⓬')
f('k_beidseits', 'Kompression beidseits', 'checkbox', 'praxis', (56.3, 39.6, 3.0, 2.1), [], group='seite', marker='⓬')
row('kstrumpf_an', 'Kompressionsstrümpfe anziehen', 41.7, rules=[rule('m12.kompression')], marker='⓬')
f('kstrumpf_aus', 'Kompressionsstrümpfe ausziehen', 'checkbox', 'praxis', (38.1, 41.7, 3.0, 2.1), [], marker='⓬')
row('kverband_an', 'Kompressionsverbände anlegen', 43.8, marker='⓬')
f('kverband_ab', 'Kompressionsverbände abnehmen', 'checkbox', 'praxis', (38.1, 43.8, 3.0, 2.1), [], marker='⓬')
row('stuetz', 'stützende und stabilisierende Verbände', 46.7, marker='⓬')
f('stuetz_art', 'stützende/stabilisierende Verbände, Art', 'text', 'praxis', (38.1, 46.4, 31.0, 2.5), [], marker='⓬')
f('wundart', 'Wundart', 'text', 'arzt', (17.6, 50.9, 51.4, 2.3), [rule('m12.wundversorgung'), rule('m12.dekubitus')], marker='⓭')
f('lokalisation', 'Lokalisation', 'text', 'arzt', (17.6, 53.8, 12.1, 2.1), [], marker='⓭')
f('groesse', 'aktuelle Größe (Länge, Breite, Tiefe)', 'text', 'arzt', (41.8, 53.8, 12.1, 2.1), [], marker='⓭')
f('grad', 'aktueller Grad', 'text', 'arzt', (61.8, 53.8, 7.3, 2.1), [], marker='⓭')
f('verbandmaterial', 'Präparate, Verbandmaterialien', 'text', 'arzt', (23.0, 56.7, 46.0, 2.1), [], marker='⓭')
row('wund_akut', 'Wundversorgung akut', 59.5, rules=[rule('m12.wunde_pflegefachkraft')], marker='⓭')
row('wund_chronisch', 'Wundversorgung chronisch', 61.6, pfk=False, rules=[rule('m12.wunde_extern')], marker='⓭')
for i, y in ((1, 65.9), (2, 68.1)):
    f(f'sonst{i}', f'Sonstige Maßnahme der Behandlungspflege {i}', 'text', 'praxis', (9.1, y - 0.2, 59.9, 2.2), [rule('m12.sonstige')] if i == 1 else [], marker='⓮')
    f(f'sonst{i}_pfk', f'Sonstige Maßnahme {i}: Häufigkeit/Dauer durch Pflegefachkraft', 'checkbox', 'praxis', (69.7, y, 3.0, 2.1), [], marker='❼')
    f(f'sonst{i}_hf', f'Sonstige Maßnahme {i}: Häufigkeit', 'text', 'praxis', (73.6, y, 10.6, 2.1), [], marker='❽')
    f(f'sonst{i}_dauer', f'Sonstige Maßnahme {i}: Dauer (TTMM–TTMM)', 'text', 'praxis', (84.2, y, 12.2, 2.1), [], marker='❽')
f('anleitung', 'Anleitung zur Behandlungspflege für Patient/Angehörige', 'text', 'praxis', (9.1, 71.8, 54.6, 2.2), [rule('m12.anleitung')], marker='⓯')
f('anleitung_anzahl', 'Anleitung: Anzahl', 'number', 'praxis', (64.2, 71.8, 5.2, 2.2), [], marker='⓯')
f('anleitung_pfk', 'Anleitung: Häufigkeit/Dauer durch Pflegefachkraft', 'checkbox', 'praxis', (69.7, 71.6, 3.0, 2.1), [], marker='❼')
f('unterstuetzung', 'Unterstützungspflege nach § 37 (1a) SGB V', 'checkbox', 'praxis', (9.2, 76.6, 3.0, 2.1), [rule('m12.unterstuetzungspflege'), rule('m12.unterstuetzung_angabe')], group='rahmen', marker='⓱')
f('khvermeidung', 'Krankenhausvermeidungspflege nach § 37 (1) SGB V', 'checkbox', 'praxis', (9.2, 79.5, 3.0, 2.1), [rule('m12.kh_vermeidung'), rule('m12.kh_vermeidung_angabe')], group='rahmen', marker='⓲')
for id_, label, y, rid in (('grundpflege', 'Grundpflege', 81.6, 'm12.grundpflege'), ('hauswirtschaft', 'hauswirtschaftliche Versorgung', 83.7, 'm12.hauswirtschaft')):
    f(id_, label, 'checkbox', 'praxis', (12.1, y, 3.0, 2.1), [rule(rid)], marker='⓳' if id_ == 'grundpflege' else '⓴')
    f(f'{id_}_pfk', f'{label}: Häufigkeit/Dauer durch Pflegefachkraft', 'checkbox', 'praxis', (69.7, y, 3.0, 2.1), [], marker='❼')
    f(f'{id_}_hf', f'{label}: Häufigkeit', 'text', 'praxis', (46.4, y, 10.9, 2.1), [], marker='❽')
    f(f'{id_}_dauer', f'{label}: Dauer (TTMM–TTMM)', 'text', 'praxis', (57.3, y, 11.8, 2.1), [], marker='❽')
f('hinweise', 'Weitere Hinweise', 'text', 'arzt', (9.1, 86.8, 63.6, 9.0), [], lines=4)
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (73.6, 83.7, 22.8, 12.0),
  [{'id': 'm12.stempel', 'text': 'Vertragsarztstempel und persönliche Unterschrift erst nach vollständigem Ausfüllen.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}])

doc = {
    'schema_version': '1.0.0', 'id': 'muster-12', 'muster': '12', 'title': 'Verordnung häuslicher Krankenpflege',
    'form_version': '7.2024', 'released': '2023-11-15', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'rot'},
    'copies': [
        {'id': '12a', 'label': 'Ausfertigung für die Krankenkasse', 'recipient': 'Krankenkasse (Genehmigung; Antrag des Versicherten auf der Rückseite)'},
        {'id': '12b', 'label': 'Ausfertigung für den Pflegedienst', 'recipient': 'Pflegedienst'},
        {'id': '12c', 'label': 'Ausfertigung für den Arzt', 'recipient': 'verbleibt in der Praxis'},
    ],
    'notes': [rule('m12.grundlage'), rule('m12.voraussetzung'), rule('m12.nicht_zulaessig'), rule('m12.genehmigung'), rule('m12.erst_folge'),
              rule('m12.blankoverordnung'), rule('m12.keine_blanko'), rule('m12.psychiatrisch'), rule('m12.behandlungspflege'),
              rule('m12.grundpflege_hauswirtschaft'), rule('m12.rueckseite'),
              {'id': 'm12.arbeitsunfall', 'text': 'Bei Arbeitsunfällen, Berufskrankheiten und Schülerunfällen dürfen nur e01, Muster 4 und Muster 16 verwendet werden – nicht Muster 12.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 9, S. 7'}},
              {'id': 'm12.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko, nicht mit roter Farbe.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}],
    'groups': [
        {'id': 'art', 'label': 'Erst- oder Folgeverordnung', 'select': 'genau_eins', 'rule': rule('m12.art', text='Erst- oder Folgeverordnung kennzeichnen; Folgeverordnungen innerhalb der letzten drei Arbeitstage vor Ablauf des verordneten Zeitraums ausstellen.', locator=R['m12.erst_folge']['locator'])},
        {'id': 'seite', 'label': 'Kompression: Seite', 'select': 'beliebig', 'rule': rule('m12.seite', artifact='mustersammlung', text='Bei Kompressionsbehandlung die Seite angeben (rechts, links, beidseits).', locator='PDF-Seite 23, Muster 12a (7.2024), Kompressionsbehandlung')},
        {'id': 'rahmen', 'label': 'Rahmen für Grundpflege/Hauswirtschaft', 'select': 'beliebig', 'rule': rule('m12.grundpflege_hauswirtschaft')},
    ],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-12.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
