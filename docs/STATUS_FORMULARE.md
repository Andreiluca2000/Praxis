# Status Formulare – 28.10.2026

| Bereich | Stand |
|---|---|
| Quellen KBV (Erläuterungen 01/2026, Vordruckvereinbarung 05/2026, Mustersammlung) | gespeichert mit SHA-256, Test prüft Hashes |
| Gesamtkatalog e01–86 (58 Einträge, 548 Regeln) | Entwurf, Stichprobe geprüft, fachliche Freigabe offen |
| Eigene Logik: Muster 2, 4, 6, 9, 10, 10A, 12, 13, 19, 20, 21, 26, 27, 52, 55, 61 (Teil A–E), 63, 64 (Teil A–B), 65. Allgemeine Ausfüllhilfe (generic.ts + weitere.ts): 3, 5, 7, 8, 8A, 11, 15, 16, 22, 25, 28, 36, 39, 50, 51, 53, 56, 62A–C, 70, 70A, 85, 86: Datenmodell, Vorschlag, Prüfung | fertig; Muster 13 mit Heilmittelkatalog (HeilM-RL, in Kraft 05.08.2025) |
| Oberfläche `ui/forms/` | in der App aktiv (Navigation „Formulare“); nachgebildeter Vordruck + Prüfliste; von Andree freigegeben 27.10.2026 |
| Lokales Ollama-Modell für die Beschreibung | nicht eingebaut (regelbasiert reicht für MVP) |
| Druck / Signatur / Übermittlung | bewusst nicht Teil des MVP |

Offene Punkte:
- Muster 12: Leistungsverzeichnis der HKP-Richtlinie (Spalte „Bemerkung“) ist noch nicht als Quelle hinterlegt – geprüft wird nach den KBV-Erläuterungen.
- Muster 61: Rehabilitations-Richtlinie (Anlage I Funktionstests, Anlage II geriatrietypische Diagnosen) noch nicht als Quelle hinterlegt.
- Fachliche Durchsicht der Regeln (Arzt) – besonders Muster 4 b) Pflegegrad 3 und Zuzahlung.
- Muster 10A: Zuordnung Stichwort → Untersuchung (z. B. „Blutbild“ ohne Zusatz → kleines Blutbild, „Leberwerte“ → GOT, GPT, GGT) ist eine Praxis-Annahme; Untersuchungen ohne eigenes Feld kommen unter „Sonstiges“ mit Angabe unter „Zusätzliche Angaben“ – ob das Labor das so annimmt, mit der Laborgemeinschaft klären.
- Muster 19: Abrechnung (Tag, Monat, GOP) wird bewusst nicht vorgeschlagen. Muster 63: Abschnitte ohne Stichwort (z. B. nach „Medikation:“) laufen bis zum nächsten Stichwort – am besten „Maßnahmen:“ davor schreiben. SAPV-Richtlinie selbst ist noch nicht als Quelle hinterlegt (nur die KBV-Erläuterungen).
- Daten (JSON, Geometrie, Generator) für 3, 5, 7, 8, 8A, 9, 11, 15, 16, 22, 25, 28, 36, 39, 50, 51, 53, 56, 62A–C, 65, 70, 70A, 85, 86 von der Audit-Sitzung; Logik, Tests und Einbindung von der Formulare-Sitzung.
- Allgemeine Ausfüllhilfe: Personalien aus DURIA, Stempel, Ausstellungsdatum, Abschnitte „Stichwort: …“, ICD mit Sicherheit, „genau eins“-Gruppen, Pflichtfelder je Vordruck und einige vordruckeigene Prüfungen. Fachregeln ausprogrammiert für Muster 16 (höchstens drei Verordnungen, kein BtM/T-Rezept, Arznei- und Hilfsmittel getrennt, keine Seh-/Hörhilfen, Dosierung, Gebühr, Unfall/Arbeitsunfall, Sonderkennzeichen), 39 (Alterskategorie ↔ Auftrag, Ja/Nein eindeutig, Erläuterungspflichten), 56 (Art, Sportart, Umfang nach Richtwerten, Wochenfrequenz, Herzgruppe, Folgeverordnung) und 62B (Potenzialerhebung höchstens 3 Monate, Erst- bis 5 Wochen, Folge- bis 6/12 Monate, nicht rückwirkend, bis 24 h, klinischer Status). Ebenso für Muster 15 (Ton-/Sprachaudiogramm als Voraussetzung, Tinnitus mit Frequenz und Verdeckbarkeit, Seite, Nachversorgung, Ohrbefund je Ohr, Zweckmäßigkeit), 62C (Ziele, Notfallmanagement, MRE, Angaben je Fachmaßnahme, Sauerstoff ≤ 24 h, Behandlungspflege), 8/8A (WHO-Stufe 1 ab 18, Folgeversorgung 0,5 dpt/+20 Prozentpunkte, Achse, Keratokonus, Visus/Vergrößerung, binokular) und 25 (Vorsorgeart, Klarschrift, Kennziffern, Befundlage, Kurort, Wartezeit). Ohne Fachregeln (nur allgemeine Prüfung): 3, 5, 7, 11, 22, 28, 36, 50, 51, 53, 62A, 70, 70A, 85, 86. Abrechnungsziffern werden nirgends vorgeschlagen.
- Offen aus der Audit-Sitzung: Schema kennt keinen Farbton „grün“ (8, 8A, 15, 36, 56 stehen auf „ohne“) und kein filled_by „krankenkasse“ (85/86 nutzen „leistungserbringer“).
- Muster 26: verordnen dürfen nur Fachärzte (Neurologie, Psychiatrie, Psychosomatik u. a.) und Psychotherapeuten – Hinweis in jeder Prüfung. Abschnitte mit Stichwort (z. B. „Prognose:“) laufen bis zum nächsten Stichwort.
- Muster 20: Stufen werden aus „ab TT.MM. x h“ bzw. „2 Wochen x h“ gelesen; Arbeitsunfall/BG-Fälle sind nicht gesondert geregelt.
- Vorbefüllen aus dem geöffneten Patienten: gebaut (Diagnosen mit G/V/A/Z, Karteieinträge, Pflegegrad u. a.; nur nach Bestätigung). Freigegebene Notizen der Sitzung sind noch nicht im Angebot; Behandlungstag = heute.
- Übergabe an DURIA (Vordruck dort vorbefüllen) – hängt von DURIA ab (GDT 6310 nur Karteitext; Formular-Schnittstelle unbekannt).
