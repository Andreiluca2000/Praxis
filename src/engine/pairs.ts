import type { BilledService, IsoDate } from '../domain/types.js';

/**
 * Paarprüfung „nicht nebeneinander in derselben Sitzung“ aus dem Codex-Dossier
 * `data/billing/scope-resolutions/rules.review.json` (Entwurf, nicht freigegeben).
 *
 * - Die Sitzung ist nicht der Kalendertag: zwei Leistungen gehören nur dann sicher zur selben Sitzung,
 *   wenn beide dieselbe Sitzungskennung tragen (KVDT/BDT FK 5006 „Uhrzeit“).
 * - Fehlt die Kennung oder ist sie verschieden, bleibt die Sitzung unbekannt: verschiedene Uhrzeiten belegen
 *   allein keine getrennte Sitzung (unterbrochene Konsultation, Laboranalyse nach dem Gehen) → „nicht prüfbar“.
 * - Paare mit Ausnahme-Verweis (`exception_record_ids`) ergeben nie einen Ausschluss ohne Prüfung der Ausnahme.
 * - Getrennte Sitzungen gelten nur, wenn ein Mensch sie als dokumentiert bestätigt (`confirmedSeparate`, mit wem/wann) –
 *   nie automatisch aus der Uhrzeit. Bei gleicher Sitzungskennung bleibt der Ausschluss trotz Bestätigung bestehen.
 * - Das Dossier enthält nur Paare mit Sitzungs-/Inanspruchnahme-Bezug. Ein fehlendes Paar heißt NICHT „kombinierbar“;
 *   Ausschlüsse je Tag, Behandlungsfall oder postoperativer Frist stehen in anderen Dossiers.
 */

export const ACCEPTED_PAIR_SCHEMAS = ['1.11.0'];

export type PairSystem = 'EBM' | 'GOAE';
export type PairScope = 'session' | 'inanspruchnahme';

export interface PairEvidence {
  locator: string;
  anchor: string;
  url?: string;
  page?: number;
}

export interface PairClause {
  id: string;
  system: PairSystem;
  scope: PairScope;
  codes: [string, string];
  exceptionIds: string[];
  evidence: PairEvidence[];
}

export interface PairRegistry {
  schemaVersion: string;
  validFrom: IsoDate;
  validTo: IsoDate;
  clauses: PairClause[];
  /** Schlüssel `SYSTEM:a|b` (a < b). */
  index: Map<string, PairClause>;
  /** Ausnahme-Kennung → Belegtext aus dem Quell-Dossier (deutscher Normtext). */
  exceptions: Map<string, PairEvidence[]>;
}

export type PairVerdict = 'excluded' | 'not_verifiable' | 'exception_review' | 'separate_confirmed';

/** Bestätigung „getrennte Sitzungen dokumentiert“ durch eine berechtigte Person (Kürzel, Zeitpunkt). */
export interface SeparateConfirmation {
  by: string;
  at: string;
}

/** Schlüssel einer Bestätigung: Klausel und Leistungstag. */
export const confirmationKey = (clauseId: string, date: IsoDate) => `${clauseId}@${date}`;

export interface PairFinding {
  clauseId: string;
  system: PairSystem;
  date: IsoDate;
  codes: [string, string];
  verdict: PairVerdict;
  sessionNote: string;
  text: string;
  evidence: PairEvidence[];
  exceptions: { id: string; evidence: PairEvidence[] }[];
  confirmation: SeparateConfirmation | null;
  status: 'draft';
}

export interface PairReport {
  findings: PairFinding[];
  /** Leistungstage außerhalb des Geltungszeitraums des Dossiers (nicht geprüft). */
  outOfRange: number;
  skipped: string | null;
}

const key = (system: string, a: string, b: string) => (a < b ? `${system}:${a}|${b}` : `${system}:${b}|${a}`);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is IsoDate => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function readEvidence(list: unknown): PairEvidence[] {
  if (!Array.isArray(list)) return [];
  return list.filter(isObj).map((e) => ({
    locator: String(e.locator ?? ''),
    anchor: String(e.anchor ?? ''),
    ...(typeof e.url === 'string' ? { url: e.url } : {}),
    ...(typeof e.page === 'number' ? { page: e.page } : {}),
  }));
}

/**
 * Liest das Dossier streng (fail-closed): unbekannte Schemafassung, freigegebener/operativer Status oder eine
 * einzige fehlerhafte Klausel → kein Register. `exceptionSources` = Dossiers mit den Ausnahme-Klauseln (z. B. wounds).
 */
export function loadPairRegistry(raw: unknown, exceptionSources: unknown[] = []): PairRegistry | { error: string } {
  if (!isObj(raw)) return { error: 'Dossier ist kein Objekt.' };
  if (!ACCEPTED_PAIR_SCHEMAS.includes(String(raw.schema_version))) return { error: `Schemafassung ${String(raw.schema_version)} wird nicht unterstützt.` };
  if (raw.status !== 'draft' || raw.operational !== false) return { error: 'Dossier ist nicht als Entwurf gekennzeichnet.' };
  if (!isDate(raw.valid_from) || !isDate(raw.valid_to) || raw.valid_from > raw.valid_to) return { error: 'Geltungszeitraum fehlt oder ist ungültig.' };
  if (!Array.isArray(raw.clauses)) return { error: 'Klauseln fehlen.' };

  const exceptions = new Map<string, PairEvidence[]>();
  for (const src of exceptionSources) {
    if (!isObj(src) || !Array.isArray(src.clauses)) continue;
    for (const c of src.clauses) if (isObj(c) && typeof c.id === 'string') exceptions.set(c.id, readEvidence(c.evidence));
  }

  const clauses: PairClause[] = [];
  const index = new Map<string, PairClause>();
  for (const [i, c] of raw.clauses.entries()) {
    const p = isObj(c) && isObj(c.parameters) ? c.parameters : null;
    const codes = isObj(c) && Array.isArray(c.codes) ? c.codes : [];
    const other = p && Array.isArray(p.counterpart_codes) ? p.counterpart_codes : [];
    const ok = isObj(c) && p && typeof c.id === 'string' && (c.system === 'EBM' || c.system === 'GOAE')
      && (c.scope === 'session' || c.scope === 'inanspruchnahme') && c.direction === 'symmetric' && c.status === 'draft'
      && p.relation === 'excludes' && codes.length === 1 && other.length === 1
      && typeof codes[0] === 'string' && typeof other[0] === 'string' && codes[0] !== other[0];
    if (!ok) return { error: `Klausel ${i + 1} hat einen unerwarteten Aufbau.` };
    const exceptionIds = Array.isArray(c.exception_record_ids) ? c.exception_record_ids.map(String) : [];
    const missing = exceptionIds.find((id) => !exceptions.has(id));
    if (missing) return { error: `Ausnahme ${missing} (Klausel ${c.id as string}) nicht im Quell-Dossier gefunden.` };
    const clause: PairClause = {
      id: c.id as string, system: c.system as PairSystem, scope: c.scope as PairScope,
      codes: [codes[0] as string, other[0] as string], exceptionIds, evidence: readEvidence(c.evidence),
    };
    const k = key(clause.system, clause.codes[0], clause.codes[1]);
    if (index.has(k)) return { error: `Paar ${clause.codes.join('/')} doppelt (${index.get(k)!.id}, ${clause.id}).` };
    index.set(k, clause);
    clauses.push(clause);
  }
  return { schemaVersion: String(raw.schema_version), validFrom: raw.valid_from, validTo: raw.valid_to, clauses, index, exceptions };
}

/** Sitzungskennung eines Eintrags (bisher: Uhrzeit FK 5006), sonst null. */
function sessionOf(s: BilledService): string | null {
  return s.session?.trim() || null;
}

function judge(a: BilledService, b: BilledService): { same: boolean; note: string } {
  const sa = sessionOf(a), sb = sessionOf(b);
  if (sa && sb && sa === sb) return { same: true, note: `dieselbe Sitzung (Uhrzeit ${sa})` };
  if (sa && sb) return { same: false, note: `verschiedene Uhrzeiten (${sa} / ${sb}) – getrennte Sitzung nur, wenn so dokumentiert` };
  return { same: false, note: 'Sitzung nicht bestimmbar (keine Uhrzeit) – nicht als ganzer Tag gewertet' };
}

const SCOPE_TEXT: Record<PairScope, string> = { session: 'derselben Sitzung', inanspruchnahme: 'derselben Inanspruchnahme' };

/**
 * Prüft die Leistungen EINES Falls (ein Patient). HZV-Fälle werden nicht geprüft: das Dossier ist EBM/GOÄ national
 * und darf nicht auf Selektivverträge übertragen werden.
 */
export function checkPairs(
  services: BilledService[], reg: PairRegistry,
  opts: { hzv?: boolean; confirmedSeparate?: ReadonlyMap<string, SeparateConfirmation> | undefined } = {},
): PairReport {
  if (opts.hzv) return { findings: [], outOfRange: 0, skipped: 'HZV-Fall: EBM-/GOÄ-Paare werden nicht übertragen.' };
  const active = services.filter((s) => s.state === 'active');
  const days = new Map<IsoDate, BilledService[]>();
  for (const s of active) days.set(s.date, [...(days.get(s.date) ?? []), s]);

  const findings: PairFinding[] = [];
  const seen = new Set<string>();
  let outOfRange = 0;
  for (const [date, list] of days) {
    if (date < reg.validFrom || date > reg.validTo) { outOfRange++; continue; }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!, b = list[j]!;
        if (a.system !== b.system || a.code === b.code) continue;
        const clause = reg.index.get(key(a.system, a.code, b.code));
        if (!clause) continue;
        const judged = judge(a, b);
        const confirmed = opts.confirmedSeparate?.get(confirmationKey(clause.id, date)) ?? null;
        // Gleiche Sitzungskennung widerspricht einer Bestätigung → Ausschluss bleibt.
        const accepted = confirmed && !judged.same ? confirmed : null;
        const note = confirmed && judged.same ? `${judged.note}; Bestätigung „getrennt“ widerspricht der gleichen Uhrzeit` : judged.note;
        const verdict: PairVerdict = accepted ? 'separate_confirmed'
          : clause.exceptionIds.length > 0 ? 'exception_review' : judged.same ? 'excluded' : 'not_verifiable';
        const dedupe = `${clause.id}|${date}|${verdict}|${note}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const [x, y] = clause.codes;
        const text = verdict === 'separate_confirmed'
          ? `${x} und ${y}: getrennte Sitzungen als dokumentiert bestätigt (${accepted!.by}, ${accepted!.at}) – dieser Ausschluss greift nicht; die übrigen Bedingungen bleiben zu prüfen.`
          : verdict === 'excluded'
          ? `${x} und ${y} sind in ${SCOPE_TEXT[clause.scope]} nicht nebeneinander berechnungsfähig.`
          : verdict === 'exception_review'
            ? `${x} und ${y}: Ausschluss in ${SCOPE_TEXT[clause.scope]} – zuerst die genannte Ausnahme prüfen.`
            : `${x} und ${y} sind in ${SCOPE_TEXT[clause.scope]} nicht nebeneinander berechnungsfähig – ob es dieselbe Sitzung war, ist nicht prüfbar.`;
        findings.push({
          clauseId: clause.id, system: clause.system, date, codes: [x, y], verdict, sessionNote: note, text,
          evidence: clause.evidence,
          exceptions: clause.exceptionIds.map((id) => ({ id, evidence: reg.exceptions.get(id) ?? [] })),
          confirmation: accepted,
          status: 'draft',
        });
      }
    }
  }
  return { findings, outOfRange, skipped: null };
}
