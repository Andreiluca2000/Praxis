import { describe, expect, it } from 'vitest';
import { evaluateRule } from '../src/engine/evaluate.js';
import type { RuleWindow } from '../src/domain/types.js';
import { billed, confirmed, fullCoverage, input, Q4, settings, testRule } from './fixtures.js';

const run = (rule = testRule(), inp = input({}), s = settings()) => evaluateRule(rule, inp, s, 'operational');
const ok12 = { 'service.status': confirmed('performed'), 'documentation.duration_minutes': confirmed(12) };
const QUARTER: RuleWindow = { unit: 'quarter', lookback_periods: 0, anchor: 'service_date' };
const DAY: RuleWindow = { unit: 'day', lookback_periods: 0, anchor: 'service_date' };

describe('Zeitfenster, Konflikte, Versionen – BILL-05, 06, 09…11, 14', () => {
  it('BILL-05: Regel braucht Quartal, nur Tagesdaten gelesen → nicht prüfbar', () => {
    const rule = testRule({
      required_context: [{ domain: 'billed_services', window: QUARTER }],
      frequency_limits: [{ max_count: 1, count_codes: ['TEST_SERVICE_10_MIN'], window: QUARTER, source_ids: ['TEST_SRC'] }],
    });
    const f = run(rule, input(ok12));
    expect(f.outcome).toBe('not_verifiable');
    expect(f.coverage.some((c) => !c.complete && c.required?.from === Q4.from)).toBe(true);
  });

  it('BILL-05b: Quartal vollständig gelesen, Limit erreicht → Konflikt', () => {
    const rule = testRule({
      procedure_codes: ['TEST_OTHER'],
      required_context: [{ domain: 'billed_services', window: QUARTER }],
      frequency_limits: [{ max_count: 1, count_codes: ['TEST_SERVICE_10_MIN'], window: QUARTER, source_ids: ['TEST_SRC'] }],
    });
    const f = run(rule, input(ok12, { coverage: fullCoverage(Q4.from, Q4.to), billedServices: [billed('TEST_SERVICE_10_MIN', '2026-10-05')] }));
    expect(f.outcome).toBe('billing_conflict');
  });

  it('Lückenhafte Abdeckung wird erkannt (zwei Teilbereiche mit Lücke)', () => {
    const rule = testRule({ required_context: [{ domain: 'billed_services', window: QUARTER }] });
    const coverage = [
      { domain: 'billed_services' as const, from: '2026-10-01', to: '2026-10-31' },
      { domain: 'billed_services' as const, from: '2026-11-02', to: '2026-12-31' },
    ];
    expect(run(rule, input(ok12, { coverage })).outcome).toBe('not_verifiable');
    coverage[1]!.from = '2026-11-01';
    expect(run(rule, input(ok12, { coverage })).outcome).toBe('candidate');
  });

  it('Behandlungsfall nicht identifiziert → nicht prüfbar statt Quartal anzunehmen', () => {
    const rule = testRule({ required_context: [{ domain: 'billed_services', window: { unit: 'treatment_case', lookback_periods: 0, anchor: 'service_date' } }] });
    expect(run(rule, input(ok12, { coverage: fullCoverage(Q4.from, Q4.to) })).outcome).toBe('not_verifiable');
  });

  it('BILL-06: jede Leistung mit der am Leistungsdatum gültigen Version', () => {
    const v1 = testRule({ version: '1', valid_from: '2026-01-01', valid_to: '2026-06-30' });
    const v2 = testRule({ version: '2', valid_from: '2026-07-01', valid_to: null });
    const march = input(ok12, { serviceDate: '2026-03-10', coverage: fullCoverage('2026-03-10', '2026-03-10') });
    expect(run(v1, march).outcome).toBe('candidate');
    expect(run(v2, march).outcome).toBe('not_applicable');
    expect(run(v2, input(ok12)).outcome).toBe('candidate');
  });

  it('BILL-09: unvereinbare Leistung bereits erfasst → Konflikt erklärt', () => {
    const rule = testRule({ combination_rules: [{ relationship: 'cannot_combine', with_codes: ['TEST_INCOMPATIBLE'], window: DAY, reason: 'Testausschluss', source_ids: ['TEST_SRC'] }] });
    const f = run(rule, input(ok12, { billedServices: [billed('TEST_INCOMPATIBLE')] }));
    expect(f.outcome).toBe('billing_conflict');
    expect(f.conflicts[0]).toMatch(/Testausschluss/);
  });

  it('requires_code: abhängiger Code fehlt → ausgeschlossen', () => {
    const rule = testRule({ combination_rules: [{ relationship: 'requires_code', with_codes: ['TEST_BASE'], window: DAY, reason: 'Testabhängigkeit', source_ids: ['TEST_SRC'] }] });
    expect(run(rule, input(ok12)).outcome).toBe('excluded');
    expect(run(rule, input(ok12, { billedServices: [billed('TEST_BASE')] })).outcome).toBe('candidate');
  });

  it('BILL-10: System nicht verfügbar → nicht anwendbar, kein Ersatzkatalog', () => {
    const f = run(testRule({ billing_system: 'GOAE' }), input(ok12), settings({ available_billing_systems: ['EBM'] }));
    expect(f.outcome).toBe('not_applicable');
  });

  it('BILL-11: Quelle unauflösbar → Aktivierung blockiert', () => {
    const rule = testRule({ eligibility: { kind: 'fact', field: 'service.status', operator: 'eq', value: 'performed', source_ids: ['MISSING'] } });
    const f = run(rule, input(ok12));
    expect(f.outcome).toBe('not_verifiable');
    expect(f.blockers.join(' ')).toMatch(/Quellenverweis nicht auflösbar/);
  });

  it('BILL-14 / Freigabe: ohne Freigabe der Abrechnungsprüfung nicht operativ', () => {
    const rule = testRule();
    rule.reviews.billing = { state: 'pending', reviewer: null, reviewed_at: null, rationale: null };
    expect(run(rule, input(ok12)).outcome).toBe('not_verifiable');
  });
});
