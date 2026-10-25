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
pnpm check          # Typprüfung + Tests + Datenvalidierung
pnpm test           # nur Tests
pnpm validate:data  # config/ und data/ gegen Schemas + semantische Regeln
```

Voraussetzungen: Node ≥ 22, pnpm.

## Aufbau

```
src/domain/       Typen (spiegeln die Schemas), Datumslogik
src/validation/   Schema- und semantische Prüfung (Ajv, Draft 2020-12)
src/engine/       Dreiwertige Auswertung, Zeitfenster, Vorprüfungen (KV/HZV/Aktivierung), Ergebnis
src/cli/          Kommandozeilenwerkzeuge
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
| FACT-01…10 | offen – Extraktion folgt; Motor erwartet bereits `service.status` |
| CTX-01…07 | offen – DURIA-Adapter |

Stand und nächste Schritte: `docs/STATUS_CLAUDE.md`.
