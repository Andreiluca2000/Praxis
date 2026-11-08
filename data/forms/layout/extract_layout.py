"""Geometrie eines KBV-Vordrucks (Linien, Schreibflächen, Beschriftungen) aus der Mustersammlung als JSON.
Aufruf: python extract_layout.py <mustersammlung.pdf> <seite> <muster-id> <out.json>"""
import json
import math
import sys

import pymupdf as fitz

pdf, page_no, form_id, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
page = fitz.open(pdf)[page_no - 1]
W, H = page.rect.width, page.rect.height
r2 = lambda v: round(v, 2)
hexc = lambda c: '#%02x%02x%02x' % tuple(int(round(x * 255)) for x in c)

tint = None
bands, whites, strokes, fills = [], [], [], []
for d in page.get_drawings():
    fill, color = d.get('fill'), d.get('color')
    if d['type'] == 'f' and fill and min(fill) > .7 and max(fill) - min(fill) > .05 and d['rect'].width > W * .9:
        tint = tint or hexc(fill)
        r = d['rect']
        bands.append([r2(r.x0), r2(r.y0), r2(r.width), r2(r.height)])
        continue
    if d['type'] == 's' and color and max(color) < .1 and (d.get('width') or 0) > 3:
        continue  # schwarze Lesemarken am Rand (Belegleser), nicht Teil des Vordrucks
    for it in d['items']:
        if it[0] == 're':
            r = it[1]
            box = [r2(r.x0), r2(r.y0), r2(r.width), r2(r.height)]
            if d['type'] in ('f', 'fs') and fill and min(fill) > .99:
                whites.append(box)
            if d['type'] in ('s', 'fs') and color:
                strokes.append({'rect': box, 'w': r2(d.get('width') or .5)})
            elif d['type'] == 'f' and fill and max(fill) > .7 and (min(fill) < .5 or max(fill) - min(fill) > .3):
                fills.append(box + [hexc(fill)])  # farbige Flächen (Titelbalken, Spalte „Pflegefachkraft“) mit ihrer Farbe
        elif it[0] == 'l' and d['type'] in ('s', 'fs') and color:
            a, b = it[1], it[2]
            strokes.append({'line': [r2(a.x), r2(a.y), r2(b.x), r2(b.y)], 'w': r2(d.get('width') or .5)})

# Ankreuz-Ovale aus einer Symbolschrift (Muster 10A, Glyphe „f“) als abgerundete Rahmen
OVAL_FONTS = ('Rieco13',)
for b in page.get_text('rawdict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            if s['font'] in OVAL_FONTS:
                for c in s['chars']:
                    if c['c'] == 'f':
                        x0, x1, base = c['bbox'][0], c['bbox'][2], c['origin'][1]
                        strokes.append({'rect': [r2(x0 + .8), r2(base - 4.6), r2(x1 - x0 - 1.6), 4.6], 'w': .6, 'r': 2.3})

# Symbolschrift der KBV (Muster 70/70A): Steuerzeichen stehen für ♀ und ♂
SYMBOLS = {'Universal-NewswithCommPi': {'': '♀', '': '♂'}}
CONTROL = ''.join(chr(i) for i in range(32))

labels = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        dx, dy = l['dir']
        turned = abs(dy) > 0.01
        for s in l['spans']:
            sym = SYMBOLS.get(s['font'], {})
            t = ''.join(sym.get(c, c) for c in s['text']).translate({ord(c): None for c in CONTROL}).strip()
            if not t or s['font'] in OVAL_FONTS or t.startswith('Freigabe') or 'Verbindliches' in t or t == 'Muster':
                continue
            if turned and t.replace(' ', '').isdigit() and len(t) > 6:
                continue  # Druckerei-Ziffernfolgen am Rand (Muster 19a, 22)
            rgb = ((s['color'] >> 16) & 255, (s['color'] >> 8) & 255, s['color'] & 255)
            white = min(rgb) >= 250  # weiße Schrift auf farbigem Balken („Behandlungspflege“)
            ghost = min(rgb) > 180 and not white  # sehr helle Platzhalter („T T M M J J“)
            dark = max(rgb) < 90
            label = {'t': t, 'x': r2(s['origin'][0]), 'y': r2(s['origin'][1]), 's': r2(s['size']),
                     'b': 'Bold' in s['font'], 'i': 'Italic' in s['font'] or 'Oblique' in s['font'], 'ghost': ghost,
                     'dark': dark, 'white': white}
            if turned:
                label['r'] = r2(math.degrees(math.atan2(dy, dx)))  # gedrehte Beschriftung (Achsen, Spaltenköpfe)
            if sym:
                label['c'] = hexc([v / 255 for v in rgb])  # ♀/♂ in ihrer eigenen Farbe
            labels.append(label)

json.dump({'form': form_id, 'width': r2(W), 'height': r2(H), 'tint': tint, 'bands': bands, 'whites': whites,
           'strokes': strokes, 'fills': fills, 'labels': labels}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(form_id, 'tint', tint, 'whites', len(whites), 'strokes', len(strokes), 'fills', len(fills), 'labels', len(labels))
