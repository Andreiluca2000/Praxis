import { addDays } from '../domain/dates.js';
import type { BilledService, IsoDate } from '../domain/types.js';
import type { PairEvidence } from './pairs.js';

/**
 * Ausschlüsse mit ausdrücklichem Zeitraum (Tag, Kalenderwoche, Behandlungsfall, Krankheitsfall, 21 Tage postoperativ)
 * und Höchstanzahlen aus den Codex-Dossiers unter data/billing/<dossier>/rules.review.json – alles Entwurf.
 *
 * Grundsätze (wie bei den Sitzungspaaren):
 * - Nur Klauseln mit ausdrücklichem, hier abbildbarem Zeitraum. „nicht neben“ ohne Zeitraum (`unresolved_neben`)
 *   wird nicht in einen Tag umgedeutet, sondern nur gezählt.
 * - Abschnitte („Abschnitt 31.4“) gelten nur, wenn die Zugehörigkeit der Ziffern belegt ist (`section_membership`);
 *   sonst bleibt der Abschnitt ungeprüft.
 * - Ist der Zeitraum mit den gelesenen Daten nicht bestimmbar (z. B. Behandlungsfall ohne ganzes Quartal), ist das
 *   Ergebnis „nicht prüfbar“, nie „kombinierbar“.
 * - Ziffern, für die das Dossier eine Ausnahme/Bedingung kennt, ergeben „Ausnahme prüfen“ statt Ausschluss.
 */

export type WindowScope = 'calendar_day' | 'calendar_week' | 'behandlungsfall' | 'krankheitsfall' | 'postoperative_21_days';
export type LimitScope = 'calendar_day' | 'session' | 'behandlungsfall';
type System = BilledService['system'];

export interface WindowExclusion {
  id: string; dossier: string; system: System; scope: WindowScope;
  codes: string[]; counterparts: string[]; unresolvedSections: string[];
  /** Paare `a|b` dieser Klausel, für die das Dossier eine Ausnahme/Bedingung nennt. */
  conditionalPairs: string[];
  evidence: PairEvidence[]; validFrom: IsoDate; validTo: IsoDate;
}

export interface FrequencyLimit {
  id: string; dossier: string; system: System; scope: LimitScope; codes: string[]; maxCount: number;
  evidence: PairEvidence[]; validFrom: IsoDate; validTo: IsoDate;
}

export interface WindowRuleSet {
  exclusions: WindowExclusion[];
  limits: FrequencyLimit[];
  /** Nicht abgebildet: „nicht neben“ ohne Zeitraum bzw. andere Zeiträume (Anzahl je Art). */
  skipped: Record<string, number>;
}

export type WindowVerdict = 'excluded' | 'not_verifiable' | 'exception_review' | 'limit_exceeded';

export interface WindowFinding {
  clauseId: string; dossier: string; scope: WindowScope | LimitScope; codes: string[]; dates: IsoDate[];
  verdict: WindowVerdict; text: string; evidence: PairEvidence[]; status: 'draft';
}

export interface CaseContext {
  services: BilledService[];
  /** Ist der ganze Behandlungsfall gelesen (KVDT-Schein oder bestätigter Quartalsexport)? */
  behandlungsfallComplete: boolean;
  hzv?: boolean;
}

const SCOPE: Record<string, WindowScope> = {
  calendar_day: 'calendar_day', calendar_week: 'calendar_week', ebm_behandlungsfall: 'behandlungsfall',
  behandlungsfall: 'behandlungsfall', krankheitsfall: 'krankheitsfall', postoperative_21_days: 'postoperative_21_days',
};
const LIMIT_SCOPE: Record<string, LimitScope> = { calendar_day: 'calendar_day', session: 'session', ebm_behandlungsfall: 'behandlungsfall', behandlungsfall: 'behandlungsfall' };
const SCOPE_TEXT: Record<WindowScope | LimitScope, string> = {
  calendar_day: 'am selben Tag', calendar_week: 'in derselben Kalenderwoche', behandlungsfall: 'im selben Behandlungsfall',
  krankheitsfall: 'im selben Krankheitsfall', postoperative_21_days: 'in den 21 Tagen nach einem Eingriff', session: 'in derselben Sitzung',
};
/** Ausnahme-/Bedingungsklauseln eines Dossiers: Ziffern darin ergeben „Ausnahme prüfen“. */
const CONDITIONAL_KINDS = new Set(['conditional_combination', 'exception', 'contact_exception']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const isDate = (v: unknown): v is IsoDate => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function evidenceOf(list: unknown): PairEvidence[] {
  return (Array.isArray(list) ? list : []).filter(isObj).map((e) => ({
    locator: String(e.locator ?? ''), anchor: String(e.anchor ?? ''),
    ...(typeof e.url === 'string' ? { url: e.url } : {}), ...(typeof e.page === 'number' ? { page: e.page } : {}),
  }));
}

/**
 * Liest die Dossiers streng: unbekannter Status (nicht draft/operativ) oder fehlender Geltungszeitraum → Fehler.
 * `sections`: belegte Abschnittszugehörigkeit (z. B. aus scope-resolutions `section_membership`).
 */
export function loadWindowRules(dossiers: { name: string; raw: unknown }[], sections: Record<string, string[]> = {}): WindowRuleSet | { error: string } {
  const out: WindowRuleSet = { exclusions: [], limits: [], skipped: {} };
  const skip = (k: string) => { out.skipped[k] = (out.skipped[k] ?? 0) + 1; };
  for (const { name, raw } of dossiers) {
    if (!isObj(raw) || !Array.isArray(raw.clauses)) return { error: `Dossier ${name}: Aufbau unerwartet.` };
    if (raw.status !== 'draft' || raw.operational !== false) return { error: `Dossier ${name} ist nicht als Entwurf gekennzeichnet.` };
    if (!isDate(raw.valid_from) || !isDate(raw.valid_to)) return { error: `Dossier ${name}: Geltungszeitraum fehlt.` };
    const validFrom = raw.valid_from, validTo = raw.valid_to;
    const defaultSystem = (raw.billing_system === 'GOAE' ? 'GOAE' : 'EBM') as System;
    const clauses = raw.clauses.filter(isObj);
    // Paare, für die das Dossier eine Ausnahme/Bedingung kennt (Ziffer ↔ Gegenziffer bzw. innerhalb einer Gruppe).
    const conditionalPairs = new Set<string>();
    for (const c of clauses.filter((x) => CONDITIONAL_KINDS.has(String(x.kind)))) {
      const p = isObj(c.parameters) ? c.parameters : {};
      const group = strs(p.pair_group);
      for (const x of [...strs(c.codes), ...group]) for (const y of [...strs(p.counterpart_codes), ...group]) if (x !== y) conditionalPairs.add(`${x}|${y}`).add(`${y}|${x}`);
    }
    for (const c of clauses) {
      const p = isObj(c.parameters) ? c.parameters : {};
      const rawScope = String(c.scope ?? p.scope ?? '');
      const system = (c.system === 'GOAE' ? 'GOAE' : c.system === 'EBM' ? 'EBM' : defaultSystem) as System;
      const id = typeof c.id === 'string' ? c.id : `${name}#?`;
      const codes = strs(c.codes);
      if (c.kind === 'combination' && p.relation === 'excludes') {
        const scope = SCOPE[rawScope];
        if (!scope) { skip(rawScope === 'unresolved_neben' ? 'nicht neben ohne Zeitraum' : 'anderer Zeitraum'); continue; }
        const resolved = strs(p.counterpart_sections).filter((s) => sections[s]);
        const counterparts = [...new Set([...strs(p.counterpart_codes), ...resolved.flatMap((s) => sections[s]!)])];
        const unresolvedSections = strs(p.counterpart_sections).filter((s) => !sections[s]);
        if (counterparts.length === 0 && unresolvedSections.length > 0) { skip('nur unbelegte Abschnitte'); continue; }
        out.exclusions.push({
          id, dossier: name, system, scope, codes, counterparts, unresolvedSections,
          conditionalPairs: [...conditionalPairs].filter((k) => codes.includes(k.split('|')[0]!) && counterparts.includes(k.split('|')[1]!)),
          evidence: evidenceOf(c.evidence), validFrom, validTo,
        });
      } else if (c.kind === 'frequency' && typeof p.max_count === 'number') {
        const scope = LIMIT_SCOPE[rawScope];
        // Zusatzbedingungen (Basis-/Gegenziffern) sind hier nicht abgebildet → nicht als einfache Höchstzahl werten.
        if (!scope) { skip(rawScope === 'arztgruppenfall' ? 'Häufigkeit je Arztgruppenfall' : 'Häufigkeit ohne abbildbaren Zeitraum'); continue; }
        if (p.base_codes || p.counterpart_codes) { skip('Häufigkeit mit Zusatzbedingung'); continue; }
        out.limits.push({ id, dossier: name, system, scope, codes, maxCount: p.max_count, evidence: evidenceOf(c.evidence), validFrom, validTo });
      }
    }
  }
  return out;
}

function quarterIndex(d: IsoDate): number {
  return Number(d.slice(0, 4)) * 4 + Math.floor((Number(d.slice(5, 7)) - 1) / 3);
}

/** Montag der Kalenderwoche (ISO). */
function weekStart(d: IsoDate): IsoDate {
  const day = new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
  return addDays(d, -((day + 6) % 7));
}

const daysBetween = (a: IsoDate, b: IsoDate) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Prüft die Leistungen EINES Falls. */
export function checkWindowRules(ctx: CaseContext, rules: WindowRuleSet): { findings: WindowFinding[]; skipped: string | null } {
  if (ctx.hzv) return { findings: [], skipped: 'HZV-Fall: EBM-/GOÄ-Regeln werden nicht übertragen.' };
  const active = ctx.services.filter((s) => s.state === 'active');
  const findings: WindowFinding[] = [];
  const seen = new Set<string>();
  const inRange = (s: BilledService, r: { validFrom: IsoDate; validTo: IsoDate }) => s.date >= r.validFrom && s.date <= r.validTo;
  const push = (f: WindowFinding) => {
    const k = `${f.clauseId}|${f.codes.join('+')}|${f.dates.join(',')}|${f.verdict}`;
    if (!seen.has(k)) { seen.add(k); findings.push(f); }
  };

  for (const r of rules.exclusions) {
    const own = active.filter((s) => s.system === r.system && r.codes.includes(s.code) && inRange(s, r));
    const other = active.filter((s) => s.system === r.system && r.counterparts.includes(s.code) && inRange(s, r));
    for (const a of own) {
      for (const b of other) {
        if (a.code === b.code) continue;
        let verdict: WindowVerdict | null = null;
        let note = '';
        switch (r.scope) {
          case 'calendar_day': if (a.date === b.date) verdict = 'excluded'; break;
          case 'calendar_week': if (weekStart(a.date) === weekStart(b.date)) verdict = 'excluded'; break;
          case 'behandlungsfall':
            if (quarterIndex(a.date) === quarterIndex(b.date)) {
              verdict = ctx.behandlungsfallComplete ? 'excluded' : 'not_verifiable';
              if (!ctx.behandlungsfallComplete) note = ' – ob es derselbe Behandlungsfall ist, ist ohne ganzes Quartal nicht prüfbar';
            }
            break;
          case 'krankheitsfall':
            // Krankheitsfall = aktuelles und die drei folgenden Quartale.
            if (Math.abs(quarterIndex(a.date) - quarterIndex(b.date)) <= 3) verdict = 'excluded';
            break;
          case 'postoperative_21_days':
            // Die Frist beginnt mit einem Eingriff aus Abschnitt 31.2 – dessen Ziffern sind hier nicht belegt.
            if (Math.abs(daysBetween(a.date, b.date)) <= 21) {
              verdict = 'not_verifiable';
              note = ' – ob beide in den 21 Tagen nach einem Eingriff (Abschnitt 31.2) liegen, bitte prüfen';
            }
            break;
        }
        if (!verdict) continue;
        if (verdict === 'excluded' && r.conditionalPairs.includes(`${a.code}|${b.code}`)) verdict = 'exception_review';
        const text = verdict === 'exception_review'
          ? `${a.code} und ${b.code}: Ausschluss ${SCOPE_TEXT[r.scope]} – zuerst die im Dossier genannte Ausnahme prüfen.`
          : r.scope === 'postoperative_21_days'
            ? `${a.code} ist ${SCOPE_TEXT[r.scope]} aus Abschnitt 31.2 nicht neben ${b.code} berechnungsfähig${note}.`
            : `${a.code} ist ${SCOPE_TEXT[r.scope]} nicht neben ${b.code} berechnungsfähig${note}.`;
        push({ clauseId: r.id, dossier: r.dossier, scope: r.scope, codes: [a.code, b.code], dates: [...new Set([a.date, b.date])].sort(), verdict, text, evidence: r.evidence, status: 'draft' });
      }
    }
  }

  for (const l of rules.limits) {
    const hits = active.filter((s) => s.system === l.system && l.codes.includes(s.code) && inRange(s, l));
    const groups = new Map<string, BilledService[]>();
    let unsure = false;
    for (const s of hits) {
      let key: string;
      if (l.scope === 'behandlungsfall') key = String(quarterIndex(s.date));
      else if (l.scope === 'calendar_day') key = s.date;
      else { key = s.session ? `${s.date}|${s.session}` : s.date; if (!s.session) unsure = true; }
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    for (const list of groups.values()) {
      if (list.length <= l.maxCount) continue;
      // Mehr gelesene Daten können eine Überschreitung nur bestätigen; unsicher ist nur die unbekannte Sitzung.
      // (Multiplikator FK 5005 wird noch nicht gezählt → eher zu wenig als zu viel.)
      const certain = l.scope !== 'session' || !unsure;
      const codes = [...new Set(list.map((s) => s.code))];
      push({
        clauseId: l.id, dossier: l.dossier, scope: l.scope, codes, dates: [...new Set(list.map((s) => s.date))].sort(),
        verdict: certain ? 'limit_exceeded' : 'not_verifiable',
        text: `${codes.join(', ')}: höchstens ${l.maxCount}× ${SCOPE_TEXT[l.scope]}, erfasst ${list.length}×${certain ? '' : ' – Sitzung nicht bestimmbar'}.`,
        evidence: l.evidence, status: 'draft',
      });
    }
  }
  return { findings, skipped: null };
}
