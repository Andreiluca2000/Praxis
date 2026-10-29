import { quarterEnd, quarterStart } from '../domain/dates.js';
import type { BilledService, EvidenceRef, FactValue, Facts, IsoDate } from '../domain/types.js';

/**
 * Chroniker (EBM 03220/03221) und DMP: Fakten aus Diagnosen und Leistungen ableiten – nie aus Freitext.
 * - „Gesichert“ heißt Diagnosesicherheit G, so wie in DURIA dokumentiert; nichts wird ergänzt.
 * - Die Liste chronischer Erkrankungen ist Praxisinhalt mit eigener Freigabe (data/billing/reviewed/chronic-dx.json).
 *   Der EBM kennt für 03220 keine abschließende ICD-Liste; die Liste ist ein Auslöser, kein Normtext.
 * - Kontinuität (EBM S. 196: drei von vier Quartalen, persönliche Kontakte in zwei) nur mit bestätigtem Verlauf;
 *   fehlt er, bleibt der Fakt unbekannt → „nicht prüfbar“, nie „bereit“.
 */

export interface ChronicCategory { icd: string; label: string }

export interface ChronicList {
  schema_version: '1.0.0';
  list_id: string;
  version: string;
  review: { state: 'pending' | 'approved' | 'rejected'; reviewer: string | null; reviewed_at: string | null; rationale: string | null };
  basis: string;
  categories: ChronicCategory[];
  /** Kategorien für das DMP Diabetes mellitus Typ 2. */
  dm2_categories: string[];
}

export interface DxRecord { code: string; certainty: string | null; date: IsoDate | null; ref: string }

/**
 * Arzt-Patienten-Kontakt im Quartal: eine Versichertenpauschale (03000/03030) oder Versorgungspauschale (03100) –
 * sie setzt einen persönlichen Kontakt oder Videokontakt voraus (EBM 3.2.1, S. 179). Laborziffern allein zählen nicht.
 * Annahme der Praxis (docs/WELLE1_FREIGABE.md): ein solches Quartal gilt auch als „persönlicher Kontakt“.
 */
export const CONTACT_CODES = ['03000', '03030', '03100'];
export const PERSONAL_CONTACT_CODES = CONTACT_CODES;
const CONTINUITY_QUARTERS = 4;

const ICD = /^[A-Z]\d{2}/;
const category = (code: string) => (ICD.exec(code.trim().toUpperCase())?.[0] ?? null);

export function isApproved(list: ChronicList | null | undefined): list is ChronicList {
  return !!list && list.review.state === 'approved' && !!list.review.reviewer;
}

/** Strenge Formprüfung; Fehler → Liste wird nicht verwendet. */
export function chronicListErrors(data: unknown): string[] {
  const d = data as Partial<ChronicList> | null;
  const e: string[] = [];
  if (!d || typeof d !== 'object') return ['Liste fehlt.'];
  if (d.schema_version !== '1.0.0') e.push('schema_version muss 1.0.0 sein.');
  if (typeof d.list_id !== 'string' || typeof d.version !== 'string') e.push('list_id/version fehlen.');
  if (!d.review || !['pending', 'approved', 'rejected'].includes(d.review.state)) e.push('review.state ungültig.');
  if (d.review?.state === 'approved' && !d.review.reviewer) e.push('Freigabe ohne Prüfer.');
  const cats = Array.isArray(d.categories) ? d.categories : [];
  if (cats.length === 0) e.push('Keine Kategorien.');
  for (const c of cats) if (!c || !/^[A-Z]\d{2}$/.test(c.icd) || typeof c.label !== 'string') e.push(`Kategorie ungültig: ${JSON.stringify(c)}`);
  if (!Array.isArray(d.dm2_categories) || !d.dm2_categories.every((c) => /^[A-Z]\d{2}$/.test(c))) e.push('dm2_categories ungültig.');
  return e;
}

const confirmed = (value: FactValue['value'], evidence: EvidenceRef[]): FactValue => ({ value, verification: 'confirmed', evidence });

interface DeriveInput {
  serviceDate: IsoDate;
  services: BilledService[];
  diagnoses: DxRecord[];
  list: ChronicList;
  /** Bestätigt gelesener Zeitraum (Leistungen und Diagnosen) für den Verlauf; null = kein Verlauf. */
  history: { from: IsoDate; to: IsoDate } | null;
  /** Diagnosen ohne Datum gehören zum Quartal des Leistungsdatums (KVDT-Schein = ein Quartal). */
  undatedInQuarter?: boolean;
}

function inQuarter(d: DxRecord, from: IsoDate, to: IsoDate, undated: boolean): boolean {
  return d.date === null ? undated : d.date >= from && d.date <= to;
}

/** Gesicherte Diagnosen der Kategorien im Zeitraum. */
function securedIn(dx: DxRecord[], cats: Set<string>, from: IsoDate, to: IsoDate, undated: boolean): DxRecord[] {
  return dx.filter((d) => d.certainty?.toUpperCase() === 'G' && cats.has(category(d.code) ?? '') && inQuarter(d, from, to, undated));
}

export function deriveChronicFacts(i: DeriveInput): Facts {
  const from = quarterStart(i.serviceDate);
  const to = quarterEnd(i.serviceDate);
  const undated = i.undatedInQuarter ?? false;
  const chronicCats = new Set(i.list.categories.map((c) => c.icd));
  const current = securedIn(i.diagnoses, chronicCats, from, to, undated);
  const dm2 = securedIn(i.diagnoses, new Set(i.list.dm2_categories), from, to, undated);
  const ev = (d: DxRecord[]) => d.map((x) => ({ ref: x.ref, ...(x.date ? { recorded_on: x.date } : {}) }));

  // Keine gesicherte chronische Diagnose in den gelesenen Daten → „nein“ (kein Vorschlag), nicht „nicht prüfbar“.
  const facts: Facts = {
    'diagnosis.chronic_confirmed': confirmed(current.length > 0, ev(current)),
    'diagnosis.dm2_confirmed': confirmed(dm2.length > 0, ev(dm2)),
  };

  const oldest = quarterStart(i.serviceDate, CONTINUITY_QUARTERS - 1);
  if (current.length === 0 || !i.history || i.history.from > oldest || i.history.to < i.serviceDate) return facts;

  // Dieselbe gesicherte chronische Erkrankung: je Kategorie zählen, die beste Kategorie gilt.
  let best = { contacts: 0, personal: 0, evidence: [] as EvidenceRef[] };
  for (const cat of new Set(current.map((d) => category(d.code)!))) {
    let contacts = 0;
    let personal = 0;
    const evidence: EvidenceRef[] = [];
    for (let back = 0; back < CONTINUITY_QUARTERS; back++) {
      const qFrom = quarterStart(i.serviceDate, back);
      const qTo = back === 0 ? i.serviceDate : quarterEnd(qFrom);
      const dx = securedIn(i.diagnoses, new Set([cat]), qFrom, qTo, back === 0 && undated);
      const svc = i.services.filter((s) => s.state === 'active' && CONTACT_CODES.includes(s.code) && s.date >= qFrom && s.date <= qTo);
      // Aktuelles Quartal: der heutige Kontakt zählt (Pflichtinhalt der Regel), auch wenn 03000 noch nicht erfasst ist.
      if (dx.length === 0 || (svc.length === 0 && back !== 0)) continue;
      contacts++;
      if (svc.some((s) => PERSONAL_CONTACT_CODES.includes(s.code))) personal++;
      evidence.push(...ev(dx.slice(0, 1)), ...svc.slice(0, 1).flatMap((s) => s.evidence));
    }
    if (contacts > best.contacts || (contacts === best.contacts && personal > best.personal)) best = { contacts, personal, evidence };
  }
  facts['history.chronic_contact_quarters'] = confirmed(best.contacts, best.evidence);
  facts['history.personal_contact_quarters'] = confirmed(best.personal, best.evidence);

  // Ausnahme EBM S. 196: 03100 genau zwei Quartale vor dem aktuellen Quartal wegen derselben gesicherten Erkrankung.
  const twoFrom = quarterStart(i.serviceDate, 2);
  const twoTo = quarterEnd(twoFrom);
  const base = i.services.filter((s) => s.state === 'active' && s.code === '03100' && s.date >= twoFrom && s.date <= twoTo);
  const sameDx = securedIn(i.diagnoses, new Set(current.map((d) => category(d.code)!)), twoFrom, twoTo, false);
  const baseOk = base.length > 0 && sameDx.length > 0;
  facts['history.base_03100_two_quarters_before'] = confirmed(baseOk, baseOk ? [...base.flatMap((s) => s.evidence), ...ev(sameDx)] : []);
  return facts;
}
