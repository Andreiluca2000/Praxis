import type { RulePackage } from '../domain/types.js';
import { validateRulePackage } from '../validation/validate.js';
import { chronicListErrors, type ChronicList } from './chronic.js';

/**
 * Geprüfter Regelkatalog der Praxis (data/billing/reviewed/) neben dem DEMO-Beispiel.
 * - Ein fehlerhafter Katalog wird verworfen (fail-closed): operativ gibt es dann keine Ziffernvorschläge, nie halbe Regeln.
 * - Regeln wirken operativ erst mit status 'active' und ärztlicher Freigabe (gates.ts); vorher sind sie „nicht anwendbar“.
 * - Der Simulator rechnet weiter nur mit DEMO-Regeln.
 */

export interface Catalogue {
  reviewed: RulePackage | null;
  chronic: ChronicList | null;
  errors: string[];
}

export function loadCatalogue(reviewedJson: unknown, chronicJson: unknown): Catalogue {
  const errors: string[] = [];
  const v = validateRulePackage(reviewedJson);
  let reviewed: RulePackage | null = null;
  if (!v.ok || !v.value) errors.push(`Regelkatalog ungültig, nicht verwendet: ${v.errors.slice(0, 3).join('; ')}`);
  else if (v.value.content_kind !== 'reviewed_catalogue') errors.push('Regelkatalog ist kein „reviewed_catalogue“, nicht verwendet.');
  else reviewed = v.value;

  const ce = chronicListErrors(chronicJson);
  if (ce.length > 0) errors.push(`Liste chronischer Erkrankungen ungültig, nicht verwendet: ${ce.slice(0, 3).join('; ')}`);
  return { reviewed, chronic: ce.length === 0 ? (chronicJson as ChronicList) : null, errors };
}

/** Regeln für den Modus: Simulator → DEMO-Beispiel; operativ → geprüfter Katalog, sonst das (operativ wirkungslose) Beispiel. */
export function rulesFor(mode: 'operational' | 'simulation', example: RulePackage, catalogue: Catalogue): RulePackage {
  return mode === 'simulation' ? example : catalogue.reviewed ?? example;
}
