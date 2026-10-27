import type { DuriaSnapshot } from '../duria/adapter.js';
import { checkPairs, type PairReport, type PairRegistry, type SeparateConfirmation } from '../engine/pairs.js';

/**
 * Paare „nicht nebeneinander je Sitzung“ für die erfassten Leistungen des geöffneten Patienten.
 * Entwurfs-Dossier → nur im Simulator; `null`, wenn nicht geprüft wird (operativ oder kein Dossier).
 * Ein HZV-Fall wird nicht geprüft (Selektivvertrag erbt keine EBM-/GOÄ-Paare).
 */
export function patientPairs(
  snapshot: DuriaSnapshot,
  reg: PairRegistry | null,
  opts: { mode: 'operational' | 'simulation'; hzvContractId: string | null; confirmedSeparate?: ReadonlyMap<string, SeparateConfirmation> | undefined },
): PairReport | null {
  if (opts.mode !== 'simulation' || !reg) return null;
  return checkPairs(snapshot.services, reg, { hzv: opts.hzvContractId !== null, confirmedSeparate: opts.confirmedSeparate });
}
