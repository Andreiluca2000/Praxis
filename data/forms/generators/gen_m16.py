"""Erzeugt data/forms/muster-16.json (Arzneiverordnungsblatt).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 57–61), Lage der Felder aus der Mustersammlung (Seite 31 = Vorderseite, Seite 32 = Rückseite).
python data/forms/generators/gen_m16.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '16' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


def ms(rid, text, where):
    return {'id': rid, 'text': text, 'source': {'artifact': 'mustersammlung', 'locator': f'{where}, Muster 16 (10.2014)'}}


fields = []
CB = (3.3, 4.6)


def f(id_, label, kind, filled_by, b, rules=(), page=0, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': filled_by}
    d.update({k: v for k, v in kw.items() if v is not None})
    if page:
        d['page'] = page
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


def cb(id_, label, x, y, rules=(), **kw):
    f(id_, label, 'checkbox', 'arzt', (x, y) + CB, rules, **kw)


# Vorderseite (Mustersammlung S. 31)
f('personalien', 'Personalienfeld (Krankenkasse bzw. Kostenträger, Name, Vorname, geb. am, Kostenträgerkennung, Versicherten-Nr., Status, Betriebsstätten-Nr., Arzt-Nr., Datum)',
  'personalien', 'duria', (6.2, 4.9, 53.9, 44.5), [rule('m16.betriebsstaette')])
cb('gebuehr_frei', 'Gebühr frei', 2.1, 8.2, [rule('m16.gebuehr')], group='gebuehr', marker='❷')
cb('geb_pfl', 'Geb.-pfl.', 2.1, 14.3, group='gebuehr', marker='❷')
cb('noctu', 'noctu', 2.1, 20.4, [rule('m16.noctu')], marker='❸')
cb('sonstige', 'Sonstige', 2.1, 28.5, [rule('m16.sonstige')], marker='❹')
cb('unfall', 'Unfall', 2.1, 36.6, [rule('m16.unfall')], group='unfallart', marker='❺')
cb('arbeitsunfall', 'Arbeitsunfall', 2.1, 44.7, group='unfallart', marker='❺')
f('unfalltag', 'Unfalltag', 'text', 'arzt', (2.1, 90.0, 13.4, 6.7), [rule('m16.unfall')], marker='❺')
f('unfallbetrieb', 'Unfallbetrieb oder Arbeitgebernummer', 'text', 'arzt', (15.5, 90.0, 32.3, 6.7), [rule('m16.unfall')], marker='❺')
CELL = 3.3
for id_, label, x, rid in [('sk_bvg', 'BVG (Feld 6)', 61.6, 'm16.ser'),
                           ('sk_hilfsmittel', 'Hilfsmittel (Feld 7)', 64.9, 'm16.sonderkennzeichen'),
                           ('sk_impfstoff', 'Impfstoff (Feld 8)', 68.2, 'm16.sonderkennzeichen'),
                           ('sk_spr_st_bedarf', 'Spr.-St.-Bedarf (Feld 9)', 71.6, 'm16.sonderkennzeichen')]:
    f(id_, label, 'number', 'arzt', (x, 8.7, CELL, 5.4), [rule(rid)], marker='❻' if id_ == 'sk_bvg' else '❼')
VERORDNUNG = [('verordnung_1', '1. Verordnung', 54.0, 'aut_idem_1', 56.8),
              ('verordnung_2', '2. Verordnung', 62.0, 'aut_idem_2', 64.9),
              ('verordnung_3', '3. Verordnung', 70.0, 'aut_idem_3', 73.0)]
for i, (vid, label, y, aid, ay) in enumerate(VERORDNUNG):
    rules = [rule('m16.anzahl'), rule('m16.dosierung'), rule('m16.dosierung_kennzeichnung'), rule('m16.diga')] if i == 0 else []
    if i == 2:
        rules = [rule('m16.faelschungssicher')]
    f(vid, f'Rp. (Bitte Leerräume durchstreichen): {label}', 'text', 'arzt', (8.0, y, 52.5, 7.9), rules, lines=2,
      marker='⓬' if i == 0 else None)
    cb(aid, f'aut idem ({label})', 2.1, ay, [rule('m16.aut_idem')] if i == 0 else [], marker='❿')
f('stempel', 'Vertragsarztstempel / Unterschrift des Arztes', 'stempel', 'arzt', (61.8, 53.4, 34.4, 24.8),
  [rule('m16.stempel'),
   {'id': 'm16.unterschrift', 'text': 'Erst vollständig ausfüllen, dann mit Vertragsarztstempel persönlich unterschreiben – nie blanko.',
    'source': {'artifact': 'erlaeuterungen', 'locator': 'Allgemeines Nr. 2 und Nr. 5, S. 5'}}], marker='⓯')

groups = [
    {'id': 'gebuehr', 'label': 'Gebühr frei oder gebührenpflichtig', 'select': 'beliebig', 'rule': rule('m16.gebuehr')},
    {'id': 'unfallart', 'label': 'Unfall oder Arbeitsunfall', 'select': 'beliebig', 'rule': rule('m16.unfall')},
]
doc = {
    'schema_version': '1.0.0', 'id': 'muster-16', 'muster': '16', 'title': 'Arzneiverordnungsblatt',
    'form_version': '10.2014', 'released': '2014-09-01', 'status': 'entwurf',
    'paper': {'format': 'DIN A6 quer, Vorder- und Rückseite', 'width': 419.5, 'height': 297.6, 'tint': 'rot'},
    'copies': [{'id': '16', 'label': 'Arzneiverordnungsblatt', 'recipient': 'Apotheke bzw. Lieferant (über die Versicherte/den Versicherten); Abrechnung mit der Krankenkasse'}],
    'notes': [rule('m16.diga_psychotherapeuten'), rule('m16.rezeptur'), rule('m16.rezeptur_menge'), rule('m16.aenderungen'),
              rule('m16.betaeubungsmittel'), rule('m16.t_rezept'), rule('m16.privatrezept'),
              rule('m16.kuenstliche_befruchtung'), rule('m16.ersatzverordnung'),
              rule('m16.begruendungspflicht'), rule('m16.abrechnungsfelder'), rule('m16.erezept_ausdruck'),
              ms('m16.abgabedatum', 'Das Feld „Abgabedatum in der Apotheke“ füllt die abgebende Apotheke aus, nicht die Praxis.', 'PDF-Seite 31'),
              ms('m16.rueckseite', 'Die Rückseite (Empfangsbestätigung für Hilfsmittel, Vermerke der Krankenkasse, Stempel der Apotheke / des Lieferanten) füllen Empfänger, Krankenkasse bzw. Apotheke/Lieferant aus, nicht die Praxis; sie ist hier nicht abgebildet.', 'PDF-Seite 32')],
    'groups': groups,
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-16.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder', len(groups), 'Gruppen')
