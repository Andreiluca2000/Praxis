"""Ankreuzfelder und Schreibflächen einer Mustersammlung-Seite mit der nächstliegenden Beschriftung (Entwurfshilfe).
python boxes.py <pdf> <seite>"""
import sys

import pymupdf as fitz

page = fitz.open(sys.argv[1])[int(sys.argv[2]) - 1]
W, H = page.rect.width, page.rect.height
pc = lambda x, y, w, h: (round(x / W * 100, 1), round(y / H * 100, 1), round(w / W * 100, 1), round(h / H * 100, 1))
labels = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        if l['dir'][1] != 0:
            continue
        t = ' '.join(s['text'] for s in l['spans']).strip()
        if t and 'Verbindliches' not in t:
            labels.append((l['bbox'], t))

boxes = set()
for d in page.get_drawings():
    for it in d['items']:
        if it[0] == 're':
            r = it[1]
            if 8 <= r.width <= 22 and 8 <= r.height <= 22 and abs(r.width - r.height) < 3:
                boxes.add((round(r.x0), round(r.y0), round(r.width), round(r.height)))
# Dubletten (Füllung + Rahmen) zusammenfassen
uniq = []
for b in sorted(boxes, key=lambda b: (b[1], b[0])):
    if not any(abs(b[0] - u[0]) <= 2 and abs(b[1] - u[1]) <= 2 for u in uniq):
        uniq.append(b)

def right_label(x, y, w, h):
    best = None
    for (x0, y0, x1, y1), t in labels:
        if x0 >= x + w - 1 and y0 < y + h + 2 and y1 > y - 2 and x0 - (x + w) < 120:
            if best is None or x0 < best[0]:
                best = (x0, t)
    return best[1] if best else ''

print('CHECKBOXES (x y w h %) label')
for x, y, w, h in uniq:
    print(pc(x, y, w, h), '|', right_label(x, y, w, h))
print('\nLABELS (x y %)')
for (x0, y0, x1, y1), t in sorted(labels, key=lambda l: (round(l[0][1]), l[0][0])):
    print(pc(x0, y0, x1 - x0, y1 - y0), '|', t)
