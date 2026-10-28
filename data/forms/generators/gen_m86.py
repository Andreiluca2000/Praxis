"""Erzeugt data/forms/muster-86.json (Weiterleitungsbogen für angeforderte Informationen an den MD).
Regeln aus data/forms/catalog.json (KBV-Erläuterungen S. 146), Lage der Felder aus der Mustersammlung (Seite 105).
Der Bogen wird von der Krankenkasse vollständig vorausgefüllt; alle Felder sind Angaben der Krankenkasse (filled_by „leistungserbringer“ = nicht von der Praxis,
das Schema kennt keinen eigenen Wert für die Krankenkasse). Die Praxis legt nur die angeforderten Unterlagen in Kopie bei.
python data/forms/generators/gen_m86.py ."""
import json
import sys

root = sys.argv[1]
cat = json.load(open(f'{root}/data/forms/catalog.json', encoding='utf-8'))
R = {r['id']: r for e in cat['entries'] if e['muster'] == '86' for r in e['rules']}


def rule(rid, text=None, locator=None, artifact='erlaeuterungen'):
    r = R.get(rid, {})
    return {'id': rid, 'text': text or r['text'], 'source': {'artifact': artifact, 'locator': locator or r['locator']}}


fields = []
KASSE = [rule('m86.ausfuellen_kasse')]


def f(id_, label, kind, b, rules=KASSE, **kw):
    d = {'id': id_, 'label': label, 'kind': kind, 'filled_by': 'leistungserbringer'}
    d.update({k: v for k, v in kw.items() if v is not None})
    d['box'] = dict(zip('xywh', b))
    d['rules'] = list(rules)
    fields.append(d)


f('mima', 'Aktenzeichen Mitteilungsmanagement (MiMa)', 'text', (63.5, 13.8, 32.7, 2.2))
f('kk_adresse', 'Krankenkasse: Name der Krankenkasse, Straße, PLZ, Ort', 'text', (63.5, 19.0, 32.7, 8.5), lines=3)
f('leistungsbereich', 'Leistungsbereich', 'text', (63.5, 29.3, 32.7, 2.4))
f('ap_name', 'Ansprechpartner Krankenkasse: Vorname, Name', 'text', (63.6, 35.0, 32.6, 2.4))
f('ap_telefon', 'Ansprechpartner Krankenkasse: Telefon', 'text', (63.6, 37.8, 32.6, 2.5))
f('ap_fax', 'Ansprechpartner Krankenkasse: Fax', 'text', (63.6, 40.7, 32.6, 2.4))
f('ap_email', 'Ansprechpartner Krankenkasse: E-Mail', 'text', (63.6, 43.6, 32.6, 2.4))
f('v_name', 'Daten des Versicherten: Name, Vorname', 'text', (10.3, 59.4, 69.0, 2.3))
f('v_geburtsdatum', 'Daten des Versicherten: Geburtsdatum', 'date', (81.7, 59.9, 14.5, 1.8), format='TTMMJJ')
f('v_strasse', 'Daten des Versicherten: Straße', 'text', (10.3, 62.2, 85.9, 2.3))
f('v_plz', 'Daten des Versicherten: PLZ', 'text', (10.4, 65.6, 12.1, 1.8))
f('v_ort', 'Daten des Versicherten: Ort', 'text', (22.5, 65.6, 73.7, 1.8))
f('v_kv_nummer', 'Daten des Versicherten: KV-Nummer', 'text', (10.3, 67.9, 42.4, 2.3))
f('v_aktenzeichen', 'Daten des Versicherten: Aktenzeichen Krankenkasse', 'text', (10.3, 70.8, 42.4, 2.3))

doc = {
    'schema_version': '1.0.0', 'id': 'muster-86', 'muster': '86', 'title': 'Weiterleitungsbogen für angeforderte Informationen an den MD',
    'form_version': '5.2026', 'released': '2026-04-13', 'status': 'entwurf',
    'paper': {'format': 'DIN A4 hoch', 'width': 595.3, 'height': 841.9, 'tint': 'ohne'},
    'copies': [{'id': '86', 'label': 'Weiterleitungsbogen (von der Krankenkasse vorausgefüllt)', 'recipient': 'Medizinischer Dienst (MD), im Freiumschlag der Krankenkasse'}],
    'notes': [rule('m86.anlass'), rule('m86.ausfuellen_kasse'), rule('m86.beilage'), rule('m86.versand'), rule('m86.pflicht_bogen'), rule('m86.zusatzinfos')],
    'groups': [],
    'fields': fields,
}
json.dump(doc, open(f'{root}/data/forms/muster-86.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(fields), 'Felder')
