import type { Finding, Outcome, ResultType, Tri } from '../domain/types.js';

export interface OutcomeInput {
  notApplicable: boolean;
  alreadyBilled: boolean;
  state: Tri;
  blocked: boolean;
  conflicts: boolean;
  incompleteCoverage: boolean;
}

/**
 * Reihenfolge ist bewusst:
 *  - eine nachweislich nicht erfüllte Pflichtbedingung schließt aus, auch wenn anderes unbekannt ist (BILL-12);
 *  - unbekannte Bedingungen oder unvollständige Daten führen nie zu einem positiven Ergebnis.
 */
export function classify(i: OutcomeInput): Outcome {
  if (i.notApplicable) return 'not_applicable';
  if (i.alreadyBilled) return 'already_billed';
  if (i.state === 'not_fulfilled') return 'excluded';
  if (i.blocked) return 'not_verifiable';
  if (i.conflicts) return 'billing_conflict';
  if (i.incompleteCoverage) return 'not_verifiable';
  if (i.state === 'unknown') return 'documentation_incomplete';
  return 'candidate';
}

export function categoryFor(outcome: Outcome, ruleType: ResultType): Finding['category'] {
  switch (outcome) {
    case 'candidate':
      return ruleType;
    case 'documentation_incomplete':
      return 'documentation_incomplete';
    case 'not_verifiable':
      return 'not_verifiable';
    case 'billing_conflict':
      return 'billing_conflict';
    case 'excluded':
    case 'already_billed':
    case 'not_applicable':
      return null;
  }
}
