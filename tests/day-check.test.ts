import { describe, expect, it } from 'vitest';
import chronicJson from '../data/billing/reviewed/chronic-dx.json';
import reviewedJson from '../data/billing/reviewed/hausarzt-welle1.json';
import type { IsoDate, RulePackage } from '../src/domain/types.js';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { loadCatalogue } from '../src/engine/catalogue.js';
import { checkDay, type DayCall, type DayCheckInput } from '../src/kvdt/day-check.js';
import { checkQuarter } from '../src/kvdt/quarter-check.js';
import { REG } from './pair-registry.js';
import { settings, testRule } from './fixtures.js';

/**
 * Synthetische Tage (erfunden): Pseudonyme statt Patientennummern, wie Rust sie liefert.
 * Tag des Abschlusses: 29.10.2026. Aufrufzeiten als Sekunden; `dayOf` rechnet hier in UTC, damit die Tests ortsunabhängig sind.
 */
const DAY: IsoDate = '2026-10-29';
const T0 = Date.UTC(2026, 9, 29, 8, 0) / 1000;
const dayOf = (at: number): IsoDate => new Date(at * 1000).toISOString().slice(0, 10) as IsoDate;
const SHIPPED = loadCatalogue(reviewedJson, chronicJson);
const NO_RULES: RulePackage = { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue', rules: [testRule({ procedure_codes: ['UNUSED'] })] };

const kvdt = (...scheine: Uint8Array[]) => concatBytes([xdtLine('8000', 'con0'), xdtLine('9206', '3'), ...scheine, xdtLine('8000', 'con9')]);
const schein = (token: string, lines: [string, string][]) =>
  concatBytes([xdtLine('8000', '0101'), xdtLine('3000', token), xdtLine('4101', '42026'), ...lines.map(([fk, v]) => xdtLine(fk, v))]);
const call = (token: string, minutes: number, station = 'PC07', kuerzel = 'AL'): DayCall => ({ token, at: T0 + minutes * 60, station, kuerzel });

const run = (data: Uint8Array, calls: DayCall[], over: Partial<DayCheckInput> = {}) =>
  checkDay({ kvdt: data, day: DAY, calls, dayOf, settings: settings({ region: { country: 'DE', bundesland: 'NRW', kv: 'Nordrhein' } }), rules: SHIPPED.reviewed!, mode: 'operational', chronic: SHIPPED.chronic, ...over });

describe('Tagesabschluss (Quelle A: KVDT-Datei, nur lesen)', () => {
  it('sauberer Patient → grün, ohne „in Ordnung“ zu behaupten', () => {
    const r = run(kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']])), [call('P-a', 102)]);
    expect(r.fileCoversDay).toBe(true);
    expect(r.patients).toHaveLength(1);
    expect(r.patients[0]).toMatchObject({ token: 'P-a', status: 'gruen', items: [], servicesToday: ['03000'], diagnoses: ['J20.9 G'] });
    expect(r.counts).toEqual({ rot: 0, grau: 0, gelb: 0, gruen: 1 });
    // Was nicht geprüft wurde, steht immer im Bericht.
    expect(r.notChecked.some((t) => /BDT-Export pro Tag/.test(t))).toBe(true);
    expect(r.notChecked.some((t) => /nur im Simulator/.test(t))).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/in Ordnung/i);
  });

  it('Diagnose ohne Sicherheit und Fall ohne Diagnose → rot', () => {
    const r = run(kvdt(
      schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9']]),
      schein('P-b', [['5000', '29102026'], ['5001', '03000']]),
    ), [call('P-a', 10), call('P-b', 20)]);
    expect(r.patients.map((p) => [p.token, p.status])).toEqual([['P-a', 'rot'], ['P-b', 'rot']]);
    expect(r.patients[0]!.items.map((i) => i.kind)).toContain('diagnose_ohne_sicherheit');
    expect(r.patients[1]!.items.map((i) => i.kind)).toContain('keine_diagnose');
  });

  it('chronische Diagnose ohne 03220 und DM2 ohne DMP-Ziffer (Nordrhein) → gelb', () => {
    const r = run(kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'E11.9'], ['6003', 'G']])), [call('P-a', 0)]);
    const p = r.patients[0]!;
    expect(p.status).toBe('gelb');
    expect(p.items.filter((i) => i.kind === 'diagnose_ziffer').map((i) => i.text).join(' ')).toMatch(/03220[\s\S]*90325|90325[\s\S]*03220/);
    expect(p.items.every((i) => i.level === 'gelb' && !i.draft)).toBe(true);
  });

  it('nicht in der KVDT-Datei (HZV/privat) → grau „nicht prüfbar“', () => {
    const r = run(kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']])), [call('P-a', 0), call('P-x', 30)]);
    const x = r.patients.find((p) => p.token === 'P-x')!;
    expect(x.status).toBe('grau');
    expect(x.items[0]).toMatchObject({ kind: 'kein_schein', level: 'grau' });
    expect(x.items[0]!.text).toMatch(/^Nicht prüfbar/);
  });

  it('Datei vor dem Tag erzeugt → alle grau, auch ohne Befund', () => {
    const r = run(kvdt(schein('P-a', [['5000', '27102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']])), [call('P-a', 0)]);
    expect(r.fileCoversDay).toBe(false);
    expect(r.patients[0]).toMatchObject({ status: 'grau', servicesToday: [] });
    expect(r.patients[0]!.items[0]!.kind).toBe('tag_fehlt_in_datei');
  });

  it('aufgerufen, aber heute keine Ziffer (andere Patienten haben welche) → gelb', () => {
    const r = run(kvdt(
      schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]),
      schein('P-b', [['5000', '05102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]),
    ), [call('P-a', 0), call('P-b', 5)]);
    const b = r.patients.find((p) => p.token === 'P-b')!;
    expect(b.status).toBe('gelb');
    expect(b.items.map((i) => i.kind)).toEqual(['keine_leistung_am_tag']);
  });

  it('nur Aufrufe dieses Tages; mehrfacher Aufruf = ein Patient, sortiert nach Uhrzeit', () => {
    const data = kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]));
    const r = run(data, [call('P-a', 300, 'PC03', 'MF'), call('P-a', 45), call('P-alt', -24 * 60)]);
    expect(r.patients).toHaveLength(1);
    expect(r.patients[0]!.calls.map((c) => [c.station, c.kuerzel])).toEqual([['PC07', 'AL'], ['PC03', 'MF']]);
  });

  it('Patienten mit Leistungen heute, aber ohne Aufruf, werden nur gezählt', () => {
    const r = run(kvdt(
      schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]),
      schein('P-b', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]),
      schein('P-c', [['5000', '02102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]),
    ), [call('P-a', 0)]);
    expect(r.unlisted).toBe(1);
    expect(r.patients.map((p) => p.token)).toEqual(['P-a']);
  });

  it('Befunde früherer Tage zählen nicht, Fall-Befunde schon', () => {
    // Praxisregel-ähnlicher Regelkonflikt am 05.10. gehört zum damaligen Tag; fehlende Sicherheit betrifft den ganzen Fall.
    const day1 = { unit: 'day' as const, lookback_periods: 0, anchor: 'service_date' as const };
    const conflict = testRule({
      // Wie in der Quartalsprüfung: ein Konflikt erscheint für eine (noch) nicht erfasste Ziffer, die der Partner ausschließt.
      id: 'TEST_KONFLIKT', procedure_codes: ['TEST_OTHER'],
      required_context: [{ domain: 'billed_services', window: day1 }],
      eligibility: { kind: 'fact', field: 'service.status', operator: 'is_known', source_ids: ['TEST_SRC'] },
      combination_rules: [{ relationship: 'cannot_combine', with_codes: ['TEST_Y'], window: day1, reason: 'Testausschluss am selben Tag.', source_ids: ['TEST_SRC'] }],
    });
    const pkg: RulePackage = { ...NO_RULES, rules: [conflict] };
    const data = kvdt(schein('P-a', [['5000', '05102026'], ['5001', 'TEST_X'], ['5001', 'TEST_Y'], ['5000', '29102026'], ['5001', 'TEST_A'], ['6001', 'J20.9']]));
    const quarter = checkQuarter(data, settings(), pkg, 'operational');
    const day = run(data, [call('P-a', 0)], { rules: pkg, chronic: null });
    const kinds = day.patients[0]!.items.map((i) => i.kind);
    expect(kinds).toContain('diagnose_ohne_sicherheit');
    expect(kinds).not.toContain('regel');
    // Die Quartalsprüfung sieht den Konflikt am 05.10. weiterhin (Verhalten unverändert).
    const regel = quarter.findings.filter((f) => f.kind === 'regel');
    expect(regel.length).toBeGreaterThan(0);
    expect(regel.every((f) => f.date === '2026-10-05')).toBe(true);
  });

  it('Simulator: Ausschluss aus dem Entwurfs-Dossier bleibt gelb und ist als Entwurf markiert', () => {
    const data = kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03100'], ['5006', '0930'], ['5001', '03360'], ['5006', '0930'], ['6001', 'J20.9'], ['6003', 'G']]));
    const r = run(data, [call('P-a', 0)], { mode: 'simulation', pairs: REG, rules: NO_RULES });
    const p = r.patients[0]!;
    const pair = p.items.find((i) => i.kind === 'kombination');
    expect(pair).toMatchObject({ level: 'gelb', draft: true });
    expect(p.status).toBe('gelb');
    expect(r.notChecked.some((t) => /nur im Simulator/.test(t))).toBe(false);
  });

  it('unlesbare Zeilen → kein grün, sondern grau', () => {
    const good = kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]));
    const broken = concatBytes([good, new TextEncoder().encode('kaputte Zeile\r\n')]);
    const r = run(broken, [call('P-a', 0)]);
    expect(r.parseErrors).toBeGreaterThan(0);
    expect(r.patients[0]!.status).toBe('grau');
  });

  it('Ziffer außerhalb des Quartals an einem anderen Tag gehört nicht zum Tagesabschluss', () => {
    const data = kvdt(schein('P-a', [['5000', '05072026'], ['5001', '03000'], ['5000', '29102026'], ['5001', '03000'], ['6001', 'J20.9'], ['6003', 'G']]));
    expect(run(data, [call('P-a', 0)]).patients[0]!.status).toBe('gruen');
    expect(checkQuarter(data, settings(), NO_RULES, 'operational').findings.map((f) => f.kind)).toContain('datum_ausserhalb_quartal');
  });

  it('DEMO-Regeln im Simulator: Konflikt höchstens gelb, als Entwurf markiert', () => {
    const day1 = { unit: 'day' as const, lookback_periods: 0, anchor: 'service_date' as const };
    const conflict = testRule({
      id: 'TEST_KONFLIKT', procedure_codes: ['TEST_OTHER'], billing_system: 'DEMO',
      required_context: [{ domain: 'billed_services', window: day1 }],
      eligibility: { kind: 'fact', field: 'service.status', operator: 'is_known', source_ids: ['TEST_SRC'] },
      combination_rules: [{ relationship: 'cannot_combine', with_codes: ['TEST_Y'], window: day1, reason: 'Testausschluss.', source_ids: ['TEST_SRC'] }],
    });
    const demo: RulePackage = { ...NO_RULES, content_kind: 'synthetic_example', rules: [conflict] };
    const data = kvdt(schein('P-a', [['5000', '29102026'], ['5001', 'TEST_Y'], ['6001', 'J20.9'], ['6003', 'G']]));
    const p = run(data, [call('P-a', 0)], { mode: 'simulation', rules: demo, chronic: null }).patients[0]!;
    expect(p.items.find((i) => i.kind === 'regel')).toMatchObject({ level: 'gelb', draft: true });
    expect(p.status).toBe('gelb');
  });

  it('leere Tagesliste → leerer Bericht', () => {
    const r = run(kvdt(schein('P-a', [['5000', '29102026'], ['5001', '03000']])), []);
    expect(r.patients).toEqual([]);
    expect(r.unlisted).toBe(1);
  });
});
