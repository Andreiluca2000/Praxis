import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { readKvdt } from '../src/kvdt/quarter-check.js';
import { beantworte, offeneAuftraege, parseAuftraege, SCHEMA, type AuftragsDatei } from '../src/bruecke/auftraege.js';
import { pruefeSynthetischenFall, regelnZuZiffer } from '../src/bruecke/regeln.js';
import { enthaeltIdentitaet, minimieren, pruefeAusgabe, reduziereKvdt } from '../src/bruecke/schutz.js';
import { fallpruefungUebersicht, MIN_GRUPPE, neutralisiere } from '../src/bruecke/uebersicht.js';
import { ladeKontext, leseArbeitsplatz, type Pfade } from '../src/bruecke/umgebung.js';
import {
  werkzeugAuftraegeLesen, werkzeugAuftragBeantworten, werkzeugFallpruefung, werkzeugRegeln, werkzeugSimulation, werkzeugStatus,
} from '../src/bruecke/werkzeuge.js';

/** Nur erfundene Daten (Präfix TEST_ bzw. offensichtlich ausgedachte Namen). */
const kvdt = (...scheine: Uint8Array[]) => concatBytes([xdtLine('8000', 'con0'), xdtLine('9206', '3'), ...scheine, xdtLine('8000', 'con9')]);
const schein = (nr: string, name: string, lines: [string, string][]) => concatBytes([
  xdtLine('8000', '0101'), xdtLine('3000', nr), xdtLine('3101', name), xdtLine('3102', 'Testvorname'), xdtLine('3103', '01021950'),
  xdtLine('3107', 'Teststraße 1'), xdtLine('3119', 'X123456789'), xdtLine('4101', '42026'), ...lines.map(([fk, v]) => xdtLine(fk, v)),
]);
const ohneDiagnose = (nr: string, name: string) => schein(nr, name, [['5000', '05102026'], ['5001', '03000']]);
const ohneSicherheit = (nr: string, name: string) => schein(nr, name, [['5000', '06102026'], ['5001', '03000'], ['6001', 'J20.9']]);
const sauber = (nr: string, name: string) => schein(nr, name, [['5000', '07102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]);

function pfade(config: unknown | null): Pfade {
  const benutzer = mkdtempSync(join(tmpdir(), 'bruecke-u-'));
  const praxis = mkdtempSync(join(tmpdir(), 'bruecke-p-'));
  if (config !== null) writeFileSync(join(benutzer, 'arbeitsplatz.json'), JSON.stringify(config));
  return { benutzer, praxis };
}
const EIN = { mode: 'simulation', kv: 'Nordrhein', ai: { provider: 'claude' } };
const AUS = { mode: 'simulation', kv: 'Nordrhein', ai: { provider: 'aus' } };

describe('Schutz: KVDT wird wie in Rust reduziert', () => {
  it('verwirft Identitätsfelder, ersetzt Patientennummern durch Laufnummern', () => {
    const r = reduziereKvdt(kvdt(sauber('4711', 'Mustermann'), sauber('4712', 'Beispielfrau'), sauber('4711', 'Mustermann')));
    const text = new TextDecoder('latin1').decode(r.daten);
    expect(text).not.toMatch(/Mustermann|Beispielfrau|Testvorname|Teststraße|X123456789|01021950|4711|4712/);
    expect(r.patienten).toBe(2);
    const { cases } = readKvdt(r.daten);
    expect(cases.map((c) => c.patientToken)).toEqual(['F-1', 'F-2', 'F-1']);
    expect(cases[0]).toMatchObject({ services: [{ code: '03000', date: '2026-10-07' }], diagnoses: [{ icd: 'J20.9', certainty: 'G' }] });
    expect(r.identitaet).toEqual(expect.arrayContaining(['mustermann', 'beispielfrau', 'teststraße 1', 'x123456789', '01021950', '01.02.1950']));
    // Kurze Zahlen (PLZ, kurze Patientennummern) nicht: sie kollidieren mit Ziffern und Fallzahlen.
    expect(r.identitaet).not.toContain('4711');
  });

  it('sperrt eine Ausgabe, die einen Identitätswert als ganzes Wort enthält', () => {
    expect(enthaeltIdentitaet('Befund bei Mustermann.', ['mustermann'])).toBe(true);
    expect(enthaeltIdentitaet('Mustermannstraße', ['mustermann'])).toBe(false);
    expect(() => pruefeAusgabe('{"text":"MUSTERMANN"}', ['mustermann'])).toThrow(/gesperrt/);
    expect(pruefeAusgabe('03000: 7 Fälle', ['mustermann'])).toBe('03000: 7 Fälle');
  });

  it('minimiert Telefonnummern, E-Mails, KVNR und Pseudonyme wie ai::minimize', () => {
    const m = minimieren('Rückruf 0221 1234567 oder 02211234567, test@example.org, A123456789, P-0123456789abcdef0123, 03230 prüfen');
    expect(m.text).toBe('Rückruf 0221 [entfernt] oder [entfernt], [entfernt], [entfernt], [entfernt], 03230 prüfen');
    expect(m.entfernt).toBe(5);
    expect(minimieren('x'.repeat(50), 10).text).toHaveLength(10);
  });
});

describe('Fallprüfung: nur Summen', () => {
  const k = () => ladeKontext(leseArbeitsplatz(pfade(EIN)), pfade(EIN));
  const datei = () => kvdt(
    ...Array.from({ length: 6 }, (_, i) => ohneDiagnose(`10${i}`, `Testname${i}`)),
    ...Array.from({ length: 2 }, (_, i) => ohneSicherheit(`20${i}`, `Probename${i}`)),
    sauber('300', 'Ganzsauber'),
  );

  it('fasst Befunde ab 5 Fällen zusammen, kleine Gruppen nur als Anzahl', () => {
    const { uebersicht: u } = fallpruefungUebersicht(datei(), k());
    expect(u.faelle).toBe(9);
    expect(u.befunde).toContainEqual({ art: 'keine_diagnose', schwere: 'fehler', text: 'Fall mit Leistungen, aber ohne Diagnose.', faelle: 6 });
    expect(u.befunde.some((g) => g.art === 'diagnose_ohne_sicherheit')).toBe(false);
    expect(u.selten).toEqual({ gruppen: 1, faelle: 'unter 5' });
    expect(u.jeArt).toMatchObject({ keine_diagnose: 6, diagnose_ohne_sicherheit: 'unter 5' });
    expect(u.ziffern).toEqual([{ ziffer: '03000', faelle: 9 }]);
    expect(u.quartal).toEqual({ von: '2026-10-01', bis: '2026-12-31' });
    expect(MIN_GRUPPE).toBe(5);
  });

  it('Ausgabe ohne Namen, Laufnummern, Patientennummern und Leistungstage', () => {
    const r = fallpruefungUebersicht(datei(), k());
    const text = JSON.stringify(r.uebersicht);
    expect(text).not.toMatch(/Testname|Probename|Ganzsauber|Testvorname|F-\d|"10\d"|2026-10-0[5-7]|05\.10\.2026/);
    expect(() => pruefeAusgabe(text, r.identitaet)).not.toThrow();
  });

  it('Tagesfilter: nur Fälle mit Leistungen an diesem Tag', () => {
    const { uebersicht: u } = fallpruefungUebersicht(datei(), k(), '2026-10-05');
    expect(u.tag).toBe('2026-10-05');
    expect(u.faelle).toBe(6);
    expect(u.jeArt).not.toHaveProperty('diagnose_ohne_sicherheit');
  });

  it('Datumsangaben und Zeilennummern werden neutralisiert', () => {
    expect(neutralisiere('Ziffer 03000 am 2026-09-15 liegt außerhalb (Zeile 12).')).toBe('Ziffer 03000 am [Tag] liegt außerhalb .');
    expect(neutralisiere('am 15.09.2026, Tel 02211234567')).toBe('am [Tag], Tel [entfernt]');
  });
});

describe('KI-Schalter der App ist die Pforte', () => {
  it('KI aus oder keine Einstellungsdatei → keine Ausgabe, Protokoll ohne Inhalt', () => {
    for (const p of [pfade(AUS), pfade(null)]) {
      const r = werkzeugFallpruefung(p, 'egal.con');
      expect(r).toEqual({ ok: false, text: expect.stringMatching(/ausgeschaltet/) });
      expect(werkzeugStatus(p).ok).toBe(false);
      expect(werkzeugRegeln(p, '03000').ok).toBe(false);
      expect(werkzeugAuftraegeLesen(p).ok).toBe(false);
    }
    const p = pfade(AUS);
    werkzeugFallpruefung(p, 'egal.con');
    const log = readFileSync(join(p.benutzer, 'claude-bruecke-protokoll.jsonl'), 'utf8');
    expect(JSON.parse(log.trim())).toMatchObject({ werkzeug: 'fallpruefung_uebersicht', ok: false });
    expect(log).not.toContain('egal.con');
  });

  it('fehlerhafte Einstellungsdatei → aus', () => {
    const p = pfade(null);
    writeFileSync(join(p.benutzer, 'arbeitsplatz.json'), '{kaputt');
    expect(leseArbeitsplatz(p).kiEin).toBe(false);
  });

  it('KI ein → Fallprüfung über eine Datei, Status lesbar', () => {
    const p = pfade(EIN);
    const file = join(p.benutzer, 'TEST_quartal.con');
    writeFileSync(file, datei());
    const r = werkzeugFallpruefung(p, file);
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.text)).toMatchObject({ faelle: 10, modus: 'simulation' });
    expect(r.text).not.toMatch(/Testname|Ganzsauber/);
    expect(JSON.parse(werkzeugStatus(p).text)).toMatchObject({ ki: 'ein', modus: 'simulation', kv: 'Nordrhein' });
  });

  it('fehlende Datei → Fehlermeldung, nichts sonst', () => {
    const r = werkzeugFallpruefung(pfade(EIN), join(tmpdir(), 'gibt-es-nicht-TEST.con'));
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/^Fehler:/);
  });

  function datei() { return kvdt(...Array.from({ length: 9 }, (_, i) => ohneDiagnose(`5${i}`, `Testname${i}`)), sauber('60', 'Ganzsauber')); }
});

describe('Regeln und erfundene Fälle (ohne Patientendaten)', () => {
  const p = pfade(EIN);
  const k = ladeKontext(leseArbeitsplatz(p), p);

  it('findet Paar-Ausschlüsse mit Normzitat zu einer Ziffer', () => {
    const clause = k.pairs!.clauses.find((c) => c.system === 'EBM' && /^\d{5}$/.test(c.codes[0]))!;
    const r = regelnZuZiffer(clause.codes[0], k);
    expect(Array.isArray(r)).toBe(true);
    const t = (r as Exclude<typeof r, { fehler: string }>).find((x) => x.id === clause.id)!;
    expect(t).toMatchObject({ quelle: 'paar', entwurf: true });
    expect(t.belege[0]?.text.length).toBeGreaterThan(0);
    expect(regelnZuZiffer('abc', k)).toEqual({ fehler: expect.any(String) });
  });

  it('erfundener Fall: gleiche Sitzung zweier ausgeschlossener Ziffern → Kombination', () => {
    const clause = k.pairs!.clauses.find((c) => c.system === 'EBM' && c.scope === 'session' && c.codes.every((x) => /^\d{5}$/.test(x)))!;
    const r = pruefeSynthetischenFall({
      quartal: '42026',
      leistungen: [{ ziffer: clause.codes[0], tag: 3, uhrzeit: '1000' }, { ziffer: clause.codes[1], tag: 3, uhrzeit: '1000' }],
      diagnosen: [{ icd: 'J20.9', sicherheit: 'G' }],
    }, k);
    expect(r).toMatchObject({ synthetisch: true, tage: { '2026-10-03': clause.codes } });
    expect('kombinationen' in r && r.kombinationen.some((x) => x.ziffern.join() === clause.codes.join())).toBe(true);
  });

  it('lehnt ungültige erfundene Fälle ab', () => {
    expect(pruefeSynthetischenFall({ quartal: '52026', leistungen: [{ ziffer: '03000', tag: 1 }], diagnosen: [] }, k)).toHaveProperty('fehler');
    expect(pruefeSynthetischenFall({ quartal: '42026', leistungen: [{ ziffer: '03000', tag: 93 }], diagnosen: [] }, k)).toHaveProperty('fehler');
    expect(pruefeSynthetischenFall({ quartal: '42026', leistungen: [{ ziffer: '03000', tag: 1 }], diagnosen: [{ icd: 'Herz' }] }, k)).toHaveProperty('fehler');
    expect(werkzeugSimulation(p, { quartal: '42026', leistungen: [{ ziffer: '03000', tag: 1 }], diagnosen: [] }).ok).toBe(true);
  });
});

describe('Aufträge aus dem Bereich „Prozesse“', () => {
  const datei = (): AuftragsDatei => ({
    schema_version: SCHEMA,
    auftraege: [
      { id: 'A-20261109-0001', erstellt: '2026-11-09T08:00:00Z', von: 'TST', text: 'Prüfe 03230 ohne 35100, Rückruf 02211234567', status: 'offen', antwort: null },
      { id: 'A-20261109-0002', erstellt: '2026-11-09T08:05:00Z', von: 'TST', text: 'Alt', status: 'erledigt', antwort: { text: 'ok', am: '2026-11-09T09:00:00Z' } },
    ],
  });
  let p: Pfade;
  beforeEach(() => {
    p = pfade(EIN);
    writeFileSync(join(p.benutzer, 'claude-auftraege.json'), JSON.stringify(datei()));
  });

  it('liest nur offene Aufträge, Text minimiert', () => {
    const r = werkzeugAuftraegeLesen(p);
    const a = JSON.parse(r.text).auftraege;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: 'A-20261109-0001', text: 'Prüfe 03230 ohne 35100, Rückruf [entfernt]', entfernt: 1 });
  });

  it('beantwortet einen Auftrag, ohne die alte Struktur zu verändern', () => {
    const d = datei();
    const neu = beantworte(d, 'A-20261109-0001', 'Erledigt: 12 Fälle, Details in der App.', 'erledigt', '2026-11-09T10:00:00Z');
    expect(d.auftraege[0]!.status).toBe('offen');
    expect(neu).toMatchObject({ auftraege: [{ status: 'erledigt', antwort: { text: 'Erledigt: 12 Fälle, Details in der App.' } }, { status: 'erledigt' }] });
    expect(beantworte(d, 'A-20261109-0002', 'x', 'erledigt', 'jetzt')).toHaveProperty('fehler');
    expect(beantworte(d, 'A-nicht-da', 'x', 'erledigt', 'jetzt')).toHaveProperty('fehler');
    expect(beantworte(d, 'A-20261109-0001', '  ', 'erledigt', 'jetzt')).toHaveProperty('fehler');
  });

  it('speichert die Antwort atomar in der Datei', () => {
    const r = werkzeugAuftragBeantworten(p, 'A-20261109-0001', 'In Arbeit.', 'in_arbeit', new Date('2026-11-09T10:00:00Z'));
    expect(r.ok).toBe(true);
    const gespeichert = JSON.parse(readFileSync(join(p.benutzer, 'claude-auftraege.json'), 'utf8'));
    expect(gespeichert.auftraege[0]).toMatchObject({ status: 'in_arbeit', antwort: { text: 'In Arbeit.', am: '2026-11-09T10:00:00.000Z' } });
    expect(existsSync(join(p.benutzer, 'claude-auftraege.json.tmp'))).toBe(false);
  });

  it('fehlerhafte Datei → nichts lesen, nichts überschreiben', () => {
    const file = join(p.benutzer, 'claude-auftraege.json');
    writeFileSync(file, JSON.stringify({ schema_version: SCHEMA, auftraege: [{ id: 'kaputt' }] }));
    expect(werkzeugAuftraegeLesen(p).ok).toBe(false);
    expect(werkzeugAuftragBeantworten(p, 'A-20261109-0001', 'x', 'erledigt').ok).toBe(false);
    expect(readFileSync(file, 'utf8')).toContain('kaputt');
    expect(parseAuftraege({ schema_version: '9', auftraege: [] })).toHaveProperty('fehler');
    expect(offeneAuftraege({ schema_version: SCHEMA, auftraege: [] })).toEqual([]);
  });
});
