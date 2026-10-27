import { describe, expect, it } from 'vitest';
import type { BilledService } from '../src/domain/types.js';
import { checkWindowRules, loadWindowRules, type WindowRuleSet } from '../src/engine/window-rules.js';
import { json, RAW } from './pair-registry.js';

/** Echte Codex-Dossiers (Entwurf); Fälle erfunden. */
export const WINDOW_DOSSIERS = ['optional-hausarzt', 'pauschalen', 'prevention', 'primary-care', 'visits', 'wounds', 'frequency'];
const sections = Object.fromEntries(
  Object.entries(RAW.section_membership as Record<string, { codes: string[] }>).map(([k, v]) => [k, v.codes]),
);
const loaded = loadWindowRules(WINDOW_DOSSIERS.map((name) => ({ name, raw: json(`${name}/rules.review.json`) })), sections);
if ('error' in loaded) throw new Error(loaded.error);
const RULES: WindowRuleSet = loaded;

const svc = (code: string, date: string, session: string | null = null): BilledService =>
  ({ code, system: 'EBM', date, state: 'active', session, evidence: [{ ref: `TEST:${code}` }] });
const verdicts = (services: BilledService[], complete = true) =>
  checkWindowRules({ services, behandlungsfallComplete: complete }, RULES).findings
    .map((f) => `${[...f.codes].sort().join('/')}:${f.verdict}`).sort();

describe('Ausschlüsse mit Zeitraum und Höchstanzahlen (Codex-Dossiers, Entwurf)', () => {
  it('lädt nur abbildbare Klauseln und zählt den Rest', () => {
    expect(RULES.exclusions.length).toBeGreaterThan(20);
    expect(RULES.limits.length).toBeGreaterThan(5);
    expect(RULES.skipped['nicht neben ohne Zeitraum']).toBeGreaterThan(0);
    expect(RULES.exclusions.every((e) => e.scope !== ('unresolved_neben' as never))).toBe(true);
  });

  it('Probe 32/27: Ausschluss am selben Tag – auch bei verschiedenen Uhrzeiten', () => {
    expect(verdicts([svc('01101', '2026-11-12', '0800'), svc('01955', '2026-11-12', '1900')])).toContain('01101/01955:excluded');
    expect(verdicts([svc('03062', '2026-11-12', '0900'), svc('38100', '2026-11-12', '1500')])).toContain('03062/38100:excluded');
    expect(verdicts([svc('01101', '2026-11-12'), svc('01955', '2026-11-13')])).toEqual([]);
  });

  it('Probe 24/36/40: Ausschluss im Behandlungsfall, auch in getrennten Sitzungen', () => {
    expect(verdicts([svc('03371', '2026-10-05', '1000'), svc('37302', '2026-12-01', '1100')])).toContain('03371/37302:excluded');
    expect(verdicts([svc('35110', '2026-10-05'), svc('08521', '2026-11-20')])).toContain('08521/35110:excluded');
    expect(verdicts([svc('02310', '2026-10-05'), svc('02311', '2026-10-09')])).toContain('02310/02311:excluded');
  });

  it('Behandlungsfall ohne ganzes Quartal → nicht prüfbar, nie kombinierbar', () => {
    expect(verdicts([svc('02310', '2026-10-05'), svc('02311', '2026-10-09')], false)).toContain('02310/02311:not_verifiable');
  });

  it('Krankheitsfall: aktuelles und die drei folgenden Quartale', () => {
    expect(verdicts([svc('03370', '2026-10-05'), svc('37300', '2026-12-20')])).toContain('03370/37300:excluded');
  });

  it('Probe 41: 02300 und 31600 – 21-Tage-Frist nach einem Eingriff (31.2) wird angezeigt, nicht verkürzt und nicht erfunden', () => {
    // Die Frist hängt vom Eingriff ab, dessen Ziffern (Abschnitt 31.2) nicht belegt sind → „nicht prüfbar“, nie stillschweigend erlaubt.
    expect(verdicts([svc('31600', '2026-10-01'), svc('02300', '2026-10-10')])).toContain('02300/31600:not_verifiable');
    expect(verdicts([svc('31600', '2026-10-01'), svc('02300', '2026-10-01', '1000')])).toContain('02300/31600:not_verifiable');
    expect(verdicts([svc('31600', '2026-10-01'), svc('02300', '2026-11-15')])).not.toContain('02300/31600:not_verifiable');
  });

  it('Probe 36: Höchstanzahl 35110 je Tag (drei) – vierte Einheit überschreitet', () => {
    const three = [svc('35110', '2026-11-12'), svc('35110', '2026-11-12'), svc('35110', '2026-11-12')];
    expect(verdicts(three)).toEqual([]);
    expect(verdicts([...three, svc('35110', '2026-11-12')])).toContain('35110:limit_exceeded');
  });

  it('Häufigkeit je Sitzung ohne Uhrzeit → nicht prüfbar', () => {
    const goae = (code: string, session: string | null): BilledService => ({ ...svc(code, '2026-11-12', session), system: 'GOAE' });
    const f = checkWindowRules({ services: [goae('410', null), goae('410', null)], behandlungsfallComplete: true }, RULES).findings;
    expect(f.map((x) => x.verdict)).toEqual(['not_verifiable']);
    const g = checkWindowRules({ services: [goae('410', '1000'), goae('410', '1000')], behandlungsfallComplete: true }, RULES).findings;
    expect(g.map((x) => x.verdict)).toEqual(['limit_exceeded']);
  });

  it('HZV, Stornos, andere Systeme und Tage außerhalb des Geltungszeitraums', () => {
    expect(checkWindowRules({ services: [svc('01101', '2026-11-12'), svc('01955', '2026-11-12')], behandlungsfallComplete: true, hzv: true }, RULES).skipped).toMatch(/HZV/);
    expect(verdicts([svc('01101', '2026-11-12'), { ...svc('01955', '2026-11-12'), state: 'cancelled' }])).toEqual([]);
    expect(verdicts([svc('01101', '2026-11-12'), { ...svc('01955', '2026-11-12'), system: 'GOAE' }])).toEqual([]);
    expect(verdicts([svc('01101', '2027-01-12'), svc('01955', '2027-01-12')])).toEqual([]);
  });

  it('Ausnahmen des Dossiers ergeben „Ausnahme prüfen“ – nur für das genannte Paar', () => {
    const raw = {
      status: 'draft', operational: false, valid_from: '2026-10-01', valid_to: '2026-12-31', billing_system: 'EBM',
      clauses: [
        { id: 'X_DAY', kind: 'combination', codes: ['TEST_A'], parameters: { relation: 'excludes', scope: 'calendar_day', counterpart_codes: ['TEST_B', 'TEST_C'] } },
        { id: 'X_EXC', kind: 'conditional_combination', codes: ['TEST_A'], parameters: { relation: 'conditional_with', counterpart_codes: ['TEST_B'] } },
      ],
    };
    const r = loadWindowRules([{ name: 'test', raw }]);
    if ('error' in r) throw new Error(r.error);
    const v = (b: string) => checkWindowRules({ services: [svc('TEST_A', '2026-11-12'), svc(b, '2026-11-12')], behandlungsfallComplete: true }, r).findings.map((f) => f.verdict);
    expect(v('TEST_B')).toEqual(['exception_review']);
    expect(v('TEST_C')).toEqual(['excluded']); // die Ausnahme gilt nicht für die ganze Liste
  });

  it('streng: Dossier ohne Entwurfskennzeichen oder Geltungszeitraum → kein Regelwerk', () => {
    const raw = json('visits/rules.review.json');
    expect('error' in loadWindowRules([{ name: 'visits', raw: { ...raw, operational: true } }])).toBe(true);
    expect('error' in loadWindowRules([{ name: 'visits', raw: { ...raw, valid_to: null } }])).toBe(true);
  });
});

describe('KVDT-Quartalsprüfung mit Zeitraum-Regeln', async () => {
  const { checkQuarter } = await import('../src/kvdt/quarter-check.js');
  const { concatBytes, xdtLine } = await import('../src/duria/xdt.js');
  const { settings } = await import('./fixtures.js');
  const { REG } = await import('./pair-registry.js');
  const kvdt = (lines: [string, string][]) => concatBytes([
    xdtLine('8000', 'con0'), xdtLine('9206', '3'), xdtLine('8000', '0101'), xdtLine('3000', 'P-test'), xdtLine('4101', '42026'),
    ...lines.map(([fk, v]) => xdtLine(fk, v)), xdtLine('8000', 'con9'),
  ]);
  const NO_RULES: import('../src/domain/types.js').RulePackage = { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue', rules: [] };

  it('Schein = ganzer Behandlungsfall; Tag-Ausschluss auch bei verschiedenen Uhrzeiten; nur im Simulator', () => {
    const data = kvdt([['5000', '05102026'], ['5001', '02310'], ['5000', '09102026'], ['5001', '02311'],
      ['5000', '12112026'], ['5001', '01101'], ['5006', '0800'], ['5001', '01955'], ['5006', '1900'], ['6001', 'T14.1'], ['6003', 'G']]);
    const sim = checkQuarter(data, settings(), NO_RULES, 'simulation', REG, RULES);
    const got = sim.combinations!.windowFindings.map((f) => `${[...f.codes].sort().join('/')}:${f.verdict}`);
    expect(got).toContain('02310/02311:excluded');
    expect(got).toContain('01101/01955:excluded');
    expect(sim.bySeverity.fehler).toBe(0); // Entwurf, nie als Fehler gezählt
    expect(checkQuarter(data, settings(), NO_RULES, 'operational', REG, RULES).combinations).toBeNull();
  });
});
