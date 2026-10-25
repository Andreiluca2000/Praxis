import { addDays, quarterEnd, quarterStart, yearEnd, yearStart } from '../domain/dates.js';
import type { CoverageEntry, ContextDomain, IsoDate, RuleWindow } from '../domain/types.js';

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/**
 * Zeitfenster relativ zum Leistungsdatum (BILLING_RULES.md, „Domenii temporale“).
 * `treatment_case` ist nicht mit dem Quartal gleichzusetzen → null (= nicht bestimmbar).
 * `visit` wird konservativ als Kalendertag des Leistungsdatums behandelt.
 */
export function resolveWindow(window: RuleWindow, serviceDate: IsoDate): DateRange | null {
  const n = window.lookback_periods;
  switch (window.unit) {
    case 'visit':
    case 'day':
      return { from: addDays(serviceDate, -n), to: serviceDate };
    case 'quarter':
      return { from: quarterStart(serviceDate, n), to: quarterEnd(serviceDate) };
    case 'year':
      return { from: yearStart(serviceDate, n), to: yearEnd(serviceDate) };
    case 'treatment_case':
      return null;
  }
}

/** Ist [from, to] lückenlos durch die gelesenen Bereiche der Domäne abgedeckt? */
export function isCovered(range: DateRange, domain: ContextDomain, coverage: CoverageEntry[]): boolean {
  const spans = coverage
    .filter((c) => c.domain === domain && c.from <= c.to)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  let cursor = range.from;
  for (const s of spans) {
    if (s.from > cursor) return false;
    if (s.to >= cursor) {
      if (s.to >= range.to) return true;
      cursor = addDays(s.to, 1);
    }
  }
  return false;
}
