# Praxis-Assistent (MVP)

Interner Assistent für eine Hausarztpraxis in NRW: **ICD-10-GM-Suche** und **erklärbare Abrechnungsprüfung** (EBM / GOÄ / optional HZV), später angebunden an DURIA2.

> Status 25.10.2026: Entwicklungsstand, **nur synthetische Daten**. Keine aktive DURIA-Integration, keine klinische Validierung, keine freigegebenen echten Abrechnungsregeln. Ergebnisse sind Vorschläge zur Prüfung durch berechtigte Personen.

## Arbeitsteilung

| Bereich | Zuständig | Ordner |
|---|---|---|
| Programm: Prüfmotor, ICD-Suche, Oberfläche, Tests, DURIA-Adapter | Claude | `src/`, `tests/`, `app/` |
| Inhalte: ICD-Katalog, EBM/GOÄ/HZV-Regeln, Recht, Datenschutz | Codex | `data/`, `docs/`, `schemas/` |

Schnittstelle sind die JSON-Schemas in `schemas/`. Änderungen daran werden abgestimmt; das Programm validiert alle gelieferten Daten (`pnpm validate:data`).

## Befehle

```powershell
pnpm install
pnpm start          # lokale Oberfläche: http://127.0.0.1:4317 (nur dieser Rechner)
pnpm sample         # erzeugt samples/synthetisch-beispiel.bdt (erfundene Daten)
pnpm check          # Typprüfung + Tests + Datenvalidierung
pnpm test           # nur Tests
pnpm validate:data  # config/ und data/ gegen Schemas + semantische Regeln
```

Umgebungsvariablen (optional): `PRAXIS_PORT`, `PRAXIS_SETTINGS`, `PRAXIS_RULES`, `PRAXIS_MAPPING` (Pfad zu einer bestätigten DURIA-Feldzuordnung, Vorlage `config/duria-mapping.example.json`).

## DURIA-Anbindung

DURIA bietet laut Hersteller Anbindungen über **GDT/BDT, HL7 und DICOM**. Der Adapter liest GDT/BDT (xDT) ausschließlich lesend:
- Identitätsfelder (Name, Geburtsdatum, Anschrift) werden beim Einlesen verworfen; die Patientennummer wird sofort zu einem lokalen Sitzungs-Pseudonym.
- Kontext je Arbeitsplatz; Patientenwechsel, Datenänderung oder Ablauf sperren die Übernahme (CTX-01…04).
- Nur tatsächlich gelesene Tage gelten als abgedeckt, außer der Benutzer bestätigt den Zeitraum ausdrücklich (CTX-05).
- Die Feldzuordnung ist bis zur Bestätigung durch DURIA als „ungeprüft“ markiert. Offene Fragen: `docs/DURIA_FRAGEN.md`.

Voraussetzungen: Node ≥ 22, pnpm.

## Aufbau

```
src/domain/       Typen (spiegeln die Schemas), Datumslogik
src/validation/   Schema- und semantische Prüfung (Ajv, Draft 2020-12)
src/engine/       Dreiwertige Auswertung, Zeitfenster, Vorprüfungen (KV/HZV/Aktivierung), Ergebnis
src/duria/        xDT-Parser (GDT/BDT, CP437/ISO 8859-15), Feldzuordnung, Adapter, Patientenkontext
src/facts/        Erkennung des Status einer Maßnahme im Text (immer „uncertain“ bis zur Bestätigung)
src/server/       Lokaler HTTP-Server (127.0.0.1) und Ablauf Export → Erkennung → Prüfung
src/cli/          Kommandozeilenwerkzeuge
app/              Oberfläche (Deutsch, ohne Fremdbibliotheken)
tests/            Akzeptanztests nach docs/ACCEPTANCE.md (nur synthetisch, Präfix TEST_)
```

## Grundsätze des Prüfmotors (umgesetzt)

- Jede Bedingung ist `fulfilled`, `not_fulfilled` oder `unknown`; fehlende, unsichere oder widersprüchliche Fakten bleiben `unknown`.
- Eine nachweislich nicht erfüllte Pflichtbedingung schließt aus; `unknown` ergibt nie ein positives Ergebnis.
- Regelversion nach **Leistungsdatum**; Zeitfenster (Tag/Quartal/Jahr) müssen vollständig gelesen sein, sonst `not_verifiable`. Behandlungsfall wird nicht mit dem Quartal gleichgesetzt.
- KV `null` blockiert regionale Regeln (kein stilles Nordrhein). HZV: Vertrag, Teilnahme und Einschreibung am Leistungsdatum müssen belegt sein; kein automatischer Wechsel zu EBM.
- DEMO-/Entwurfsregeln sind operativ wirkungslos und nur im markierten Simulator sichtbar.
- Nichts wird automatisch abgerechnet oder in DURIA geschrieben.

## Abdeckung der Akzeptanzkriterien

| Bereich | Status |
|---|---|
| BILL-01…12, 14 (Regelauswertung) | Tests vorhanden (BILL-13 folgt mit ICD-Modul) |
| CFG-01…03, HZV-01…06 | Tests vorhanden |
| ICD-01…10 | offen – wartet auf Katalogimport (Codex) |
| FACT-01…10 | Tests vorhanden (regelbasiert, Bestätigung durch Benutzer nötig) |
| CTX-01…05 | Tests vorhanden |
| CTX-06…07 | offen – betrifft den Rückweg in DURIA, der noch nicht vorgesehen ist |

Stand und nächste Schritte: `docs/STATUS_CLAUDE.md`.
