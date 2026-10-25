import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluatePackage, evaluateRule, isFindingStale } from '../src/engine/evaluate.js';
import type { RulePackage } from '../src/domain/types.js';
import { validateRulePackage, validateSettings } from '../src/validation/validate.js';
import { confirmed, DATE, input, Q4, settings, testRule } from './fixtures.js';

const ok12 = { 'service.status': confirmed('performed'), 'documentation.duration_minutes': confirmed(12) };
const json = (p: string): unknown => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

describe('Konfiguration – ACCEPTANCE.md CFG-01…03', () => {
  it('CFG-01: Standardeinstellungen gültig (NRW, KV null, HZV aus, EBM+GOÄ getrennt)', () => {
    const r = validateSettings(json('config/practice.example.json'));
    expect(r.ok).toBe(true);
    expect(r.value?.region.kv).toBeNull();
    expect(r.value?.hzv.enabled).toBe(false);
    expect(r.value?.available_billing_systems).toEqual(['EBM', 'GOAE']);
  });

  it('CFG-01b: Sicherheitsflags lassen sich nicht lockern', () => {
    const s = json('config/practice.example.json') as { safety: { auto_submit_billing: boolean } };
    s.safety.auto_submit_billing = true;
    expect(validateSettings(s).ok).toBe(false);
  });

  it('CFG-02 / Akzeptanz Nr. 7: KV fehlt → regionale Regel nicht prüfbar, nie Nordrhein annehmen', () => {
    const f = evaluateRule(testRule({ jurisdiction: 'Nordrhein' }), input(ok12), settings(), 'operational');
    expect(f.outcome).toBe('not_verifiable');
    expect(f.blockers.join(' ')).toMatch(/KV nicht konfiguriert/);
  });

  it('CFG-02b: bundesweite Regel bleibt ohne KV nutzbar', () => {
    expect(evaluateRule(testRule({ jurisdiction: 'DE' }), input(ok12), settings(), 'operational').outcome).toBe('candidate');
  });

  it('CFG-03: KV-Wechsel macht frühere Ergebnisse veraltet und ändert die Neuberechnung', () => {
    const nr = settings({ region: { country: 'DE', bundesland: 'NRW', kv: 'Nordrhein' } });
    const wl = settings({ region: { country: 'DE', bundesland: 'NRW', kv: 'Westfalen-Lippe' } });
    const rule = testRule({ jurisdiction: 'Nordrhein' });
    const f = evaluateRule(rule, input(ok12), nr, 'operational');
    expect(f.outcome).toBe('candidate');
    expect(isFindingStale(f, nr)).toBe(false);
    expect(isFindingStale(f, wl)).toBe(true);
    expect(evaluateRule(rule, input(ok12), wl, 'operational').outcome).toBe('not_applicable');
  });
});

describe('DEMO / Simulation – BILLING_RULES.md Akzeptanz Nr. 1, 10', () => {
  const demo = (): RulePackage => json('data/billing/rules.example.json') as RulePackage;

  it('mitgeliefertes DEMO-Paket ist gültig, aber operativ wirkungslos', () => {
    expect(validateRulePackage(demo()).ok).toBe(true);
    expect(evaluatePackage(demo(), input(ok12), settings(), 'operational')).toEqual([]);
  });

  it('DEMO nur im sichtbar markierten Simulator (Regel verlangt Quartalsdaten)', () => {
    const facts = { ...ok12, 'documentation.required_components_complete': confirmed(true) };
    const dayOnly = evaluatePackage(demo(), input(facts), settings(), 'simulation')[0];
    expect(dayOnly?.simulated).toBe(true);
    expect(dayOnly?.outcome).toBe('not_verifiable');
    const coverage = [
      { domain: 'documentation' as const, from: DATE, to: DATE },
      { domain: 'billed_services' as const, from: Q4.from, to: Q4.to },
    ];
    const [f] = evaluatePackage(demo(), input(facts, { coverage }), settings(), 'simulation');
    expect(f?.outcome).toBe('candidate');
    expect(f?.category).toBe('documentation_incomplete'); // Regeltyp der DEMO-Regel, keine Ziffer
  });

  it('DEMO-Regel lässt sich nicht per Flag auf „active“ setzen', () => {
    const forged = demo();
    forged.rules[0]!.status = 'active';
    expect(validateRulePackage(forged).ok).toBe(false);
  });

  it('Simulator wertet echte (Nicht-DEMO) Regeln nicht aus', () => {
    expect(evaluateRule(testRule(), input(ok12), settings(), 'simulation').outcome).toBe('not_applicable');
  });

  it('doppelte bzw. überlappende Versionen werden abgelehnt', () => {
    const dup = demo();
    dup.rules.push(structuredClone(dup.rules[0]!));
    expect(validateRulePackage(dup).errors.join(' ')).toMatch(/doppelt/);
    const overlap = demo();
    overlap.rules.push({ ...structuredClone(overlap.rules[0]!), version: '0.2.0' });
    expect(validateRulePackage(overlap).errors.join(' ')).toMatch(/überschneidet sich/);
  });

  it('umgekehrter Gültigkeitszeitraum blockiert', () => {
    const bad = demo();
    bad.rules[0]!.valid_to = '2026-01-01';
    expect(validateRulePackage(bad).errors.join(' ')).toMatch(/Zeitraum umgekehrt/);
  });
});
