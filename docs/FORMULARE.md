# Formulare (KBV-Vordrucke) – Ausfüllhilfe

Stand 27.10.2026. Arbeitsbereich „Formulare“: Die Ärztin/MFA beschreibt in eigenen Worten, was ausgestellt werden soll **und** was mit dem Patienten ist (z. B. „Überweisung zum Kardiologen wegen Belastungsdyspnoe, dringend. Pflegegrad 4, Rollstuhl.“). Die App

1. erkennt die Lage des Patienten (Pflegegrad, Merkzeichen, Rollstuhl/liegend, Dialyse/Chemo, Notfall, Unfall/Arbeitsunfall, SER, Reha, AU bis …),
2. schlägt passende Vordrucke vor – gewünschte und zusätzlich passende (z. B. Pflegegrad 4 → Taxi zur ambulanten Behandlung genehmigungsfrei, Muster 4 b),
3. füllt den Vordruck als Vorschlag vor (bestätigen / ergänzen / nur Arzt / aus DURIA / leer) – jede Angabe mit Grund und Fundstelle,
4. prüft den Vordruck – auch jede Änderung von Hand – und meldet „so nicht möglich“, „fehlt“ oder „Hinweis“, jeweils mit Regel und Quelle.

Nichts wird gedruckt, signiert oder übermittelt. Nur regelbasiert und lokal; kein externer Dienst.

## Grenzen (bewusst)

- **Keine Druckvorlage.** Vordrucke dürfen nur von der KV/autorisierten Stellen bezogen werden; Bedrucken von Blankopapier braucht die BFB-Zertifizierung (Anlage 2a BMV-Ä). Die Vorschau ist eine schematische Nachbildung.
- **Nichts erfinden.** Diagnose nur wörtlich aus der Beschreibung und immer vom Arzt zu bestätigen; ICD nur mit ausdrücklicher Sicherheit G/V/A/Z. Was nicht dasteht, bleibt „bitte ergänzen“.
- **Datenschutz (DS-01).** Name/Anschrift sind im Fenster nicht vorhanden; Personalien erscheinen als „aus DURIA“.
- **Nachweise** (Pflegegrad-Bescheid, Schwerbehindertenausweis, Zuzahlungsbefreiung) prüft die Praxis.

## Quellen (data/forms/sources.manifest.json, mit SHA-256)

| Artefakt | Stand | Inhalt |
|---|---|---|
| KBV Erläuterungen zur Vordruckvereinbarung | Januar 2026 (in Kraft 01.01.2026) | Ausfüllhinweise für alle Vordrucke |
| Vordruckvereinbarung (Anlage 2 BMV-Ä) | Mai 2026 (in Kraft 01.05.2026) | Stand, Format, Ausfertigungen je Muster |
| Mustersammlung | Mai 2026 | Feldbeschriftungen; Lage der Felder |
| KBV-Übersichtsseite Rechtsquellen BMV | abgerufen 27.10.2026 | Vertragsdatum/Inkrafttreten |
| G-BA Heilmittel-Richtlinie mit Heilmittelkatalog | geändert 15.05.2025, in Kraft 05.08.2025 | Diagnosegruppen, Leitsymptomatik, Heilmittel, Höchstmengen (Muster 13) |

Rechte: KBV-Inhalte sind geschützt; Zitieren mit Quellenangabe ist erlaubt. Regeln sind daher kurze sinngemäße Wiedergaben mit Fundstelle; Weitergabe der PDFs an Dritte ist nicht freigegeben.

## Dateien

- `data/forms/muster-06.json`, `muster-02.json`, `muster-04.json`, `muster-10.json`, `muster-13.json`, `muster-12.json`, `muster-61.json` (Teil A–E, mehrseitig) – ausfüllbare Vordrucke: Felder, Ankreuzgruppen, Lage (Prozent), Regeln mit Fundstelle (`schemas/forms-muster.schema.json`).
- `data/forms/catalog.json` – **alle** Vordrucke (e01 bis Muster 86, 58 Einträge, 548 Regeln) mit Zweck, Stichwörtern, „stattdessen Muster X“ und Ausfüllregeln (`schemas/forms-catalog.schema.json`). Halbautomatisch aus den Erläuterungen erstellt, stichprobenartig gegen die Quelle geprüft; fachliche Freigabe steht aus.
- `src/forms/` – `facts.ts` (Lage des Patienten), `advisor.ts` (Einstieg: `analyse`, `propose`, `check`), `muster0X.ts` (Vorschlag + Prüfung je Vordruck), `katalog.ts` (Suche im Gesamtkatalog), `text.ts` (Unicode-sichere Texthelfer).
- Tests: `tests/forms.test.ts` (synthetische Fälle), `tests/forms-data.test.ts` (Schema, Kennungen, SHA-256 der Quellen).

- `data/forms/heilmittelkatalog.json` – Heilmittelkatalog (5 Bereiche, 44 Diagnosegruppen) aus der HeilM-RL; Muster 13 prüft damit Diagnosegruppe, Leitsymptomatik, Heilmittel und Höchstmenge je Verordnung. Der G-BA-Beschluss vom 20.08.2026 (in Kraft 01.01.2027) ist noch nicht eingearbeitet.

- `data/forms/generators/` – Erzeugung von `muster-12.json`/`muster-61.json` aus dem Katalog (Regeln mit Fundstelle) und Hilfe zum Ablesen der Ankreuzfelder aus der Mustersammlung.

## Nächste Vordrucke (Vorschlag, nach Häufigkeit in der Hausarztpraxis)

Muster 10A (Laborgemeinschaft), 20 (Wiedereingliederung), 21 (Kind krank), 52, 63, 55, 19 – jeweils mit eigenem Feldmodell und Tests. Die Regeln dafür stehen schon im Katalog.
