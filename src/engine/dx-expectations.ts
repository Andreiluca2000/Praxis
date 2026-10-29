import type { BilledService, IsoDate } from '../domain/types.js';
import { CONTACT_CODES, type ChronicList, type DxRecord } from './chronic.js';

/**
 * R1 (docs/PLAN_WETTBEWERB_20261029.md): Diagnose ↔ Ziffern im selben Quartal, nur als Hinweis.
 * - Zuschlag 03220/03221 ohne gesicherte chronische Diagnose → „Begründung fehlt“.
 * - Gesicherte chronische Diagnose mit Kontakt, aber ohne 03220 → „vermutlich vergessen“ (Kontinuität separat prüfen).
 * - Gesicherter Diabetes Typ 2 ohne DMP-Ziffer → nur prüfen, ob der Patient im DMP eingeschrieben ist.
 * Setzt nie etwas automatisch; die Liste muss freigegeben sein (Aufrufer prüft `isApproved`).
 */

export type DxExpectationKind = 'zuschlag_ohne_diagnose' | 'chroniker_ohne_zuschlag' | 'dmp_ohne_ziffer';

export interface DxExpectation {
  kind: DxExpectationKind;
  codes: string[];
  icd: string[];
  text: string;
}

export const CHRONIKER_CODES = ['03220', '03221'];
/** DMP Diabetes mellitus Typ 2, KV Nordrhein: Einschreibe- und Folgedokumentationspauschale (§ 2 Abs. 2 Vergütungsvereinbarung). */
export const DMP_DM2_NORDRHEIN_CODES = ['90324', '90325', '90325D'];

const cat = (code: string) => code.trim().toUpperCase().slice(0, 3);

export function checkChronicCoding(i: {
  services: BilledService[];
  diagnoses: DxRecord[];
  list: ChronicList;
  quarter: { from: IsoDate; to: IsoDate };
  /** Diagnosen ohne Datum gehören zum Quartal (KVDT-Schein). */
  undatedInQuarter: boolean;
  /** DMP-Hinweis nur mit bekannter KV (die Ziffern sind regional). */
  kv: 'Nordrhein' | 'Westfalen-Lippe' | null;
  /** „Fertig“ läuft nach einer Behandlung: der heutige Kontakt zählt, auch wenn 03000 noch nicht erfasst ist. */
  contactToday?: boolean;
}): DxExpectation[] {
  const out: DxExpectation[] = [];
  const inQ = (d: IsoDate | null) => (d === null ? i.undatedInQuarter : d >= i.quarter.from && d <= i.quarter.to);
  const services = i.services.filter((s) => s.state === 'active' && inQ(s.date));
  const secured = i.diagnoses.filter((d) => d.certainty?.toUpperCase() === 'G' && inQ(d.date));
  const chronicCats = new Set(i.list.categories.map((c) => c.icd));
  const chronic = [...new Set(secured.map((d) => d.code.toUpperCase()).filter((c) => chronicCats.has(cat(c))))];
  const billed = (codes: string[]) => [...new Set(services.filter((s) => codes.includes(s.code)).map((s) => s.code))];
  // Nur Fälle mit Arzt-Patienten-Kontakt (Versicherten-/Versorgungspauschale), nicht reine Labor- oder Formularfälle.
  const contact = (i.contactToday ?? false) || billed(CONTACT_CODES).length > 0;

  const zuschlag = billed(CHRONIKER_CODES);
  if (zuschlag.length > 0 && chronic.length === 0) {
    out.push({
      kind: 'zuschlag_ohne_diagnose', codes: zuschlag, icd: [],
      text: `${zuschlag.join(', ')} ohne gesicherte (G) chronische Diagnose im Quartal – Begründung prüfen.`,
    });
  }
  if (chronic.length > 0 && contact && !zuschlag.includes('03220')) {
    out.push({
      kind: 'chroniker_ohne_zuschlag', codes: ['03220'], icd: chronic,
      text: `Gesicherte chronische Diagnose (${chronic.join(', ')}) ohne 03220 – Chroniker-Zuschlag prüfen. Kontinuität (3 von 4 Quartalen, EBM S. 196) braucht die Vorquartale.`,
    });
  }
  const dm2Cats = new Set(i.list.dm2_categories);
  const dm2 = [...new Set(secured.map((d) => d.code.toUpperCase()).filter((c) => dm2Cats.has(cat(c))))];
  if (i.kv === 'Nordrhein' && dm2.length > 0 && contact && billed(DMP_DM2_NORDRHEIN_CODES).length === 0) {
    out.push({
      kind: 'dmp_ohne_ziffer', codes: ['90325'], icd: dm2,
      text: `Diabetes Typ 2 gesichert (${dm2.join(', ')}) ohne DMP-Ziffer – nur falls im DMP eingeschrieben: Folgedokumentation 90325 (bzw. Einschreibung 90324) prüfen.`,
    });
  }
  return out;
}
