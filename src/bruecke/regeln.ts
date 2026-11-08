import { addDays } from '../domain/dates.js';
import type { BilledService, IsoDate } from '../domain/types.js';
import type { PairEvidence } from '../engine/pairs.js';
import { checkCase, quarterRange, type KvdtCase } from '../kvdt/quarter-check.js';
import type { PruefKontext } from './uebersicht.js';

/**
 * Werkzeuge ohne Patientendaten (Stufe 1): Regeln zu einer Ziffer nachschlagen und erfundene Fälle prüfen.
 * Damit kann Claude Regeln erklären und den Motor mit synthetischen Fällen testen („üben“).
 */

export const EBM_ZIFFER = /^\d{5}[A-Z]?$/;
export const ICD_CODE = /^[A-Z]\d{2}(\.[0-9A-Z]{1,2})?[!+*#]?$/;
export const MAX_LEISTUNGEN = 40;
export const MAX_DIAGNOSEN = 20;
const MAX_TREFFER = 40;

export interface Beleg { stelle: string; text: string; url?: string; seite?: number }
const beleg = (e: PairEvidence[]): Beleg[] => e.slice(0, 3).map((x) => ({
  stelle: x.locator, text: x.anchor.slice(0, 600), ...(x.url ? { url: x.url } : {}), ...(x.page !== undefined ? { seite: x.page } : {}),
}));

export interface RegelTreffer {
  quelle: 'katalog' | 'paar' | 'zeitraum' | 'hoechstzahl' | 'praxisregel';
  id: string;
  text: string;
  belege: Beleg[];
  entwurf: boolean;
}

export function regelnZuZiffer(ziffer: string, k: PruefKontext): RegelTreffer[] | { fehler: string } {
  if (!EBM_ZIFFER.test(ziffer)) return { fehler: 'Ziffer muss eine EBM-Ziffer sein (5 Ziffern, optional ein Buchstabe).' };
  const out: RegelTreffer[] = [];
  for (const r of k.rules.rules) {
    if (r.procedure_codes.includes(ziffer)) out.push({ quelle: 'katalog', id: r.id, text: `${r.title} (${k.rules.content_kind})`, belege: [], entwurf: k.rules.content_kind !== 'reviewed_catalogue' });
  }
  for (const c of k.pairs?.clauses ?? []) {
    if (!c.codes.includes(ziffer)) continue;
    const partner = c.codes[0] === ziffer ? c.codes[1] : c.codes[0];
    out.push({ quelle: 'paar', id: c.id, text: `${ziffer} nicht neben ${partner} (${c.scope === 'session' ? 'je Sitzung' : 'je Inanspruchnahme'})${c.exceptionIds.length ? `, Ausnahmen: ${c.exceptionIds.join(', ')}` : ''}`, belege: beleg(c.evidence), entwurf: true });
  }
  for (const w of k.windows?.exclusions ?? []) {
    if (!w.codes.includes(ziffer) && !w.counterparts.includes(ziffer)) continue;
    out.push({ quelle: 'zeitraum', id: w.id, text: `${w.codes.join(', ')} nicht neben ${w.counterparts.join(', ') || 'Abschnitt ' + w.unresolvedSections.join(', ')} (${w.scope}, Dossier ${w.dossier})`, belege: beleg(w.evidence), entwurf: true });
  }
  for (const l of k.windows?.limits ?? []) {
    if (!l.codes.includes(ziffer)) continue;
    out.push({ quelle: 'hoechstzahl', id: l.id, text: `${l.codes.join(', ')}: höchstens ${l.maxCount}× je ${l.scope} (Dossier ${l.dossier})`, belege: beleg(l.evidence), entwurf: true });
  }
  for (const p of k.practice) {
    if (JSON.stringify(p.content).includes(`"${ziffer}"`)) out.push({ quelle: 'praxisregel', id: `${p.id} v${p.version}`, text: p.content.title, belege: [], entwurf: false });
  }
  return out.slice(0, MAX_TREFFER);
}

export interface SynthLeistung { ziffer: string; tag: number; uhrzeit?: string | undefined }
export interface SynthDiagnose { icd: string; sicherheit?: 'G' | 'V' | 'A' | 'Z' | undefined }
export interface SynthFall { quartal: string; leistungen: SynthLeistung[]; diagnosen: SynthDiagnose[] }

/** Erfundener Behandlungsfall → dieselben Prüfungen wie ein KVDT-Schein. `tag` = Tag im Quartal (1 = erster Tag). */
export function pruefeSynthetischenFall(f: SynthFall, k: PruefKontext) {
  const range = quarterRange(f.quartal);
  if (!range) return { fehler: 'Quartal im Format QJJJJ angeben, z. B. 42026.' };
  if (f.leistungen.length === 0 || f.leistungen.length > MAX_LEISTUNGEN) return { fehler: `1 bis ${MAX_LEISTUNGEN} Leistungen angeben.` };
  if (f.diagnosen.length > MAX_DIAGNOSEN) return { fehler: `Höchstens ${MAX_DIAGNOSEN} Diagnosen.` };
  const services: BilledService[] = [];
  for (const [i, l] of f.leistungen.entries()) {
    if (!EBM_ZIFFER.test(l.ziffer)) return { fehler: `Leistung ${i + 1}: keine EBM-Ziffer.` };
    if (!Number.isInteger(l.tag) || l.tag < 1 || l.tag > 92) return { fehler: `Leistung ${i + 1}: Tag 1 bis 92.` };
    if (l.uhrzeit !== undefined && !/^\d{4}$/.test(l.uhrzeit)) return { fehler: `Leistung ${i + 1}: Uhrzeit als HHMM.` };
    const date: IsoDate = addDays(range.from, l.tag - 1);
    services.push({ code: l.ziffer, system: 'EBM', date, state: 'active', session: l.uhrzeit ?? null, evidence: [{ ref: `synthetisch:${i}` }] });
  }
  for (const [i, d] of f.diagnosen.entries()) if (!ICD_CODE.test(d.icd)) return { fehler: `Diagnose ${i + 1}: kein ICD-10-GM-Code.` };
  const fall: KvdtCase = {
    index: 0, satzart: '0101', patientToken: 'SYNTH', quarter: f.quartal, services,
    diagnoses: f.diagnosen.map((d) => ({ icd: d.icd, certainty: d.sicherheit ?? null, side: null })), warnings: [],
  };
  const r = checkCase(fall, { settings: k.settings, rules: k.rules, mode: k.mode, pairs: k.pairs, windows: k.windows, practice: k.practice, chronic: k.chronic, fileQuarter: range });
  return {
    synthetisch: true,
    modus: k.mode,
    tage: Object.fromEntries([...new Set(services.map((s) => s.date))].map((d) => [d, services.filter((s) => s.date === d).map((s) => s.code)])),
    befunde: r.findings.map((x) => ({ art: x.kind, schwere: x.severity, text: x.text })),
    kombinationen: r.pairFindings.map((x) => ({ ziffern: x.codes, urteil: x.verdict, text: x.text, belege: beleg(x.evidence) })),
    zeitraeume: r.windowFindings.map((x) => ({ ziffern: x.codes, urteil: x.verdict, text: x.text, belege: beleg(x.evidence) })),
  };
}
