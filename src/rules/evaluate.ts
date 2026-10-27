import type { BilledService, Facts, IsoDate } from '../domain/types.js';
import type { ActiveRule, PracticeRuleContent, PracticeRuleType, Priority } from './model.js';
import { REQUIREMENT_LABEL } from './model.js';

/** Ergebnis einer Praxisregel – immer ein Hinweis oder eine Herabstufung, nie eine Freigabe. */
export interface PracticeFinding {
  ruleId: string;
  version: number;
  type: PracticeRuleType;
  priority: Priority;
  title: string;
  codes: string[];
  date: IsoDate;
  text: string;
}

type Readiness = 'bereit' | 'klaerung' | 'info';
const RANK: Record<Readiness, number> = { info: 0, klaerung: 1, bereit: 2 };
/** Nur absenken: das Ergebnis ist nie „bereiter“ als vorher. */
const lower = (a: Readiness, b: Readiness): Readiness => (RANK[a] <= RANK[b] ? a : b);

const quarterOf = (d: IsoDate) => `${d.slice(0, 4)}-${Math.floor((Number(d.slice(5, 7)) - 1) / 3)}`;
const hit = (r: ActiveRule, codes: string[], date: IsoDate, text: string): PracticeFinding => ({
  ruleId: r.id, version: r.version, type: r.content.type, priority: r.content.priority, title: r.content.title, codes, date, text,
});

/**
 * Praxisregeln auf erfasste Leistungen (Behandlung, Quartalsprüfung). „Vorschlag zurückhalten“ und die Pflicht
 * auf Dauer/Pflichtinhalte wirken nur auf Vorschläge (siehe applyToProposals).
 */
export function evaluateOnServices(rules: ActiveRule[], services: BilledService[], opts: { behandlungsfallComplete: boolean }): PracticeFinding[] {
  const active = services.filter((s) => s.state === 'active');
  const out: PracticeFinding[] = [];
  const seen = new Set<string>();
  const push = (f: PracticeFinding) => {
    const k = `${f.ruleId}|${f.date}|${f.codes.join('+')}`;
    if (!seen.has(k)) { seen.add(k); out.push(f); }
  };
  for (const r of rules) {
    const c = r.content;
    const mine = active.filter((s) => s.system === c.system && c.codes.includes(s.code) && s.date >= c.validFrom);
    if (c.type === 'erinnerung') for (const s of mine) push(hit(r, [s.code], s.date, c.text));
    if (c.type === 'pflicht' && c.requirement === 'uhrzeit') {
      for (const s of mine.filter((x) => !x.session)) push(hit(r, [s.code], s.date, `Angabe fehlt: ${REQUIREMENT_LABEL.uhrzeit}. ${c.text}`));
    }
    if (c.type === 'kombination') {
      const partners = active.filter((s) => s.system === c.system && (c.partnerCodes ?? []).includes(s.code));
      for (const a of mine) {
        for (const b of partners) {
          if (a.code === b.code) continue;
          const same = c.scope === 'calendar_day' ? a.date === b.date : quarterOf(a.date) === quarterOf(b.date);
          if (!same) continue;
          const note = c.scope === 'behandlungsfall' && !opts.behandlungsfallComplete ? ' (Behandlungsfall nicht vollständig gelesen)' : '';
          push(hit(r, [a.code, b.code], a.date, `${c.text}${note}`));
        }
      }
    }
  }
  return out;
}

/** Vorschlag in der Form, die applyToProposals braucht (aus FertigProposal abgeleitet). */
export interface ProposalLike {
  kind: string;
  readiness: Readiness;
  entries: { type: string; code?: string; system?: string; date: IsoDate }[];
  practiceNotes?: PracticeFinding[];
}

function requirementMet(c: PracticeRuleContent, facts: Facts): boolean {
  if (c.requirement === 'dauer') {
    const f = facts['documentation.duration_minutes'];
    return Boolean(f && f.verification === 'confirmed' && typeof f.value === 'number' && f.value > 0);
  }
  if (c.requirement === 'pflichtinhalte') {
    const f = facts['documentation.required_components_complete'];
    return Boolean(f && f.verification === 'confirmed' && f.value === true);
  }
  return false; // Uhrzeit eines Vorschlags ist nie bekannt – sie entsteht erst beim Eintrag in DURIA.
}

/**
 * Wendet Praxisregeln auf „Fertig“-Vorschläge an. Garantie: Bereitschaft wird nur abgesenkt (bereit → Klärung → Hinweis),
 * nie angehoben; Einträge werden nur entfernt, nie hinzugefügt. Gibt neue Objekte zurück.
 */
export function applyToProposals<P extends ProposalLike>(rules: ActiveRule[], proposals: P[], ctx: { facts: Facts; services: BilledService[] }): P[] {
  return proposals.map((p) => {
    const ziffern = p.entries.filter((e) => e.type === 'ziffer' && e.code);
    if (ziffern.length === 0) return p;
    let readiness = p.readiness;
    const notes: PracticeFinding[] = [];
    for (const r of rules) {
      const c = r.content;
      for (const e of ziffern.filter((x) => x.system === c.system && c.codes.includes(x.code!) && x.date >= c.validFrom)) {
        if (c.type === 'erinnerung') notes.push(hit(r, [e.code!], e.date, c.text));
        if (c.type === 'zurueck') {
          readiness = lower(readiness, 'info');
          notes.push(hit(r, [e.code!], e.date, `${c.text} (Praxisregel: nicht automatisch vorschlagen)`));
        }
        if (c.type === 'pflicht' && !requirementMet(c, ctx.facts)) {
          readiness = lower(readiness, 'klaerung');
          notes.push(hit(r, [e.code!], e.date, `Angabe fehlt: ${REQUIREMENT_LABEL[c.requirement!]}. ${c.text}`));
        }
        if (c.type === 'kombination') {
          const partner = ctx.services.find((s) => s.state === 'active' && s.system === c.system && (c.partnerCodes ?? []).includes(s.code)
            && (c.scope === 'calendar_day' ? s.date === e.date : quarterOf(s.date) === quarterOf(e.date)));
          if (partner) notes.push(hit(r, [e.code!, partner.code], e.date, c.text));
        }
      }
    }
    if (notes.length === 0) return p;
    return { ...p, readiness, entries: readiness === 'bereit' ? p.entries : [], practiceNotes: [...(p.practiceNotes ?? []), ...notes] };
  });
}
