import { describe, expect, it } from 'vitest';
import chronicJson from '../data/billing/reviewed/chronic-dx.json';
import reviewedJson from '../data/billing/reviewed/hausarzt-welle1.json';
import type { IsoDate } from '../src/domain/types.js';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { loadCatalogue } from '../src/engine/catalogue.js';
import { applyKiFilter, decideHit, describeFilter, parseKiFilter, type FilterInput, type KiFilter } from '../src/kvdt/ki-filter.js';
import { settings } from './fixtures.js';

/** Erfundene KVDT-Datei (Quartal 4/2026), Pseudonyme statt Nummern. KI-Antworten sind feste Testtexte, kein Netz. */
const DAY: IsoDate = '2026-11-08';
const T0 = Date.UTC(2026, 10, 8, 8, 0) / 1000;
const SHIPPED = loadCatalogue(reviewedJson, chronicJson);
const kvdt = (...scheine: Uint8Array[]) => concatBytes([xdtLine('8000', 'con0'), ...scheine, xdtLine('8000', 'con9')]);
const schein = (token: string, lines: [string, string][]) =>
  concatBytes([xdtLine('8000', '0101'), xdtLine('3000', token), xdtLine('4101', '42026'), ...lines.map(([fk, v]) => xdtLine(fk, v))]);
const DATA = kvdt(
  schein('P-dm-ohne', [['5000', '08112026'], ['5001', '03000'], ['6001', 'E11.9'], ['6003', 'G']]),
  schein('P-dm-mit', [['5000', '05102026'], ['5001', '03000'], ['5001', '03220'], ['6001', 'E11.9'], ['6003', 'G']]),
  schein('P-dm-verdacht', [['5000', '06102026'], ['5001', '03000'], ['6001', 'E11.9'], ['6003', 'V']]),
  schein('P-infekt', [['5000', '08112026'], ['5001', '03000'], ['6001', 'J06.9']]),
);
const input = (over: Partial<FilterInput> = {}): FilterInput => ({
  kvdt: DATA, day: DAY, calls: [{ token: 'P-dm-ohne', at: T0, station: 'PC07', kuerzel: 'AL' }, { token: 'P-infekt', at: T0 + 600, station: 'PC07', kuerzel: 'AL' }],
  dayOf: (at) => new Date(at * 1000).toISOString().slice(0, 10) as IsoDate,
  settings: settings({ region: { country: 'DE', bundesland: 'NRW', kv: 'Nordrhein' } }), rules: SHIPPED.reviewed!, mode: 'operational', chronic: SHIPPED.chronic, ...over,
});
const DIABETIKER: KiFilter = {
  version: 1, titel: 'Diabetiker ohne Chronikerzuschlag', zeitraum: 'quartal',
  bedingungen: [{ art: 'diagnose', icd: ['E11'], vorhanden: true, sicherheit: ['G'] }, { art: 'ziffer', system: 'EBM', ziffern: ['03220', '03221'], vorhanden: false }],
};

describe('KI-Auftrag: Filter-Schema', () => {
  it('nimmt einen gültigen Filter an (auch in ```json```) und normalisiert „E11.-“', () => {
    const answer = '```json\n' + JSON.stringify({ ...DIABETIKER, bedingungen: [{ ...DIABETIKER.bedingungen[0], icd: ['e11.-'] }, DIABETIKER.bedingungen[1]] }) + '\n```';
    const r = parseKiFilter(answer);
    expect(r).toEqual({ filter: DIABETIKER });
  });

  it.each([
    ['kein JSON', 'Ich empfehle, alle Diabetiker zu prüfen.'],
    ['Patientenliste statt Filter', JSON.stringify({ ...DIABETIKER, patienten: ['P-dm-ohne'] })],
    ['Zusatzfeld in Bedingung', JSON.stringify({ ...DIABETIKER, bedingungen: [{ art: 'diagnose', icd: ['E11'], vorhanden: true, sql: 'DROP TABLE' }] })],
    ['unbekannte Art', JSON.stringify({ ...DIABETIKER, bedingungen: [{ art: 'skript', code: 'fetch()' }] })],
    ['ungültige ICD', JSON.stringify({ ...DIABETIKER, bedingungen: [{ art: 'diagnose', icd: ['Erika Testfrau'], vorhanden: true }] })],
    ['ungültige Ziffer', JSON.stringify({ ...DIABETIKER, bedingungen: [{ art: 'ziffer', system: 'EBM', ziffern: ['03220; rm'], vorhanden: false }] })],
    ['zu viele Bedingungen', JSON.stringify({ ...DIABETIKER, bedingungen: Array(9).fill(DIABETIKER.bedingungen[0]) })],
    ['keine Bedingung', JSON.stringify({ ...DIABETIKER, bedingungen: [] })],
    ['falsche Version', JSON.stringify({ ...DIABETIKER, version: 2 })],
    ['Steuerzeichen im Titel', JSON.stringify({ ...DIABETIKER, titel: '<script>alert(1)</script>' })],
    ['zu lang', JSON.stringify({ ...DIABETIKER, titel: 'x'.repeat(5000) })],
    ['Text vor dem JSON', `Hier ist der Filter: ${JSON.stringify(DIABETIKER)}`],
    ['vorhanden kein Wahrheitswert', JSON.stringify({ ...DIABETIKER, bedingungen: [{ art: 'diagnose', icd: ['E11'], vorhanden: 'ja' }] })],
  ])('lehnt ab: %s', (_name, answer) => {
    expect(parseKiFilter(answer)).toHaveProperty('errors');
  });

  it('lesbare Fassung zum Prüfen vor dem Anwenden', () => {
    expect(describeFilter(DIABETIKER, '4/2026')).toBe('Gefunden: ICD E11.- G, ohne 03220/03221, Quartal 4/2026');
    expect(describeFilter({ ...DIABETIKER, zeitraum: 'tag', bedingungen: [{ art: 'befund', befunde: ['diagnose_ohne_sicherheit'] }] }, null))
      .toBe('Gefunden: Befund: diagnose_ohne_sicherheit, heute (Tagesliste)');
  });
});

describe('KI-Auftrag: Filter lokal auf synthetische KVDT-Daten', () => {
  it('Diabetiker (G) ohne 03220/03221 im Quartal', () => {
    const r = applyKiFilter(DIABETIKER, input());
    expect(r.quarter).toBe('4/2026');
    expect(r.checked).toBe(4);
    expect(r.hits.map((h) => h.token)).toEqual(['P-dm-ohne']);
    expect(r.hits[0]).toMatchObject({ status: 'treffer', evidence: ['E11.9 G vorhanden', '03220/03221 fehlen'], certainty: 'unsicher', decision: 'offen' });
    // Der Prüfmotor liefert den passenden Befund dazu (R1).
    expect(r.hits[0]!.findings.some((t) => /ohne 03220/.test(t))).toBe(true);
  });

  it('Zeitraum „tag“: nur Patienten der heutigen Tagesliste, Befund des Prüfmotors', () => {
    const f: KiFilter = { version: 1, titel: 'Heute ohne Sicherheit', zeitraum: 'tag', bedingungen: [{ art: 'befund', befunde: ['diagnose_ohne_sicherheit'] }] };
    const r = applyKiFilter(f, input());
    expect(r.checked).toBe(2);
    expect(r.hits.map((h) => h.token)).toEqual(['P-infekt']);
  });

  it('nicht prüfbare Bedingungen (Alter) → „teilweise“, nie stillschweigend erfüllt; nur Alter → kein Treffer', () => {
    const mitAlter: KiFilter = { ...DIABETIKER, bedingungen: [...DIABETIKER.bedingungen, { art: 'alter', min: 35 }] };
    const r = applyKiFilter(mitAlter, input());
    expect(r.hits[0]).toMatchObject({ token: 'P-dm-ohne', status: 'teilweise' });
    expect(r.hits[0]!.unchecked[0]).toMatch(/Alter/);
    const nurAlter: KiFilter = { ...DIABETIKER, bedingungen: [{ art: 'alter', min: 35 }] };
    expect(applyKiFilter(nurAlter, input()).hits).toEqual([]);
  });

  it('Annehmen ändert nur die Entscheidung, nie die Sicherheit', () => {
    const [hit] = applyKiFilter(DIABETIKER, input()).hits;
    expect(decideHit(hit!, 'angenommen')).toMatchObject({ decision: 'angenommen', certainty: 'unsicher' });
    expect(hit!.decision).toBe('offen');
  });
});
