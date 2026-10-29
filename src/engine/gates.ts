import { inRange } from '../domain/dates.js';
import type { ConditionResult, EvaluationInput, PracticeSettings, Rule } from '../domain/types.js';
import { semanticRuleErrors } from '../validation/validate.js';
import { checkHzv } from './hzv.js';

export type Mode = 'operational' | 'simulation';

/**
 * Vorprüfungen vor der Ausdrucksauswertung (BILLING_RULES.md: Aktivierung, Quellen, Version,
 * Region und Vertrag werden zuerst geprüft).
 *  - notApplicable: Regel passt nicht (Datum/System/Region/Vertrag) → kein Ergebnis.
 *  - blockers: Regel könnte passen, aber Konfiguration/Nachweis fehlt → nicht prüfbar.
 *  - implicit: zusätzliche Pflichtbedingungen (z. B. HZV-Einschreibung am Leistungsdatum).
 */
export interface GateResult {
  notApplicable: string[];
  blockers: string[];
  implicit: ConditionResult[];
}

function activationProblems(rule: Rule): string[] {
  const problems = semanticRuleErrors(rule);
  if (rule.billing_system === 'DEMO') problems.push('DEMO-Regeln sind nie operativ.');
  if (rule.reviews.billing.state !== 'approved') problems.push('Abrechnungsprüfung nicht freigegeben.');
  if (!['approved', 'not_applicable'].includes(rule.reviews.clinical.state)) problems.push('Klinische Prüfung fehlt.');
  for (const s of rule.sources) {
    if (s.kind === 'synthetic') problems.push(`Quelle ${s.id} ist synthetisch.`);
    if (!['permitted_for_local_use', 'permitted_for_distribution'].includes(s.license_status)) {
      problems.push(`Nutzungsrechte für Quelle ${s.id} ungeklärt.`);
    }
  }
  return problems;
}

export function checkGates(rule: Rule, input: EvaluationInput, settings: PracticeSettings, mode: Mode): GateResult {
  const g: GateResult = { notApplicable: [], blockers: [], implicit: [] };
  const date = input.serviceDate;

  // 1. Version nach Leistungsdatum, nicht nach Ausführungsdatum.
  if (!inRange(date, rule.valid_from, rule.valid_to)) {
    g.notApplicable.push(`Regelversion ${rule.version} gilt nicht am ${date}.`);
  }

  // 2. Aktivierung / Modus.
  if (mode === 'simulation') {
    if (rule.billing_system !== 'DEMO') g.notApplicable.push('Simulation akzeptiert nur DEMO-Regeln.');
  } else if (rule.status !== 'active') {
    g.notApplicable.push(`Regel ist „${rule.status}“ und nimmt nicht an operativen Prüfungen teil.`);
  } else {
    for (const p of activationProblems(rule)) g.blockers.push(`Aktivierung unzulässig: ${p}`);
  }

  // 3. Abrechnungssystem.
  if ((rule.billing_system === 'EBM' || rule.billing_system === 'GOAE') && !settings.available_billing_systems.includes(rule.billing_system)) {
    g.notApplicable.push(`${rule.billing_system} ist in den Praxiseinstellungen nicht verfügbar.`);
  }

  // 4. Region (KV) – nie stillschweigend Nordrhein annehmen.
  if (rule.jurisdiction === 'Nordrhein' || rule.jurisdiction === 'Westfalen-Lippe') {
    if (settings.region.kv === null) g.blockers.push('KV nicht konfiguriert – regionale Regel nicht prüfbar.');
    else if (settings.region.kv !== rule.jurisdiction) g.notApplicable.push(`Regel gilt für KV ${rule.jurisdiction}.`);
  }

  // 5. HZV-Regeln.
  if (rule.billing_system === 'HZV') checkHzv(rule, input, settings, g);

  // 6. HZV-Teilnahme unbekannt: EBM-Vorschlag nicht prüfbar (keine stille Annahme „kein HZV“).
  if (rule.billing_system === 'EBM' && !input.hzvContractId && input.hzvStatus === 'unknown') {
    g.blockers.push('HZV-Teilnahme des Patienten unbekannt – EBM-Vorschlag nicht prüfbar. Bitte HZV-Status klären.');
  } else if (rule.billing_system === 'EBM' && !input.hzvContractId && input.hzvStatus === 'enrolled') {
    g.blockers.push('Patient in der HZV, Vertrag unbekannt – EBM-Vorschlag nicht prüfbar.');
  }

  // 7. EBM-Regel in einem HZV-Fall: kein automatischer Wechsel, Ziffernkranz je Leistung prüfen.
  if (rule.billing_system === 'EBM' && input.hzvContractId) {
    const inc = input.facts['contract.service_included'];
    if (!inc || inc.verification !== 'confirmed' || inc.contradictory || typeof inc.value !== 'boolean') {
      g.blockers.push('HZV-Fall: Ob die Leistung im Vertrag enthalten ist, ist unbekannt – kein automatischer EBM-Weg.');
    } else if (inc.value) {
      g.blockers.push('HZV-Fall: Leistung ist laut Vertrag enthalten – mögliche Doppelabrechnung über EBM.');
    }
  }
  return g;
}
