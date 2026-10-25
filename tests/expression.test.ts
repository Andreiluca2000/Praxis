import { describe, expect, it } from 'vitest';
import { combineAll, combineAny, evaluateExpression, negate } from '../src/engine/expression.js';
import type { Tri } from '../src/domain/types.js';
import { confirmed, fact } from './fixtures.js';

const T: Tri = 'fulfilled';
const F: Tri = 'not_fulfilled';
const U: Tri = 'unknown';

describe('dreiwertige Logik (BILLING_RULES.md, Akzeptanz Nr. 6)', () => {
  it('all', () => {
    expect(combineAll([T, T])).toBe(T);
    expect(combineAll([T, U])).toBe(U);
    expect(combineAll([U, F])).toBe(F);
  });
  it('any', () => {
    expect(combineAny([F, T])).toBe(T);
    expect(combineAny([F, F])).toBe(F);
    expect(combineAny([F, U])).toBe(U);
  });
  it('not(unknown) bleibt unknown', () => {
    expect(negate(U)).toBe(U);
    expect(negate(T)).toBe(F);
    expect(negate(F)).toBe(T);
  });
});

describe('Faktenauswertung', () => {
  const dur = fact('documentation.duration_minutes', 'gte', 10);

  it('fehlender Fakt → unknown, nie false', () => {
    expect(evaluateExpression(dur, {}).state).toBe(U);
  });
  it('unsichere Extraktion → unknown', () => {
    const r = evaluateExpression(dur, { 'documentation.duration_minutes': { value: 30, verification: 'uncertain', evidence: [] } });
    expect(r.state).toBe(U);
  });
  it('Widerspruch bleibt sichtbar als unknown (Akzeptanz Nr. 12)', () => {
    const r = evaluateExpression(dur, { 'documentation.duration_minutes': { ...confirmed(30), contradictory: true } });
    expect(r.state).toBe(U);
    expect(r.conditions[0]?.reason).toMatch(/Widersprüchlich/);
  });
  it('Typkonflikt ohne implizite Umwandlung', () => {
    const r = evaluateExpression(dur, { 'documentation.duration_minutes': confirmed('12') });
    expect(r.state).toBe(U);
    expect(r.conditions[0]?.reason).toMatch(/Typkonflikt/);
  });
  it('Null ist ein bekannter Wert', () => {
    expect(evaluateExpression(fact('documentation.duration_minutes', 'is_known'), { 'documentation.duration_minutes': confirmed(0) }).state).toBe(T);
    expect(evaluateExpression(dur, { 'documentation.duration_minutes': confirmed(0) }).state).toBe(F);
  });
  it('in / neq', () => {
    const facts = { 'service.status': confirmed('planned') };
    expect(evaluateExpression(fact('service.status', 'in', ['performed', 'external']), facts).state).toBe(F);
    expect(evaluateExpression(fact('service.status', 'neq', 'performed'), facts).state).toBe(T);
  });
  it('Belege werden durchgereicht', () => {
    const r = evaluateExpression(dur, { 'documentation.duration_minutes': confirmed(12, 'note#7') });
    expect(r.conditions[0]?.evidence).toEqual([{ ref: 'note#7' }]);
  });
});
