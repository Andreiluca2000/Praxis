import { describe, expect, it } from 'vitest';
import { evaluateRule } from '../src/engine/evaluate.js';
import { billed, confirmed, DATE, fact, input, settings, testRule } from './fixtures.js';

const run = (rule = testRule(), inp = input({}), s = settings()) => evaluateRule(rule, inp, s, 'operational');
const performed = { 'service.status': confirmed('performed', 'note#status') };
const ok12 = { ...performed, 'documentation.duration_minutes': confirmed(12, 'note#dur') };

describe('Abrechnungsprüfung – ACCEPTANCE.md BILL-01…04, 07…08, 12', () => {
  it('BILL-01: erbracht, 12 Minuten, kein Duplikat → Kandidat mit Belegen je Bedingung', () => {
    const f = run(testRule(), input(ok12));
    expect(f.outcome).toBe('candidate');
    expect(f.category).toBe('possible_missing_code');
    expect(f.requiresHumanConfirmation).toBe(true);
    expect(f.conditions.every((c) => c.state === 'fulfilled' && c.evidence.length > 0)).toBe(true);
  });

  it('BILL-02: ohne Dauer → Dokumentation unvollständig, kein positives Ergebnis', () => {
    const f = run(testRule(), input(performed));
    expect(f.outcome).toBe('documentation_incomplete');
    expect(f.conditions.find((c) => c.label.startsWith('documentation.duration'))?.state).toBe('unknown');
  });

  it('BILL-03: 7 Minuten → Bedingung nicht erfüllt, Kandidat ausgeschlossen', () => {
    expect(run(testRule(), input({ ...performed, 'documentation.duration_minutes': confirmed(7) })).outcome).toBe('excluded');
  });

  it('BILL-04: bereits erfasst → keine doppelte Empfehlung, bestehender Eintrag sichtbar', () => {
    const f = run(testRule(), input(ok12, { billedServices: [billed('TEST_SERVICE_10_MIN')] }));
    expect(f.outcome).toBe('already_billed');
    expect(f.existingEntries).toHaveLength(1);
  });

  it('BILL-04b: stornierter Eintrag zählt nicht', () => {
    const f = run(testRule(), input(ok12, { billedServices: [billed('TEST_SERVICE_10_MIN', DATE, 'cancelled')] }));
    expect(f.outcome).toBe('candidate');
  });

  it('BILL-07: Pflicht-Qualifikation nicht konfiguriert → unbekannt, keine günstige Annahme', () => {
    const rule = testRule({
      eligibility: { kind: 'all', items: [fact('service.status', 'eq', 'performed'), fact('practice.required_qualification', 'eq', true)] },
    });
    expect(run(rule, input(performed)).outcome).toBe('documentation_incomplete');
  });

  it('BILL-08: Diagnose ohne Leistungsfakt → kein Leistungscode', () => {
    expect(run(testRule(), input({})).outcome).not.toBe('candidate');
  });

  it('BILL-12: eine Pflichtbedingung falsch, andere unbekannt → ausgeschlossen', () => {
    expect(run(testRule(), input({ 'service.status': confirmed('refused') })).outcome).toBe('excluded');
  });

  it('Akzeptanz Nr. 3: geplant/abgelehnt/extern erfüllt „performed“ nicht', () => {
    for (const s of ['planned', 'refused', 'external']) {
      const f = run(testRule(), input({ 'service.status': confirmed(s), 'documentation.duration_minutes': confirmed(30) }));
      expect(f.outcome).toBe('excluded');
    }
  });
});
