"""Erzeugt data/forms/muster-56.json (Antrag auf Kostenübernahme für Rehabilitationssport / Funktionstraining).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 95–101), Lage der Felder aus der Mustersammlung (Seiten 67–68).
python data/forms/generators/gen_m56.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '56' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 56 (1.2023)'}}


fields = []
CB = (3.0, 2.1)


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


# Vorderseite (Mustersammlung S. 67)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, geb. am, Versicherten-Nr., BSNR, LANR, Datum)', 'personalien', 'duria',
  (4.4, 1.7, 38.0, 15.7), [ms('m56.personalien', 'Personalien über das Praxisverwaltungssystem (eGK).', 'PDF-Seite 67')])
cb('reha_sport', 'für Rehabilitationssport', 44.9, 5.3, [rule('m56.auswahl')], group='art', marker='❶')
cb('funktionstraining', 'für Funktionstraining', 44.9, 9.6, group='art', marker='❶')
f('diagnose1', 'verordnungsrelevante Diagnose(n), gegebenenfalls relevante Nebendiagnose', 'text', 'arzt', (9.1, 22.5, 72.0, 2.1), [rule('m56.diagnosen')], marker='❷')
f('diagnose2', 'verordnungsrelevante Diagnose(n), 2. Zeile', 'text', 'arzt', (9.1, 25.3, 72.0, 2.1), marker='❷')
f('icd1', 'Diagnoseschlüssel ICD-10-GM', 'text', 'arzt', (82.9, 22.5, 13.3, 2.1), [rule('m56.diagnosen')], marker='❷')
f('icd2', 'Diagnoseschlüssel ICD-10-GM, 2. Zeile', 'text', 'arzt', (82.9, 25.3, 13.3, 2.1), marker='❷')
f('schaedigung', 'Schädigung der Körperfunktionen und Körperstrukturen für die verordnungsrelevante(n) Beeinträchtigung(en) der Aktivität(en) und Teilhabe', 'text', 'arzt',
  (9.1, 31.0, 87.1, 2.1), [rule('m56.funktionsdiagnose')], marker='❸')
f('ziel', 'Ziel des Rehabilitationssports/Funktionstrainings', 'text', 'arzt', (9.1, 35.3, 87.1, 2.1), [rule('m56.ziel')], marker='❹')
cb('teilhabebedarf', 'erhöhter Teilhabebedarf für schwerstbehinderte Menschen (z. B. Blindheit, Doppelamputation oder Hirnverletzung)', 9.2, 38.1, [rule('m56.teilhabebedarf')], marker='❺')
for id_, label, x, y in [('sport_gymnastik', 'Gymnastik (auch im Wasser)', 9.2, 43.8), ('sport_schwimmen', 'Schwimmen', 28.6, 43.8),
                         ('sport_ausdauer', 'Ausdauer- und Kraftausdauerübungen', 44.2, 43.8), ('sport_bewegungsspiele', 'Bewegungsspiele', 9.2, 46.7),
                         ('sport_sonstige', 'Sonstige', 28.6, 46.7)]:
    cb(id_, label, x, y, [rule('m56.sportart')] if id_ == 'sport_gymnastik' else [], group='sportart', marker='❻')
f('sport_sonstige_text', 'Sonstige Rehabilitationssportart', 'text', 'arzt', (38.8, 46.7, 26.0, 2.1), [rule('m56.sportart')], marker='❻')
cb('selbstbewusstsein', 'Übungen zur Stärkung des Selbstbewusstseins behinderter oder von Behinderung bedrohter Frauen und Mädchen erforderlich', 9.2, 49.5,
   [rule('m56.selbstbewusstsein')], group='sportart', marker='❻')
cb('ft_trocken', 'Trockengymnastik', 67.2, 43.8, [rule('m56.funktionstrainingsart')], group='funktionsart', marker='❾')
cb('ft_wasser', 'Wassergymnastik', 67.2, 46.7, group='funktionsart', marker='❾')
cb('sport_50', 'Rehabilitationssport: 50 Übungseinheiten in 18 Monaten (Richtwerte)', 9.2, 53.8, [rule('m56.uebungseinheiten')], group='sport_umfang', marker='❼')
cb('sport_120', 'Rehabilitationssport: 120 Übungseinheiten in 36 Monaten (Richtwerte) bei den genannten Krankheiten mit schweren Beeinträchtigungen', 9.2, 56.7,
   [rule('m56.uebungseinheiten')], group='sport_umfang', marker='❼')
cb('sport_vergleichbar', 'andere vergl. Krankheit(en) (vgl. Diagnose/Nebendiagnose)', 40.7, 79.5, [rule('m56.vergleichbare_krankheit')], marker='❼')
cb('sport_28', '28 Übungseinheiten (Richtwert) zur Stärkung des Selbstbewusstseins behinderter oder von Behinderung bedrohter Frauen und Mädchen', 9.2, 82.3,
   [rule('m56.selbstbewusstsein')], group='sport_umfang', marker='❼')
cb('sport_laenger', 'Längere Leistungsdauer Rehabilitationssport: 120 Übungseinheiten in 36 Monaten (Richtwerte) bei kognitiven oder psychischen Beeinträchtigungen', 9.2, 88.0,
   [rule('m56.laengere_dauer_sport')], group='sport_umfang', marker='❽')
cb('ft_12', 'Funktionstraining: 12 Monate (Richtwert)', 67.2, 53.8, [rule('m56.funktionstraining_dauer')], group='ft_dauer', marker='❿')
cb('ft_24', 'Funktionstraining: 24 Monate (Richtwert) nur bei den genannten chronischen Krankheiten mit schwerer Beeinträchtigung der Beweglichkeit/Mobilität', 67.2, 56.7,
   [rule('m56.funktionstraining_dauer')], group='ft_dauer', marker='❿')
cb('ft_laenger', 'Längere Leistungsdauer Funktionstraining: 24 Monate (Richtwert) bei kognitiven oder psychischen Beeinträchtigungen', 67.2, 88.0,
   [rule('m56.laengere_dauer_funktion')], group='ft_dauer', marker='⓫')
cb('folgeverordnung', 'Folgeverordnung mit Begründung, warum erlernte Übungen nicht oder noch nicht selbstständig durchgeführt werden können', 9.2, 90.9,
   [rule('m56.folge_sport'), rule('m56.folge_funktion')], marker='⓬')
f('folge_begruendung', 'Begründung der Folgeverordnung', 'text', 'arzt', (12.7, 93.7, 83.5, 2.1), [rule('m56.folge_sport')], marker='⓬')

# Rückseite (Mustersammlung S. 68)
cb('herzgruppe', 'Herzgruppe', 32.1, 5.3, [rule('m56.herzgruppe')], page=1, group='herzform', marker='⓭')
cb('herzinsuffizienzgruppe', 'Herzinsuffizienzgruppe (bei hohem kardiovaskulären Ereignisrisiko)', 45.5, 5.3, page=1, group='herzform', marker='⓭')
cb('herz_erst', 'Erstverordnung 90 Übungseinheiten in 24 Monaten (Richtwerte)', 4.4, 8.2, [rule('m56.herzgruppe_umfang')], page=1, group='herz_umfang', marker='⓮')
cb('herz_folge', 'Folgeverordnung 45 Übungseinheiten in 12 Monaten (Richtwerte)', 4.4, 11.0, [rule('m56.herzgruppe_umfang')], page=1, group='herz_umfang', marker='⓯')
cb('herz_folge_watt', 'nur bei Belastungsgrenze < 1,4 Watt/kg Körpergewicht', 7.9, 13.2, page=1, marker='⓯')
cb('herz_folge_kognitiv', 'wenn bei kognitiven oder psychischen Beeinträchtigungen die langfristige Durchführung des Übungsprogramms in Eigenverantwortung nicht oder noch nicht möglich ist',
   7.9, 15.3, page=1, marker='⓯')
cb('herz_kinder', 'Kinderherzgruppen 120 Übungseinheiten in 24 Monaten (Richtwerte)', 4.4, 18.2, page=1, group='herz_umfang', marker='⓯')
for prefix, label, y, xs in [('woche_sport', 'Rehabilitationssport', 25.3, (4.4, 11.6, 18.8)),
                             ('woche_trocken', 'Funktionstraining als Trockengymnastik', 23.9, (44.9, 52.1, 59.3)),
                             ('woche_wasser', 'Funktionstraining als Wassergymnastik', 26.7, (44.9, 52.1, 59.3))]:
    for n, x in zip((1, 2, 3), xs):
        cb(f'{prefix}_{n}', f'{label}: {n}x wöchentlich', x, y, [rule('m56.wochenfrequenz')] if (prefix, n) == ('woche_sport', 1) else [],
           page=1, group=prefix, marker='⓰')
f('woche_begruendung', 'Begründung bei insgesamt 3x', 'text', 'arzt', (4.3, 31.0, 62.9, 5.0), [rule('m56.wochenfrequenz')], page=1, marker='⓰', lines=2)
f('abweichung', 'Abweichung von oben genannten Richtwerten: Übungseinheiten bei Rehabilitationssport / Monate bei Funktionstraining', 'number', 'arzt',
  (4.4, 38.1, 7.1, 2.1), [rule('m56.abweichung')], page=1, marker='⓱')
f('datum', 'Datum', 'date', 'praxis', (52.7, 42.4, 14.4, 2.1),
  [ms('m56.datum', 'Ausstellungsdatum der ärztlichen Verordnung.', 'PDF-Seite 68')], page=1, format='TTMMJJ')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (68.6, 32.5, 22.7, 12.0),
  [{'id': 'm56.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.', 'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}],
  page=1)
f('leistungserbringer', 'Rehabilitationssport/Funktionstraining soll bei folgendem Leistungserbringer durchgeführt werden (Verein, Träger usw., Postleitzahl, Ort)', 'text', 'versicherter',
  (4.3, 52.4, 87.1, 2.1), [rule('m56.antrag_versicherter')], page=1, marker='⓲')
f('teilnahme_bisher', 'Ich nehme am Rehabilitationssport/Funktionstraining bereits teil seit', 'checkbox', 'versicherter', (4.4, 55.2) + CB, [rule('m56.antrag_versicherter')], page=1, marker='⓲')
f('teilnahme_seit', 'bereits teil seit (Monat/Jahr)', 'date', 'versicherter', (37.0, 55.3, 9.5, 2.1), page=1, format='MMJJ', marker='⓲')
f('unterschrift_versicherter', 'Datum / Unterschrift des Versicherten', 'text', 'versicherter', (52.7, 55.3, 38.6, 4.9), [rule('m56.antrag_versicherter')], page=1, marker='⓲')

groups = [
    {'id': 'art', 'label': 'Rehabilitationssport oder Funktionstraining', 'select': 'genau_eins', 'rule': rule('m56.auswahl')},
    {'id': 'sportart', 'label': 'Empfohlene Rehabilitationssportart (nur eine)', 'select': 'beliebig', 'rule': rule('m56.sportart')},
    {'id': 'funktionsart', 'label': 'Empfohlene Funktionstrainingsarten (Trocken- und/oder Wassergymnastik)', 'select': 'beliebig', 'rule': rule('m56.funktionstrainingsart')},
    {'id': 'sport_umfang', 'label': 'Rehabilitationssport ist notwendig für (Richtwerte)', 'select': 'beliebig', 'rule': rule('m56.uebungseinheiten')},
    {'id': 'ft_dauer', 'label': 'Funktionstraining ist notwendig für (Richtwert)', 'select': 'beliebig', 'rule': rule('m56.funktionstraining_dauer')},
    {'id': 'herzform', 'label': 'Herzgruppe oder Herzinsuffizienzgruppe', 'select': 'beliebig', 'rule': rule('m56.herzgruppe')},
    {'id': 'herz_umfang', 'label': 'Umfang Herzgruppe (Richtwerte)', 'select': 'beliebig', 'rule': rule('m56.herzgruppe_umfang')},
    {'id': 'woche_sport', 'label': 'Wöchentliche Übungseinheiten Rehabilitationssport', 'select': 'beliebig', 'rule': rule('m56.wochenfrequenz')},
    {'id': 'woche_trocken', 'label': 'Wöchentliche Übungseinheiten Trockengymnastik', 'select': 'beliebig', 'rule': rule('m56.wochenfrequenz')},
    {'id': 'woche_wasser', 'label': 'Wöchentliche Übungseinheiten Wassergymnastik', 'select': 'beliebig', 'rule': rule('m56.wochenfrequenz')},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-56', 'muster': '56', 'title': 'Antrag auf Kostenübernahme für Rehabilitationssport / für Funktionstraining',
    'form_version': '1.2023', 'released': '2022-09-09', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch, Vorder- und Rückseite', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'pages': ['Vorderseite', 'Rückseite'],
    'copies': [{'id': '56', 'label': 'Verordnung mit Antrag', 'recipient': 'Krankenkasse (über die Versicherte/den Versicherten, vor Beginn)'}],
    'notes': [rule('m56.genehmigung'), rule('m56.rahmenvereinbarung'),
              ms('m56.ebm_01621', 'Für die ärztliche Verordnung ist die Nr. 01621 EBM berechnungsfähig (Hinweis auf dem Vordruck).', 'PDF-Seite 68'),
              ms('m56.kasse', 'Die Kostenübernahmeerklärung auf der Rückseite füllt die Krankenkasse aus, nicht die Praxis.', 'PDF-Seite 68')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-56.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
