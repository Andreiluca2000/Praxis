import type { ConditionResult, Expression, FactExpression, Facts, Scalar, Tri } from '../domain/types.js';

/**
 * Dreiwertige Auswertung gemäß docs/BILLING_RULES.md, Abschnitt „Evaluare cu trei stări“.
 * Kein eval, keine impliziten Typumwandlungen. `unknown` wird nie zu true/false aufgelöst.
 */

export interface ExpressionResult {
  state: Tri;
  conditions: ConditionResult[];
}

function describe(e: FactExpression): string {
  const v = e.value === undefined ? '' : ` ${JSON.stringify(e.value)}`;
  return `${e.field} ${e.operator}${v}`;
}

function sameType(a: Scalar, b: Scalar): boolean {
  return typeof a === typeof b;
}

function evalFact(e: FactExpression, facts: Facts): ConditionResult {
  const base = { label: describe(e), source_ids: e.source_ids };
  const fact = facts[e.field];

  if (!fact) {
    return { ...base, state: 'unknown', reason: 'Fakt nicht vorhanden – wird nicht angenommen.', evidence: [] };
  }
  const evidence = fact.evidence;
  if (fact.contradictory) {
    return { ...base, state: 'unknown', reason: 'Widersprüchliche Angaben – Klärung erforderlich.', evidence };
  }
  if (fact.verification !== 'confirmed') {
    return { ...base, state: 'unknown', reason: 'Fakt nicht bestätigt (unsichere Extraktion).', evidence };
  }

  const actual = fact.value;
  const ok = (cond: boolean, reason: string): ConditionResult => ({
    ...base,
    state: cond ? 'fulfilled' : 'not_fulfilled',
    reason,
    evidence,
  });
  const typeError = (): ConditionResult => ({
    ...base,
    state: 'unknown',
    reason: `Typkonflikt: Fakt ist ${typeof actual}, Regel erwartet ${Array.isArray(e.value) ? 'Liste' : typeof e.value}.`,
    evidence,
  });

  switch (e.operator) {
    case 'is_known':
      return ok(true, 'Fakt vorhanden, bestätigt und widerspruchsfrei.');
    case 'eq':
    case 'neq': {
      const expected = e.value;
      if (expected === undefined || Array.isArray(expected) || !sameType(actual, expected)) return typeError();
      const equal = actual === expected;
      return ok(e.operator === 'eq' ? equal : !equal, `Wert ${JSON.stringify(actual)}.`);
    }
    case 'in': {
      const list = e.value;
      if (!Array.isArray(list) || !list.some((x) => sameType(x, actual))) return typeError();
      return ok(list.includes(actual), `Wert ${JSON.stringify(actual)}.`);
    }
    case 'gte':
    case 'lte': {
      const limit = e.value;
      if (typeof actual !== 'number' || typeof limit !== 'number' || !Number.isFinite(actual)) return typeError();
      return ok(e.operator === 'gte' ? actual >= limit : actual <= limit, `Wert ${actual}.`);
    }
  }
}

export function combineAll(states: Tri[]): Tri {
  if (states.includes('not_fulfilled')) return 'not_fulfilled';
  if (states.every((s) => s === 'fulfilled')) return 'fulfilled';
  return 'unknown';
}

export function combineAny(states: Tri[]): Tri {
  if (states.includes('fulfilled')) return 'fulfilled';
  if (states.every((s) => s === 'not_fulfilled')) return 'not_fulfilled';
  return 'unknown';
}

export function negate(state: Tri): Tri {
  if (state === 'fulfilled') return 'not_fulfilled';
  if (state === 'not_fulfilled') return 'fulfilled';
  return 'unknown';
}

export function evaluateExpression(expr: Expression, facts: Facts): ExpressionResult {
  switch (expr.kind) {
    case 'fact': {
      const c = evalFact(expr, facts);
      return { state: c.state, conditions: [c] };
    }
    case 'all':
    case 'any': {
      const parts = expr.items.map((i) => evaluateExpression(i, facts));
      const states = parts.map((p) => p.state);
      return {
        state: expr.kind === 'all' ? combineAll(states) : combineAny(states),
        conditions: parts.flatMap((p) => p.conditions),
      };
    }
    case 'not': {
      const inner = evaluateExpression(expr.item, facts);
      return {
        state: negate(inner.state),
        conditions: inner.conditions.map((c) => ({ ...c, label: `NICHT (${c.label})` })),
      };
    }
  }
}
