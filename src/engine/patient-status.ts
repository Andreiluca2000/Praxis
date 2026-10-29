import { quarterStart } from '../domain/dates.js';
import type { BilledService, CoverageEntry, IsoDate } from '../domain/types.js';
import { CONTACT_CODES } from './chronic.js';
import { isCovered } from './windows.js';

/**
 * Neupatient und erster Kontakt im Quartal – nur Information, keine eigene Ziffer.
 * - Neupatient = in der Praxis noch nie gesehen. Die frühere TSVG-Neupatientenregelung ist seit 01.01.2023 aufgehoben
 *   (GKV-Finanzstabilisierungsgesetz); es gibt dafür keine Ziffer mehr.
 * - „Nie gesehen“ lässt sich nur aus dem ganzen Verlauf sagen: ein früherer Kontakt beweist „bekannt“, sein Fehlen
 *   beweist ohne bestätigten Verlauf nichts → „nicht prüfbar“, mit Verlauf nur „kein Kontakt seit …“.
 * - Erster Kontakt im Quartal (→ Versichertenpauschale 03000) braucht das ganze Quartal bis heute.
 */

export type Neupatient =
  | { status: 'bekannt'; letzterKontakt: IsoDate }
  | { status: 'kein_frueherer_kontakt'; seit: IsoDate }
  | { status: 'nicht_pruefbar' };

export interface PatientStatus {
  neupatient: Neupatient;
  /** true/false nur mit vollständig gelesenem Quartal bis zum Vortag; sonst null. */
  ersterKontaktImQuartal: boolean | null;
}

export function patientStatus(i: {
  serviceDate: IsoDate;
  services: BilledService[];
  coverage: CoverageEntry[];
  history: { from: IsoDate; to: IsoDate } | null;
}): PatientStatus {
  const earlier = i.services.filter((s) => s.state === 'active' && s.date < i.serviceDate).map((s) => s.date).sort();
  const last = earlier[earlier.length - 1];
  const neupatient: Neupatient = last
    ? { status: 'bekannt', letzterKontakt: last }
    : i.history && i.history.to >= i.serviceDate ? { status: 'kein_frueherer_kontakt', seit: i.history.from } : { status: 'nicht_pruefbar' };

  const qFrom = quarterStart(i.serviceDate);
  const beforeToday = i.services.some((s) => s.state === 'active' && CONTACT_CODES.includes(s.code) && s.date >= qFrom && s.date < i.serviceDate);
  const quarterRead = isCovered({ from: qFrom, to: i.serviceDate }, 'billed_services', i.coverage);
  return { neupatient, ersterKontaktImQuartal: beforeToday ? false : quarterRead ? true : null };
}
