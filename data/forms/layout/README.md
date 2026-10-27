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

Seiten: 11 = Muster 6, 3 = Muster 2b (enthält alle Felder; 2a ist der obere Teil), 8 = Muster 4.
