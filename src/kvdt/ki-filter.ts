import type { IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import type { ChronicList } from '../engine/chronic.js';
import type { PairRegistry } from '../engine/pairs.js';
import type { WindowRuleSet } from '../engine/window-rules.js';
import type { ActiveRule } from '../rules/model.js';
import type { DayCall, DayItemKind } from './day-check.js';
import { checkCase, quarterRange, readKvdt, type KvdtCase } from './quarter-check.js';

/**
 * KI-Auftrag: Der Arzt beschreibt in Worten, was gesucht werden soll („alle Diabetiker ohne 03220“).
 * Claude bekommt NUR diesen Text und die Beschreibung des Filters (Rust, `ai_auftrag.rs`) und gibt einen FILTER zurück,
 * nie Patienten. Hier wird der Filter streng geprüft und LOKAL auf die KVDT-Datei (bzw. die Tagesliste) angewendet.
 * Jeder Treffer bleibt „unsicher“, bis der Arzt annimmt oder verwirft; nichts geht nach DURIA.
 */

export type Sicherheit = 'G' | 'V' | 'A' | 'Z';

export type Bedingung =
  /** Diagnose mit einem der ICD-Präfixe (z. B. „E11“) vorhanden bzw. nicht vorhanden; optional nur mit diesen Sicherheiten. */
  | { art: 'diagnose'; icd: string[]; vorhanden: boolean; sicherheit?: Sicherheit[] }
  /** Eine der Ziffern im Zeitraum abgerechnet (vorhanden) bzw. keine davon (nicht vorhanden). */
  | { art: 'ziffer'; system: 'EBM' | 'GOAE'; ziffern: string[]; vorhanden: boolean }
  /** Der Prüfmotor meldet einen dieser Befunde. */
  | { art: 'befund'; befunde: DayItemKind[] }
  /** Alter in Jahren (die KVDT-Datei enthält kein Geburtsdatum → nicht prüfbar). */
  | { art: 'alter'; min?: number; max?: number }
  /** Geschlecht (in der KVDT-Datei nicht enthalten → nicht prüfbar). */
  | { art: 'geschlecht'; wert: 'w' | 'm' | 'd' };

export interface KiFilter {
  version: 1;
  /** Kurzer Titel, vom Arzt prüfbar (höchstens 80 Zeichen). */
  titel: string;
  /** „tag“ = Patienten der heutigen Tagesliste, Leistungen von heute; „quartal“ = alle Fälle der KVDT-Datei. */
  zeitraum: 'tag' | 'quartal';
  /** Alle Bedingungen müssen zutreffen (UND). */
  bedingungen: Bedingung[];
}

export const MAX_BEDINGUNGEN = 8;
const MAX_CODES = 30;
const BEFUNDE: DayItemKind[] = [
  'keine_diagnose', 'diagnose_ohne_sicherheit', 'leistung_ohne_datum', 'datum_ausserhalb_quartal', 'regel', 'praxisregel', 'diagnose_ziffer',
  'kombination', 'zeitraum',
];
const ICD = /^[A-Z]\d{0,2}(\.\d{0,2})?$/;
const EBM = /^\d{5}[A-Z]?$/;
const GOAE = /^\d{1,4}[A-Z]?$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Nur erlaubte Schlüssel – jedes Zusatzfeld (z. B. „patienten“, „anweisung“) macht den Filter ungültig. */
const onlyKeys = (o: Record<string, unknown>, allowed: string[], where: string, errors: string[]) => {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) errors.push(`${where}: unbekanntes Feld „${k.slice(0, 30)}“.`);
};
const codeList = (v: unknown, re: RegExp, where: string, errors: string[], normalize: (s: string) => string = (s) => s): string[] => {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_CODES) { errors.push(`${where}: 1–${MAX_CODES} Einträge erwartet.`); return []; }
  const out = v.map((x) => (typeof x === 'string' ? normalize(x.trim().toUpperCase()) : ''));
  for (const c of out) if (!re.test(c)) errors.push(`${where}: ungültiger Eintrag „${c.slice(0, 12)}“.`);
  return [...new Set(out)];
};
/** „E11.-“ und „E11.*“ wie in der ICD-Schreibweise → Präfix „E11“. */
const icdPrefix = (s: string) => s.replace(/\.?[-*]$/, '');

function bedingung(v: unknown, i: number, errors: string[]): Bedingung | null {
  const where = `Bedingung ${i + 1}`;
  if (!isObj(v)) { errors.push(`${where}: kein Objekt.`); return null; }
  const vorhanden = (x: unknown) => (typeof x === 'boolean' ? x : (errors.push(`${where}: „vorhanden“ muss true/false sein.`), true));
  switch (v.art) {
    case 'diagnose': {
      onlyKeys(v, ['art', 'icd', 'vorhanden', 'sicherheit'], where, errors);
      const icd = codeList(v.icd, ICD, where, errors, icdPrefix);
      let sicherheit: Sicherheit[] | undefined;
      if (v.sicherheit !== undefined) {
        if (!Array.isArray(v.sicherheit) || !v.sicherheit.every((s) => ['G', 'V', 'A', 'Z'].includes(String(s)))) errors.push(`${where}: Sicherheit nur G/V/A/Z.`);
        else sicherheit = [...new Set(v.sicherheit as Sicherheit[])];
      }
      return { art: 'diagnose', icd, vorhanden: vorhanden(v.vorhanden), ...(sicherheit ? { sicherheit } : {}) };
    }
    case 'ziffer': {
      onlyKeys(v, ['art', 'system', 'ziffern', 'vorhanden'], where, errors);
      if (v.system !== 'EBM' && v.system !== 'GOAE') errors.push(`${where}: System EBM oder GOAE.`);
      const ziffern = codeList(v.ziffern, v.system === 'GOAE' ? GOAE : EBM, where, errors);
      return { art: 'ziffer', system: v.system === 'GOAE' ? 'GOAE' : 'EBM', ziffern, vorhanden: vorhanden(v.vorhanden) };
    }
    case 'befund': {
      onlyKeys(v, ['art', 'befunde'], where, errors);
      if (!Array.isArray(v.befunde) || v.befunde.length === 0 || !v.befunde.every((b) => BEFUNDE.includes(b as DayItemKind))) {
        errors.push(`${where}: unbekannte Befundart.`);
        return null;
      }
      return { art: 'befund', befunde: [...new Set(v.befunde as DayItemKind[])] };
    }
    case 'alter': {
      onlyKeys(v, ['art', 'min', 'max'], where, errors);
      const age = (x: unknown) => x === undefined || (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 120);
      if (!age(v.min) || !age(v.max) || (v.min === undefined && v.max === undefined)) errors.push(`${where}: Alter 0–120 (min und/oder max).`);
      return { art: 'alter', ...(v.min !== undefined ? { min: v.min as number } : {}), ...(v.max !== undefined ? { max: v.max as number } : {}) };
    }
    case 'geschlecht': {
      onlyKeys(v, ['art', 'wert'], where, errors);
      if (!['w', 'm', 'd'].includes(String(v.wert))) errors.push(`${where}: Geschlecht w/m/d.`);
      return { art: 'geschlecht', wert: v.wert as 'w' | 'm' | 'd' };
    }
    default:
      errors.push(`${where}: unbekannte Art.`);
      return null;
  }
}

/**
 * Antwort von Claude streng prüfen. Erlaubt ist genau ein JSON-Objekt (ggf. in ```json …```), sonst nichts.
 * Alles, was nicht dem Schema entspricht – Zusatzfelder, Patientenlisten, Anweisungen, zu lange Texte –, wird abgelehnt.
 */
export function parseKiFilter(answer: string): { filter: KiFilter } | { errors: string[] } {
  const trimmed = answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (trimmed.length > 4000) return { errors: ['Antwort zu lang – kein Filter übernommen.'] };
  let v: unknown;
  try { v = JSON.parse(trimmed); } catch { return { errors: ['Antwort ist kein reines JSON – kein Filter übernommen.'] }; }
  const errors: string[] = [];
  if (!isObj(v)) return { errors: ['Antwort ist kein Filter-Objekt.'] };
  onlyKeys(v, ['version', 'titel', 'zeitraum', 'bedingungen'], 'Filter', errors);
  if (v.version !== 1) errors.push('Filter: Version 1 erwartet.');
  const titel = typeof v.titel === 'string' ? v.titel.trim() : '';
  if (!titel || titel.length > 80 || /[<>{}]/.test(titel)) errors.push('Filter: Titel fehlt, ist zu lang oder enthält Steuerzeichen.');
  if (v.zeitraum !== 'tag' && v.zeitraum !== 'quartal') errors.push('Filter: Zeitraum „tag“ oder „quartal“.');
  const list = Array.isArray(v.bedingungen) ? v.bedingungen : [];
  if (list.length === 0 || list.length > MAX_BEDINGUNGEN) errors.push(`Filter: 1–${MAX_BEDINGUNGEN} Bedingungen erwartet.`);
  const bedingungen = list.slice(0, MAX_BEDINGUNGEN).map((b, i) => bedingung(b, i, errors)).filter((b): b is Bedingung => b !== null);
  if (errors.length > 0) return { errors };
  return { filter: { version: 1, titel, zeitraum: v.zeitraum as KiFilter['zeitraum'], bedingungen } };
}

const SICH: Record<Sicherheit, string> = { G: 'G', V: 'V', A: 'A', Z: 'Z' };

/** Lesbare Fassung zum Prüfen vor dem Anwenden, z. B. „Gefunden: ICD E11.- G, ohne 03220/03221, Quartal 4/2026“. */
export function describeFilter(f: KiFilter, quarter: string | null): string {
  const parts = f.bedingungen.map((b) => {
    switch (b.art) {
      case 'diagnose': {
        const icd = b.icd.map((c) => (c.includes('.') || c.length < 3 ? c : `${c}.-`)).join('/');
        const s = b.sicherheit ? ` ${b.sicherheit.map((x) => SICH[x]).join('/')}` : '';
        return b.vorhanden ? `ICD ${icd}${s}` : `ohne ICD ${icd}${s}`;
      }
      case 'ziffer': return `${b.vorhanden ? 'mit' : 'ohne'} ${b.system === 'GOAE' ? 'GOÄ ' : ''}${b.ziffern.join('/')}`;
      case 'befund': return `Befund: ${b.befunde.join('/')}`;
      case 'alter': return `Alter ${b.min ?? 0}–${b.max ?? '…'} (nicht prüfbar)`;
      case 'geschlecht': return `Geschlecht ${b.wert} (nicht prüfbar)`;
    }
  });
  const period = f.zeitraum === 'tag' ? 'heute (Tagesliste)' : quarter ? `Quartal ${quarter}` : 'Quartal der KVDT-Datei';
  return `Gefunden: ${parts.join(', ')}, ${period}`;
}

export interface FilterInput {
  kvdt: Uint8Array;
  day: IsoDate;
  /** Tagesliste (für Zeitraum „tag“). */
  calls: DayCall[];
  dayOf: (at: number) => IsoDate;
  settings: PracticeSettings;
  rules: RulePackage;
  mode: 'operational' | 'simulation';
  pairs?: PairRegistry | null;
  windows?: WindowRuleSet | null;
  practice?: ActiveRule[];
  chronic?: ChronicList | null;
}

export type HitDecision = 'offen' | 'angenommen' | 'verworfen';

export interface FilterHit {
  token: string;
  /** „treffer“: alle Bedingungen erfüllt; „teilweise“: erfüllt, soweit prüfbar (Rest nicht prüfbar). */
  status: 'treffer' | 'teilweise';
  /** Beleg je Bedingung (aus der KVDT-Datei), z. B. „E11.9 G vorhanden“, „03220/03221 fehlen“. */
  evidence: string[];
  /** Nicht prüfbare Bedingungen. */
  unchecked: string[];
  /** Befunde des Prüfmotors zu diesem Fall (Zusatzinformation). */
  findings: string[];
  certainty: 'unsicher';
  decision: HitDecision;
}

export interface FilterResult {
  hits: FilterHit[];
  /** Geprüfte Fälle (Patienten) im Zeitraum. */
  checked: number;
  parseErrors: number;
  quarter: string | null;
}

type Eval = { ok: true; evidence: string } | { ok: false } | { ok: 'unknown'; why: string };

function evaluate(b: Bedingung, cases: KvdtCase[], kinds: Set<string>, onDay: (d: IsoDate) => boolean): Eval {
  switch (b.art) {
    case 'diagnose': {
      const found = cases.flatMap((c) => c.diagnoses).filter((d) => b.icd.some((p) => d.icd.startsWith(p)) && (!b.sicherheit || (d.certainty !== null && b.sicherheit.includes(d.certainty as Sicherheit))));
      const shown = [...new Set(found.map((d) => `${d.icd}${d.certainty ? ` ${d.certainty}` : ''}`))].join(', ');
      if (b.vorhanden) return found.length > 0 ? { ok: true, evidence: `${shown} vorhanden` } : { ok: false };
      return found.length === 0 ? { ok: true, evidence: `keine Diagnose ${b.icd.join('/')}` } : { ok: false };
    }
    case 'ziffer': {
      if (b.system === 'GOAE') return { ok: 'unknown', why: 'GOÄ-Ziffern stehen nicht in der KVDT-Datei' };
      const billed = [...new Set(cases.flatMap((c) => c.services).filter((s) => onDay(s.date) && b.ziffern.includes(s.code)).map((s) => s.code))];
      if (b.vorhanden) return billed.length > 0 ? { ok: true, evidence: `${billed.join(', ')} abgerechnet` } : { ok: false };
      return billed.length === 0 ? { ok: true, evidence: `${b.ziffern.join('/')} fehlen` } : { ok: false };
    }
    case 'befund': {
      const hit = b.befunde.filter((k) => kinds.has(k));
      return hit.length > 0 ? { ok: true, evidence: `Prüfmotor: ${hit.join(', ')}` } : { ok: false };
    }
    case 'alter': return { ok: 'unknown', why: 'Alter: kein Geburtsdatum in der KVDT-Datei' };
    case 'geschlecht': return { ok: 'unknown', why: 'Geschlecht: nicht in der KVDT-Datei' };
  }
}

/** Filter lokal anwenden: zusammen mit dem Prüfmotor, nur lesen. Es verlässt nichts das Programm. */
export function applyKiFilter(f: KiFilter, i: FilterInput): FilterResult {
  const { cases, parseErrors } = readKvdt(i.kvdt);
  const range = cases.map((c) => quarterRange(c.quarter)).find((q) => q !== null) ?? null;
  const quarter = cases.map((c) => c.quarter).find((q) => q && /^[1-4]\d{4}$/.test(q)) ?? null;
  const quarterLabel = quarter ? `${quarter[0]}/${quarter.slice(1)}` : null;
  const today = new Set(i.calls.filter((c) => i.dayOf(c.at) === i.day).map((c) => c.token));
  const tokens = [...new Set(cases.map((c) => c.patientToken).filter((t): t is string => !!t))]
    .filter((t) => f.zeitraum === 'quartal' || today.has(t));
  const onDay = (d: IsoDate) => f.zeitraum === 'quartal' || d === i.day;
  const day = f.zeitraum === 'tag' ? i.day : undefined;

  const hits: FilterHit[] = [];
  for (const token of tokens) {
    const own = cases.filter((c) => c.patientToken === token);
    const results = own.map((c) => checkCase(c, { settings: i.settings, rules: i.rules, mode: i.mode, pairs: i.pairs, windows: i.windows, practice: i.practice, chronic: i.chronic, fileQuarter: range, day }));
    const kinds = new Set<string>(results.flatMap((r) => [...r.findings.map((x) => x.kind), ...(r.pairFindings.length ? ['kombination'] : []), ...(r.windowFindings.length ? ['zeitraum'] : [])]));
    const evals = f.bedingungen.map((b) => evaluate(b, own, kinds, onDay));
    if (evals.some((e) => e.ok === false)) continue;
    const unchecked = evals.flatMap((e) => (e.ok === 'unknown' ? [e.why] : []));
    if (unchecked.length === evals.length) continue; // nichts prüfbar → kein Treffer
    hits.push({
      token,
      status: unchecked.length > 0 ? 'teilweise' : 'treffer',
      evidence: evals.flatMap((e) => (e.ok === true ? [e.evidence] : [])),
      unchecked,
      findings: results.flatMap((r) => r.findings.map((x) => x.text)),
      certainty: 'unsicher',
      decision: 'offen',
    });
  }
  return { hits, checked: tokens.length, parseErrors: parseErrors.length, quarter: quarterLabel };
}

/** Entscheidung des Arztes – neues Objekt; der Treffer bleibt „unsicher“ (Annahme = Eintrag in die Korrekturliste, nicht in DURIA). */
export function decideHit(h: FilterHit, decision: Exclude<HitDecision, 'offen'>): FilterHit {
  return { ...h, decision };
}

/** Beispielaufträge (Knöpfe). */
export const KI_AUFTRAG_BEISPIELE = [
  'Alle Diabetiker ohne 03220 in diesem Quartal',
  'Patienten von heute mit Diagnose ohne Sicherheit (G/V/A/Z)',
  'Patienten mit Blutabnahme ohne Laborziffer',
  'Check-up fällig (ab 35 Jahre)',
] as const;
