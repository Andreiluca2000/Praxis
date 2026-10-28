# Status Formulare – 28.10.2026

| Bereich | Stand |
|---|---|
| Quellen KBV (Erläuterungen 01/2026, Vordruckvereinbarung 05/2026, Mustersammlung) | gespeichert mit SHA-256, Test prüft Hashes |
| Gesamtkatalog e01–86 (58 Einträge, 548 Regeln) | Entwurf, Stichprobe geprüft, fachliche Freigabe offen |
| Muster 6, 2, 4, 10, 10A, 13, 12, 61 (Teil A–E), 21, 20, 55, 19, 52, 63: Datenmodell, Vorschlag, Prüfung | fertig; Muster 13 mit Heilmittelkatalog (HeilM-RL, in Kraft 05.08.2025) |
| Oberfläche `ui/forms/` | in der App aktiv (Navigation „Formulare“); nachgebildeter Vordruck + Prüfliste; von Andree freigegeben 27.10.2026 |
| Lokales Ollama-Modell für die Beschreibung | nicht eingebaut (regelbasiert reicht für MVP) |
| Druck / Signatur / Übermittlung | bewusst nicht Teil des MVP |

Offene Punkte:
- Muster 12: Leistungsverzeichnis der HKP-Richtlinie (Spalte „Bemerkung“) ist noch nicht als Quelle hinterlegt – geprüft wird nach den KBV-Erläuterungen.
- Muster 61: Rehabilitations-Richtlinie (Anlage I Funktionstests, Anlage II geriatrietypische Diagnosen) noch nicht als Quelle hinterlegt.
- Fachliche Durchsicht der Regeln (Arzt) – besonders Muster 4 b) Pflegegrad 3 und Zuzahlung.
- Muster 10A: Zuordnung Stichwort → Untersuchung (z. B. „Blutbild“ ohne Zusatz → kleines Blutbild, „Leberwerte“ → GOT, GPT, GGT) ist eine Praxis-Annahme; Untersuchungen ohne eigenes Feld kommen unter „Sonstiges“ mit Angabe unter „Zusätzliche Angaben“ – ob das Labor das so annimmt, mit der Laborgemeinschaft klären.
- Muster 19: Abrechnung (Tag, Monat, GOP) wird bewusst nicht vorgeschlagen. Muster 63: Abschnitte ohne Stichwort (z. B. nach „Medikation:“) laufen bis zum nächsten Stichwort – am besten „Maßnahmen:“ davor schreiben. SAPV-Richtlinie selbst ist noch nicht als Quelle hinterlegt (nur die KBV-Erläuterungen).
- Muster 20: Stufen werden aus „ab TT.MM. x h“ bzw. „2 Wochen x h“ gelesen; Arbeitsunfall/BG-Fälle sind nicht gesondert geregelt.
- Vorbefüllen aus dem geöffneten Patienten: gebaut (Diagnosen mit G/V/A/Z, Karteieinträge, Pflegegrad u. a.; nur nach Bestätigung). Freigegebene Notizen der Sitzung sind noch nicht im Angebot; Behandlungstag = heute.
- Übergabe an DURIA (Vordruck dort vorbefüllen) – hängt von DURIA ab (GDT 6310 nur Karteitext; Formular-Schnittstelle unbekannt).
