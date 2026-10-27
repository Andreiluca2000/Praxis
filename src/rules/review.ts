import type { BilledService } from '../domain/types.js';
import type { PairRegistry } from '../engine/pairs.js';
import type { WindowRuleSet } from '../engine/window-rules.js';
import { evaluateOnServices } from './evaluate.js';
import type { PracticeRuleContent, PracticeRuleFile } from './model.js';

/** Hinweise vor der Aktivierung: Überschneidungen und Dopplungen. Keiner davon blockiert – der Arzt entscheidet. */
export interface Conflict {
  kind: 'same_trigger' | 'official_duplicate' | 'remind_and_hold';
  text: string;
  otherRuleId?: string;
}

const pairKey = (system: string, a: string, b: string) => (a < b ? `${system}:${a}|${b}` : `${system}:${b}|${a}`);

export function detectConflicts(
  file: PracticeRuleFile, ruleId: string | null, c: PracticeRuleContent,
  officials: { pairs?: PairRegistry | null; windows?: WindowRuleSet | null } = {},
): Conflict[] {
  const out: Conflict[] = [];
  for (const r of file.rules) {
    if (r.id === ruleId) continue;
    const other = r.versions.find((v) => v.status === 'aktiv') ?? r.versions.find((v) => v.status === 'entwurf');
    if (!other || other.content.system !== c.system) continue;
    const shared = c.codes.filter((x) => other.content.codes.includes(x));
    if (shared.length === 0) continue;
    const label = `„${other.content.title}“ (${other.status === 'aktiv' ? 'aktiv' : 'Entwurf'} v${other.version})`;
    if (other.content.type === c.type) {
      out.push({ kind: 'same_trigger', otherRuleId: r.id, text: `Gleicher Auslöser ${shared.join(', ')} wie ${label}. Beide würden erscheinen – zusammenführen?` });
    } else if (new Set([other.content.type, c.type]).has('zurueck') && new Set([other.content.type, c.type]).has('erinnerung')) {
      out.push({ kind: 'remind_and_hold', otherRuleId: r.id, text: `${shared.join(', ')}: Erinnerung und „Vorschlag zurückhalten“ (${label}) gelten gleichzeitig.` });
    }
  }
  if (c.type === 'kombination') {
    for (const a of c.codes) {
      for (const b of c.partnerCodes ?? []) {
        const pair = officials.pairs?.index.get(pairKey(c.system, a, b));
        if (pair) out.push({ kind: 'official_duplicate', text: `${a}/${b} ist schon im EBM/GOÄ ausgeschlossen (je Sitzung, ${pair.id}) – die Hausregel ergänzt nur einen Hinweis.` });
        const w = officials.windows?.exclusions.find((e) => e.system === c.system
          && ((e.codes.includes(a) && e.counterparts.includes(b)) || (e.codes.includes(b) && e.counterparts.includes(a))));
        if (w) out.push({ kind: 'official_duplicate', text: `${a}/${b} ist schon ausgeschlossen (${w.id}, ${w.dossier}) – die Hausregel ergänzt nur einen Hinweis.` });
      }
    }
  }
  return out;
}

export interface SimulationCase { index: number; patientToken: string | null; services: BilledService[] }
export interface SimulationResult {
  cases: number;
  hits: number;
  /** Fälle, die mit der neuen Fassung, aber nicht mit der vorigen getroffen werden. */
  newHits: number;
  examples: { index: number; patientToken: string | null; date: string; codes: string[]; isNew: boolean }[];
}

/**
 * Testlauf einer Fassung an gelesenen Fällen (KVDT, Pseudonyme). „Vorschlag zurückhalten“ und Pflichtangaben auf
 * Dauer/Pflichtinhalte wirken auf künftige Vorschläge – hier zählt jeder Fall, in dem die Ziffer vorkommt.
 */
export function simulate(c: PracticeRuleContent, cases: SimulationCase[], previous?: PracticeRuleContent | null): SimulationResult {
  const asRule = (content: PracticeRuleContent) => [{ id: 'SIM', version: 0, content: { ...content, validFrom: '0000-01-01' } }];
  const casesHit = (content: PracticeRuleContent | null | undefined) => {
    const hits = new Map<number, { date: string; codes: string[] }>();
    if (!content) return hits;
    for (const k of cases) {
      const viaService = evaluateOnServices(asRule(content), k.services, { behandlungsfallComplete: true })[0];
      const viaCode = !viaService && (content.type === 'zurueck' || content.type === 'pflicht')
        ? k.services.find((s) => s.state === 'active' && s.system === content.system && content.codes.includes(s.code))
        : undefined;
      if (viaService) hits.set(k.index, { date: viaService.date, codes: viaService.codes });
      else if (viaCode) hits.set(k.index, { date: viaCode.date, codes: [viaCode.code] });
    }
    return hits;
  };
  const now = casesHit(c);
  const before = casesHit(previous);
  const examples = [...now.entries()].slice(0, 25).map(([index, h]) => ({
    index, patientToken: cases.find((k) => k.index === index)?.patientToken ?? null, date: h.date, codes: h.codes, isNew: previous ? !before.has(index) : false,
  }));
  return { cases: cases.length, hits: now.size, newHits: previous ? [...now.keys()].filter((i) => !before.has(i)).length : 0, examples };
}
