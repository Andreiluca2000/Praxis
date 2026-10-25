import { inRange } from '../domain/dates.js';
import type { ConditionResult, EvaluationInput, PracticeSettings, Rule } from '../domain/types.js';
import type { GateResult } from './gates.js';

/**
 * HZV-Vorprüfung (BILLING_RULES.md „NRW și HZV“, ACCEPTANCE.md HZV-01…06).
 * Aktivierung des Moduls ist keine Teilnahme; fehlende Nachweise führen nie zum EBM-Fallback.
 */
export function checkHzv(rule: Rule, input: EvaluationInput, settings: PracticeSettings, g: GateResult): void {
  const date = input.serviceDate;
  if (!settings.hzv.enabled) {
    g.notApplicable.push('HZV-Modul ist deaktiviert.');
    return;
  }
  const contract = settings.hzv.contracts.find((c) => c.contract_id === rule.contract_id);
  if (!contract) {
    g.blockers.push(`HZV-Vertrag ${rule.contract_id ?? '(fehlt)'} ist nicht konfiguriert.`);
    return;
  }
  if (!inRange(date, contract.valid_from, contract.valid_to)) {
    g.notApplicable.push(`HZV-Vertrag ${contract.contract_id} gilt nicht am ${date}.`);
    return;
  }
  if (contract.terms_review_status !== 'approved') {
    g.blockers.push(`Vertragsbedingungen ${contract.contract_id} nicht freigegeben.`);
  }
  if (settings.region.kv !== null && contract.kv !== settings.region.kv) {
    g.notApplicable.push(`HZV-Vertrag gehört zur KV ${contract.kv}.`);
  }

  const pp = contract.practice_participation;
  if (pp.status === 'not_participating') {
    g.notApplicable.push('Praxis nimmt an diesem HZV-Vertrag nicht teil.');
  } else if (pp.status !== 'confirmed' || pp.valid_from === null || !inRange(date, pp.valid_from, pp.valid_to)) {
    g.blockers.push('Teilnahme der Praxis am Leistungsdatum nicht belegt (Menüauswahl ist kein Nachweis).');
  }

  if (!input.hzvContractId) {
    g.blockers.push('Einschreibung des Patienten unbekannt – wird nicht angenommen.');
  } else if (input.hzvContractId !== contract.contract_id) {
    g.notApplicable.push('Fall gehört zu einem anderen HZV-Vertrag.');
  }

  // Einschreibung muss für das Leistungsdatum belegt sein (nicht nur „heute“).
  const enr = input.facts['contract.patient_enrollment'];
  let state: ConditionResult['state'] = 'unknown';
  let reason = 'Einschreibung am Leistungsdatum nicht belegt.';
  if (enr && enr.verification === 'confirmed' && !enr.contradictory && typeof enr.value === 'boolean') {
    state = enr.value ? 'fulfilled' : 'not_fulfilled';
    reason = enr.value ? 'Einschreibung am Leistungsdatum belegt.' : 'Patient am Leistungsdatum nicht eingeschrieben.';
  }
  g.implicit.push({
    label: 'contract.patient_enrollment am Leistungsdatum',
    state,
    reason,
    evidence: enr?.evidence ?? [],
    source_ids: [],
  });
}
