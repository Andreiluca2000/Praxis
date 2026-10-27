import { describe, expect, it } from 'vitest';
import { patientPairs } from '../src/core/patient-pairs.js';
import type { BilledService } from '../src/domain/types.js';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { checkPairs, confirmationKey, loadPairRegistry } from '../src/engine/pairs.js';
import { checkQuarter } from '../src/kvdt/quarter-check.js';
import { settings } from './fixtures.js';
import { RAW, REG, WOUNDS } from './pair-registry.js';

const D = '2026-11-12';
const svc = (code: string, session: string | null = null, date = D, system: BilledService['system'] = 'EBM'): BilledService =>
  ({ code, system, date, state: 'active', session, evidence: [{ ref: `TEST:${code}` }] });
const verdicts = (services: BilledService[], opts = {}) =>
  checkPairs(services, REG, opts).findings.map((f) => `${[...f.codes].sort().join('/')}:${f.verdict}`).sort();

describe('Paarprüfung je Sitzung (Codex-Dossier, Entwurf)', () => {
  it('liest das ganze Dossier ohne Fehler und kennt beide Systeme', () => {
    expect(REG.clauses.length).toBeGreaterThan(900);
    expect(new Set(REG.clauses.map((c) => c.system))).toEqual(new Set(['EBM', 'GOAE']));
  });

  it('Probe 1: 03100 + 03360 in derselben Sitzung → Ausschluss, in beiden Reihenfolgen', () => {
    expect(verdicts([svc('03100', '0930'), svc('03360', '0930')])).toEqual(['03100/03360:excluded']);
    expect(verdicts([svc('03360', '0930'), svc('03100', '0930')])).toEqual(['03100/03360:excluded']);
  });

  it('Probe 2/29: verschiedene Uhrzeiten am selben Tag → kein Ausschluss, aber auch keine Freigabe', () => {
    const f = checkPairs([svc('03100', '0930'), svc('03360', '1645')], REG).findings;
    expect(f.map((x) => x.verdict)).toEqual(['not_verifiable']);
    expect(f[0]!.sessionNote).toMatch(/getrennte Sitzung nur, wenn so dokumentiert/);
  });

  it('Probe 3/23: Sitzung unbekannt → „nicht prüfbar“, nie stillschweigend der ganze Tag', () => {
    expect(verdicts([svc('03100'), svc('03360')])).toEqual(['03100/03360:not_verifiable']);
    expect(verdicts([svc('03100', null, '2026-11-12'), svc('03360', null, '2026-11-13')])).toEqual([]);
  });

  it('Probe 4: 03100 + 03360 + 03370 → jedes Paar mit eigener Klausel und eigenem Beleg', () => {
    const f = checkPairs([svc('03100', '1000'), svc('03360', '1000'), svc('03370', '1000')], REG).findings;
    expect(f.map((x) => x.clauseId).sort()).toEqual(['EBM_03100_03360_SESSION', 'EBM_03100_03370_SESSION', 'EBM_03360_03370_SESSION']);
    for (const x of f) expect(x.evidence.length).toBeGreaterThan(0);
  });

  it('Probe 25/26: keine erfundenen Paare (37305/35100, 03330/13254)', () => {
    expect(verdicts([svc('03230', '1000'), svc('37305', '1000'), svc('35100', '1000')])).toEqual(['03230/35100:excluded', '03230/37305:excluded']);
    expect(verdicts([svc('03330', '1000'), svc('13254', '1000')])).toEqual([]);
    expect(verdicts([svc('03330', '1000'), svc('13255', '1000')])).toEqual(['03330/13255:excluded']);
  });

  it('Probe 24/36/40/41: Ausschlüsse je Fall/Tag/postoperativ stehen nicht im Sitzungs-Dossier (nicht verkürzen)', () => {
    for (const [a, b] of [['03371', '37302'], ['35110', '08521'], ['02310', '02311'], ['02300', '09329']]) {
      expect(verdicts([svc(a!, '1000'), svc(b!, '1000')])).toEqual([]);
    }
  });

  it('Probe 37/39: Paare mit Ausnahme-Verweis ergeben nie einen Ausschluss ohne Prüfung', () => {
    const f = checkPairs([svc('02300', '1000'), svc('02301', '1000')], REG).findings;
    expect(f.map((x) => x.verdict)).toEqual(['exception_review']);
    expect(f[0]!.exceptions[0]!.id).toBe('MINOR_MULTIPLE_EXCEPTION');
    expect(f[0]!.exceptions[0]!.evidence.length).toBeGreaterThan(0);
    expect(verdicts([svc('02301', '1000'), svc('05331', '1000')])).toEqual(['02301/05331:exception_review']);
    // Probe 38: 02300/02311 erbt die Ausnahme nicht.
    expect(verdicts([svc('02300', '1000'), svc('02311', '1000')])).toEqual(['02300/02311:excluded']);
  });

  it('Probe 6: HZV-Fall und Systemgrenzen – EBM-Paare nicht auf GOÄ übertragen', () => {
    expect(checkPairs([svc('03100', '1000'), svc('03360', '1000')], REG, { hzv: true }).skipped).toMatch(/HZV/);
    expect(verdicts([svc('03100', '1000'), svc('03360', '1000', D, 'GOAE')])).toEqual([]);
  });

  it('Probe 7/12: GOÄ 1 + 34 (Sitzung) und A + E (Inanspruchnahme)', () => {
    expect(verdicts([svc('34', '1100', D, 'GOAE'), svc('1', '1100', D, 'GOAE')])).toEqual(['1/34:excluded']);
    const ae = checkPairs([svc('A', '2000', D, 'GOAE'), svc('E', '2000', D, 'GOAE')], REG).findings;
    expect(ae[0]!.text).toMatch(/derselben Inanspruchnahme/);
  });

  it('stornierte Einträge und Tage außerhalb des Geltungszeitraums werden nicht geprüft', () => {
    expect(verdicts([svc('03100', '1000'), { ...svc('03360', '1000'), state: 'cancelled' }])).toEqual([]);
    const r = checkPairs([svc('03100', '1000', '2027-01-05'), svc('03360', '1000', '2027-01-05')], REG);
    expect(r.findings).toEqual([]);
    expect(r.outOfRange).toBe(1);
  });
});

describe('Dossier wird streng gelesen (fail-closed)', () => {
  const variant = (patch: Record<string, unknown>) => ({ ...RAW, ...patch });
  const clause0 = (RAW.clauses as Record<string, unknown>[])[0]!;
  it.each([
    ['unbekannte Schemafassung', variant({ schema_version: '9.0.0' }), /Schemafassung/],
    ['als operativ gekennzeichnet', variant({ operational: true }), /Entwurf/],
    ['Geltungszeitraum fehlt', variant({ valid_to: undefined }), /Geltungszeitraum/],
    ['Klausel mit anderer Beziehung', variant({ clauses: [{ ...clause0, parameters: { relation: 'allows', counterpart_codes: ['03360'] } }] }), /Aufbau/],
    ['doppeltes Paar', variant({ clauses: [clause0, { ...clause0, id: 'X' }] }), /doppelt/],
  ])('%s → kein Register', (_name, raw, msg) => {
    const r = loadPairRegistry(raw, [WOUNDS]);
    expect('error' in r && r.error).toMatch(msg);
  });

  it('Ausnahme ohne Quell-Dossier → kein Register', () => {
    expect('error' in loadPairRegistry(RAW, [])).toBe(true);
  });
});

describe('KVDT-Quartalsprüfung mit Paarprüfung', () => {
  const kvdt = (lines: [string, string][]) => concatBytes([
    xdtLine('8000', 'con0'), xdtLine('9206', '3'), xdtLine('8000', '0101'), xdtLine('3000', 'P-test'), xdtLine('4101', '42026'),
    ...lines.map(([fk, v]) => xdtLine(fk, v)), xdtLine('8000', 'con9'),
  ]);
  const data = kvdt([['5000', '12112026'], ['5001', '03100'], ['5006', '0930'], ['5001', '03360'], ['5006', '0930'], ['6001', 'I10.90'], ['6003', 'G']]);

  it('FK 5006 ergibt die Sitzung; Befund nur im Simulator und nie als Fehler gezählt', () => {
    const sim = checkQuarter(data, settings(), { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue', rules: [] }, 'simulation', REG);
    expect(sim.combinations?.findings.map((f) => `${f.patientToken}:${f.verdict}`)).toEqual(['P-test:excluded']);
    expect(sim.bySeverity.fehler).toBe(0);
    const op = checkQuarter(data, settings(), { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue', rules: [] }, 'operational', REG);
    expect(op.combinations).toBeNull();
  });
});

describe('Bestätigung „getrennte Sitzungen dokumentiert“', () => {
  const by = { by: 'AL', at: '2026-11-12T16:50' };
  const confirmed = new Map([[confirmationKey('EBM_03100_03360_SESSION', D), by]]);

  it('nur nach Bestätigung (mit wem/wann) kein Ausschluss – nie automatisch aus der Uhrzeit', () => {
    expect(verdicts([svc('03100', '0930'), svc('03360', '1645')])).toEqual(['03100/03360:not_verifiable']);
    const f = checkPairs([svc('03100', '0930'), svc('03360', '1645')], REG, { confirmedSeparate: confirmed }).findings;
    expect(f.map((x) => x.verdict)).toEqual(['separate_confirmed']);
    expect(f[0]!.confirmation).toEqual(by);
    expect(f[0]!.text).toMatch(/übrigen Bedingungen bleiben zu prüfen/);
  });

  it('Bestätigung gilt nur für Klausel und Tag, nicht für andere Paare oder Tage', () => {
    const other = checkPairs([svc('03100'), svc('03370')], REG, { confirmedSeparate: confirmed }).findings;
    expect(other.map((x) => x.verdict)).toEqual(['not_verifiable']);
    const day = checkPairs([svc('03100', null, '2026-11-13'), svc('03360', null, '2026-11-13')], REG, { confirmedSeparate: confirmed }).findings;
    expect(day.map((x) => x.verdict)).toEqual(['not_verifiable']);
  });

  it('gleiche Uhrzeit widerspricht der Bestätigung → Ausschluss bleibt', () => {
    const f = checkPairs([svc('03100', '0930'), svc('03360', '0930')], REG, { confirmedSeparate: confirmed }).findings;
    expect(f.map((x) => x.verdict)).toEqual(['excluded']);
    expect(f[0]!.sessionNote).toMatch(/widerspricht/);
    expect(f[0]!.confirmation).toBeNull();
  });
});

describe('Paare des geöffneten Patienten (src/core)', () => {
  const snap = { services: [svc('03100', '0930'), svc('03360', '0930')] } as Parameters<typeof patientPairs>[0];
  it('nur im Simulator und nur mit Dossier', () => {
    expect(patientPairs(snap, REG, { mode: 'operational', hzvContractId: null })).toBeNull();
    expect(patientPairs(snap, null, { mode: 'simulation', hzvContractId: null })).toBeNull();
    expect(patientPairs(snap, REG, { mode: 'simulation', hzvContractId: null })?.findings.map((f) => f.verdict)).toEqual(['excluded']);
  });
  it('HZV-Fall wird nicht geprüft', () => {
    expect(patientPairs(snap, REG, { mode: 'simulation', hzvContractId: 'TEST_HZV' })?.skipped).toMatch(/HZV/);
  });
});
