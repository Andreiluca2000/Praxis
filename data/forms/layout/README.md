# Geometrie der Vordrucke (Vorschau)

`muster-06.json`, `muster-02.json`, `muster-04.json`: Linien, Schreibflächen, Farbfläche und Beschriftungen der Vordrucke
in PDF-Punkten, abgeleitet aus der KBV-Mustersammlung (Stand 05/2026, `../sources/kbv-mustersammlung-2026-05.pdf`,
SHA-256 im Manifest). Ohne Wasserzeichen „Verbindliches Muster“, Freigabevermerk und Druckerei-Angabe.

Nur für die schematische Vorschau in `ui/forms/ScheinSvg.tsx` – **keine Druckvorlage** (Bedrucken von Blankopapier
erfordert die BFB-Zertifizierung nach Anlage 2a BMV-Ä).

Neu erzeugen (PyMuPDF):

    python data/forms/layout/extract_layout.py data/forms/sources/kbv-mustersammlung-2026-05.pdf 11 muster-06 data/forms/layout/muster-06.json
    python data/forms/layout/extract_layout.py data/forms/sources/kbv-mustersammlung-2026-05.pdf 3 muster-02 data/forms/layout/muster-02.json
    python data/forms/layout/extract_layout.py data/forms/sources/kbv-mustersammlung-2026-05.pdf 8 muster-04 data/forms/layout/muster-04.json

Seiten: 11 = Muster 6, 3 = Muster 2b (enthält alle Felder; 2a ist der obere Teil), 8 = Muster 4, 20 = Muster 10,
21 = Muster 10A, 23 = Muster 12a, 27 = Muster 13, 40 = Muster 21, 69/71/73/75/77 = Muster 61 Teil A–E (eine Datei mit `pages`).

Leicht schräg gesetzte Schrift (Drehung < 0,6°, z. B. Titel) wird übernommen; die Ankreuz-Ovale von Muster 10A
(Symbolschrift) werden als abgerundete Rahmen (`r`) abgelegt.
