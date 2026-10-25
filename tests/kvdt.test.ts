import { describe, expect, it } from 'vitest';
import type { RulePackage } from '../src/domain/types.js';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { checkQuarter, readKvdt } from '../src/kvdt/quarter-check.js';
import { settings, testRule } from './fixtures.js';

/** Synthetische KVDT-Datei: zwei Scheine im Quartal 4/2026, Pseudonyme statt Patientennummern. */
function kvdt(...scheine: Uint8Array[]): Uint8Array {
  return concatBytes([xdtLine('8000', 'con0'), xdtLine('9206', '3'), ...scheine, xdtLine('8000', 'con9')]);
}
const schein = (token: string, lines: [string, string][]) =>
  concatBytes([xdtLine('8000', '0101'), xdtLine('3000', token), xdtLine('4101', '42026'), ...lines.map(([fk, v]) => xdtLine(fk, v))]);

const NO_RULES: RulePackage = { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue', rules: [testRule({ procedure_codes: ['UNUSED'] })] };

describe('KVDT-Quartalsprüfung (nur lesen)', () => {
  it('liest Scheine mit Leistungen und Diagnosen', () => {
    const { cases, parseErrors } = readKvdt(kvdt(schein('P-a', [['5000', '05102026'], ['5001', 'TEST_A'], ['6001', 'j20.9'], ['6003', 'G']])));
    expect(parseErrors).toEqual([]);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ patientToken: 'P-a', quarter: '42026', services: [{ code: 'TEST_A', date: '2026-10-05' }], diagnoses: [{ icd: 'J20.9', certainty: 'G' }] });
  });

  it('findet fehlende Diagnose, fehlende Sicherheit, Ziffer außerhalb des Quartals', () => {
    const r = checkQuarter(kvdt(
      schein('P-a', [['5000', '05102026'], ['5001', 'TEST_A']]),
      schein('P-b', [['5000', '15092026'], ['5001', 'TEST_B'], ['6001', 'I10.90']]),
    ), settings(), NO_RULES, 'operational');
    expect(r.cases).toBe(2);
    expect(r.quarter).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    const kinds = r.findings.map((f) => `${f.patientToken}:${f.kind}`);
    expect(kinds).toContain('P-a:keine_diagnose');
    expect(kinds).toContain('P-b:diagnose_ohne_sicherheit');
    expect(kinds).toContain('P-b:datum_ausserhalb_quartal');
  });

  it('Häufigkeitsgrenze über das ganze Quartal (Regel mit max. 1 je Quartal)', () => {
    const rule = testRule({
      procedure_codes: ['TEST_Q'],
      required_context: [{ domain: 'billed_services', window: { unit: 'quarter', lookback_periods: 0, anchor: 'service_date' } }],
      frequency_limits: [{ max_count: 1, count_codes: ['TEST_Q'], window: { unit: 'quarter', lookback_periods: 0, anchor: 'service_date' }, source_ids: ['TEST_SRC'] }],
      eligibility: { kind: 'fact', field: 'service.status', operator: 'is_known', source_ids: ['TEST_SRC'] },
    });
    // Zweimal abgerechnet → Regel meldet "bereits erfasst"/Konflikt nur, wenn erneut vorgeschlagen; hier prüfen wir die Lesbarkeit
    // der Häufigkeit über den Konflikt eines anderen Codes, der TEST_Q als Zähler nutzt.
    const counter = testRule({ ...rule, id: 'TEST_COUNTER', procedure_codes: ['TEST_OTHER'] });
    const pkg: RulePackage = { ...NO_RULES, rules: [counter] };
    const r = checkQuarter(kvdt(schein('P-a', [['5000', '05102026'], ['5001', 'TEST_Q'], ['5000', '20112026'], ['5001', 'TEST_Q'], ['6001', 'J20.9'], ['6003', 'G']])), settings(), pkg, 'operational');
    expect(r.findings.some((f) => f.kind === 'regel' && /Höchstanzahl/.test(f.text))).toBe(true);
  });

  it('saubere Datei → keine Fehler', () => {
    const r = checkQuarter(kvdt(schein('P-a', [['5000', '05102026'], ['5001', 'TEST_A'], ['6001', 'J20.9'], ['6003', 'G']])), settings(), NO_RULES, 'operational');
    expect(r.bySeverity.fehler).toBe(0);
  });
});
