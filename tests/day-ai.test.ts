import { describe, expect, it } from 'vitest';
import chronicJson from '../data/billing/reviewed/chronic-dx.json';
import reviewedJson from '../data/billing/reviewed/hausarzt-welle1.json';
import type { IsoDate } from '../src/domain/types.js';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { loadCatalogue } from '../src/engine/catalogue.js';
import { codesIn, decide, explainRequest, parseAiProposals, readRequest, reviewAiProposals } from '../src/kvdt/day-ai.js';
import { checkDay, type DayCheckInput } from '../src/kvdt/day-check.js';
import { settings } from './fixtures.js';

/** Erfundener Tag (29.10.2026), Pseudonyme statt Nummern; KI-Antworten sind feste Testtexte, kein Netz. */
const DAY: IsoDate = '2026-10-29';
const T0 = Date.UTC(2026, 9, 29, 8, 0) / 1000;
const SHIPPED = loadCatalogue(reviewedJson, chronicJson);
const kvdt = (...scheine: Uint8Array[]) => concatBytes([xdtLine('8000', 'con0'), ...scheine, xdtLine('8000', 'con9')]);
const schein = (token: string, lines: [string, string][]) =>
  concatBytes([xdtLine('8000', '0101'), xdtLine('3000', token), xdtLine('4101', '42026'), ...lines.map(([fk, v]) => xdtLine(fk, v))]);
const input = (data: Uint8Array): DayCheckInput => ({
  kvdt: data, day: DAY, calls: [{ token: 'P-a', at: T0, station: 'PC07', kuerzel: 'AL' }],
  dayOf: (at) => new Date(at * 1000).toISOString().slice(0, 10) as IsoDate,
  settings: settings({ region: { country: 'DE', bundesland: 'NRW', kv: 'Nordrhein' } }), rules: SHIPPED.reviewed!, mode: 'operational', chronic: SHIPPED.chronic,
});
const TEXT = 'Gespräch 15 Min. wegen Rückenschmerz, akuter Infekt, Befund besprochen.';

describe('KI im Tagesabschluss (Vorschläge, nie Entscheidungen)', () => {
  it('Stufe 1: nur Befundart, Ziffern/ICD und Prüftext – kein Pseudonym, kein Kartei-Text', () => {
    const data = kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'E11.9'], ['6003', 'G']]));
    const p = checkDay(input(data)).patients[0]!;
    const item = p.items.find((i) => i.kind === 'diagnose_ziffer')!;
    const req = explainRequest(item);
    expect(req.stage).toBe('erklaeren');
    expect(req).toMatchObject({ kind: 'diagnose_ziffer' });
    expect(JSON.stringify(req)).not.toContain('P-a');
    expect(codesIn(item.text)).toEqual(expect.arrayContaining(['03220', 'E11.9']));
  });

  it('Stufe 2: Anfrage enthält Text und heutige Ziffern (Rust sendet sie nur mit Freigabe)', () => {
    const data = kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J06.9'], ['6003', 'G']]));
    const p = checkDay(input(data)).patients[0]!;
    expect(readRequest(p, TEXT)).toEqual({ stage: 'genau_lesen', codes_today: ['03000'], text: TEXT });
  });

  it('liest nur das feste JSON-Format; alles andere wird kein Vorschlag', () => {
    const ok = parseAiProposals('```json\n{"vorschlaege":[{"ziffer":"03230","begruendung":"Gespräch","beleg":"Gespräch 15 Min."}],"hinweise":["Dauer notiert"]}\n```');
    expect(ok).toEqual({ proposals: [{ ziffer: '03230', begruendung: 'Gespräch', beleg: 'Gespräch 15 Min.' }], hints: ['Dauer notiert'] });
    expect(parseAiProposals('Ich würde 03230 abrechnen.')).toHaveProperty('error');
    expect(parseAiProposals('{"vorschlag":"03230"}')).toHaveProperty('error');
  });

  it('jeder Vorschlag geht durch Motor und Katalog und bleibt „unsicher“', () => {
    const data = kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J06.9'], ['6003', 'G']]));
    const [zuschlag, doppelt, erfunden] = reviewAiProposals(input(data), 'P-a', [
      { ziffer: '03220', begruendung: 'chronisch krank', beleg: 'steht nicht im Text' },
      { ziffer: '03000', begruendung: 'Kontakt', beleg: 'Befund besprochen' },
      { ziffer: 'XYZ', begruendung: '?', beleg: '' },
    ], TEXT);
    // 03220 ohne gesicherte chronische Diagnose: der Motor meldet es (R1), die Regel ist freigegeben (Welle 1).
    expect(zuschlag!.checks.some((c) => /03220 ohne gesicherte/.test(c.text))).toBe(true);
    expect(zuschlag!.notes).toEqual(expect.arrayContaining(['Ärztlich freigegebene Regel vorhanden.', expect.stringMatching(/Beleg steht nicht wörtlich/)]));
    expect(doppelt!.notes).toContain('Heute bereits erfasst.');
    expect(erfunden!.notes[0]).toMatch(/nicht prüfbar/);
    for (const p of [zuschlag!, doppelt!, erfunden!]) expect(p).toMatchObject({ certainty: 'unsicher', decision: 'offen' });
    // Annehmen ändert nur die Entscheidung, nie die Sicherheit; das Original bleibt unverändert.
    const accepted = decide(zuschlag!, 'angenommen');
    expect(accepted).toMatchObject({ decision: 'angenommen', certainty: 'unsicher' });
    expect(zuschlag!.decision).toBe('offen');
  });

  it('Patient ohne KV-Schein: Vorschlag nicht prüfbar', () => {
    const data = kvdt(schein('P-b', [['5000', '29102026'], ['5001', '03000']]));
    const [p] = reviewAiProposals(input(data), 'P-a', [{ ziffer: '03230', begruendung: 'x', beleg: 'Gespräch 15 Min.' }], TEXT);
    expect(p!.checks[0]).toMatchObject({ level: 'grau', kind: 'kein_schein' });
  });
});
