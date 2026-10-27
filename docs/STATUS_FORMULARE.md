# Status Formulare – 27.10.2026

| Bereich | Stand |
|---|---|
| Quellen KBV (Erläuterungen 01/2026, Vordruckvereinbarung 05/2026, Mustersammlung) | gespeichert mit SHA-256, Test prüft Hashes |
| Gesamtkatalog e01–86 (58 Einträge, 548 Regeln) | Entwurf, Stichprobe geprüft, fachliche Freigabe offen |
| Muster 6, 2, 4: Datenmodell, Vorschlag, Prüfung | fertig als Logik, 41 Tests grün |
| Oberfläche `ui/forms/` | in der App aktiv (Navigation „Formulare“); nachgebildeter Vordruck + Prüfliste; von Andree freigegeben 27.10.2026 |
| Lokales Ollama-Modell für die Beschreibung | nicht eingebaut (regelbasiert reicht für MVP) |
| Druck / Signatur / Übermittlung | bewusst nicht Teil des MVP |

Offene Punkte:
- Fachliche Durchsicht der Regeln (Arzt) – besonders Muster 4 b) Pflegegrad 3 und Zuzahlung.
- Vorbefüllen aus dem geöffneten Patienten (DURIA-Export: Diagnosen mit Sicherheit, Befundtext) – noch nicht gebaut.
- Übergabe an DURIA (Vordruck dort vorbefüllen) – hängt von DURIA ab (GDT 6310 nur Karteitext; Formular-Schnittstelle unbekannt).
