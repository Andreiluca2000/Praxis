import type { IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import type { ChronicList } from '../engine/chronic.js';
import type { PairRegistry } from '../engine/pairs.js';
import type { WindowRuleSet } from '../engine/window-rules.js';
import type { ActiveRule } from '../rules/model.js';
import { checkCase, quarterRange, readKvdt, type CaseFinding, type KvdtCase } from './quarter-check.js';

/**
 * Tagesabschluss, Quelle A: die KVDT-Datei (Quartal bis heute), gefiltert auf einen Tag und auf die Patienten der Tagesliste.
 * - Patienten nur als Pseudonym (Tagesliste und KVDT-Datei kommen aus derselben Rust-Sitzung, daher gleiche Pseudonyme).
 * - Dieselben Prüfungen wie die Quartalsprüfung (`checkCase`), aber nur Befunde dieses Tages plus Befunde des ganzen Falls.
 * - Nur lesen. Nichts wird in DURIA geschrieben, nichts wird „bereit“.
 * - Fehlen Daten, heißt es „nicht prüfbar“ (grau) – nie „in Ordnung“. Grün heißt nur: in den geprüften Regeln nichts gefunden.
 */

/** Ein Aufruf aus der Tagesliste (so, wie Rust ihn dem Fenster gibt). `at` = Sekunden seit 1970. */
export interface DayCall { token: string; at: number; station: string; kuerzel: string }

export type DayStatus = 'rot' | 'grau' | 'gelb' | 'gruen';
/** Reihenfolge für den Gesamtstatus: ein roter Befund bleibt rot; fehlende Daten wiegen schwerer als ein Klärungshinweis. */
const RANK: Record<DayStatus, number> = { gruen: 0, gelb: 1, grau: 2, rot: 3 };

export type DayItemKind =
  | CaseFinding['kind']
  | 'kein_schein' | 'keine_leistung_am_tag' | 'tag_fehlt_in_datei' | 'datei_unvollstaendig'
  | 'kombination' | 'zeitraum';

export interface DayItem {
  level: Exclude<DayStatus, 'gruen'>;
  kind: DayItemKind;
  text: string;
  /** Aus einem Entwurfs-Dossier (nicht ärztlich freigegeben): nie rot. */
  draft: boolean;
}

export interface DayPatient {
  token: string;
  calls: { at: number; station: string; kuerzel: string }[];
  status: DayStatus;
  items: DayItem[];
  /** Ziffern dieses Tages (aus der KVDT-Datei). */
  servicesToday: string[];
  /** Diagnosen des Falls mit Sicherheit, z. B. „J20.9 G“. */
  diagnoses: string[];
}

export interface DayReport {
  day: IsoDate;
  patients: DayPatient[];
  counts: Record<DayStatus, number>;
  /** Patienten mit Leistungen an diesem Tag, die nicht in der Tagesliste stehen (nur gezählt, nicht geprüft). */
  unlisted: number;
  /** Enthält die Datei überhaupt Leistungen dieses Tages? Sonst ist sie vermutlich vor der Sprechstunde erzeugt. */
  fileCoversDay: boolean;
  parseErrors: number;
  /** Was in diesem Lauf nicht geprüft wurde (immer anzeigen). */
  notChecked: string[];
}

export interface DayCheckInput {
  kvdt: Uint8Array;
  day: IsoDate;
  calls: DayCall[];
  /** Kalendertag eines Aufrufs in Ortszeit (im Fenster: `new Date(at * 1000)`). */
  dayOf: (at: number) => IsoDate;
  settings: PracticeSettings;
  rules: RulePackage;
  mode: 'operational' | 'simulation';
  pairs?: PairRegistry | null;
  windows?: WindowRuleSet | null;
  practice?: ActiveRule[];
  chronic?: ChronicList | null;
  /** Fehlermeldung beim Laden der Entwurfs-Dossiers (Simulator). */
  dossierError?: string;
}

/** 2026-10-29 → 29.10.2026 (Anzeige). */
const de = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

const LEVEL_OF: Record<CaseFinding['severity'], DayItem['level']> = { fehler: 'rot', hinweis: 'gelb' };

function notChecked(i: DayCheckInput): string[] {
  const out: string[] = [];
  if (i.mode === 'operational') out.push('Kombinationen und Zeiträume (Entwurfs-Dossiers) – nur im Simulator.');
  else if (i.dossierError) out.push(`Kombinationen und Zeiträume – Dossier nicht verfügbar: ${i.dossierError}`);
  else if (!i.pairs) out.push('Kombinationen und Zeiträume – Dossier nicht geladen.');
  if (i.rules.content_kind === 'synthetic_example') {
    out.push(i.mode === 'simulation' ? 'Abrechnungsregeln: nur DEMO-Regeln (Simulator).' : 'Abrechnungsregeln: keine freigegebenen Regeln geladen.');
  }
  if (!i.chronic) out.push('Diagnose ↔ Ziffer (R1): Liste chronischer Erkrankungen nicht freigegeben.');
  out.push('Fehlende Ziffern aus der Dokumentation: braucht einen BDT-Export pro Tag (Frage an DURIA).');
  out.push('Patienten ohne KV-Schein (HZV, privat): nicht in der KVDT-Datei.');
  return out;
}

function checkPatient(token: string, cases: KvdtCase[], i: DayCheckInput, fileCoversDay: boolean, fileQuarter: ReturnType<typeof quarterRange>): Omit<DayPatient, 'calls'> {
  const items: DayItem[] = [];
  const servicesToday = [...new Set(cases.flatMap((c) => c.services.filter((s) => s.date === i.day).map((s) => s.code)))];
  const diagnoses = [...new Set(cases.flatMap((c) => c.diagnoses.map((d) => `${d.icd}${d.certainty ? ` ${d.certainty}` : ''}`)))];
  if (cases.length === 0) {
    items.push({ level: 'grau', kind: 'kein_schein', draft: false, text: 'Nicht prüfbar: kein KV-Schein in der KVDT-Datei (HZV, privat oder noch nicht angelegt?).' });
  } else if (!fileCoversDay) {
    items.push({ level: 'grau', kind: 'tag_fehlt_in_datei', draft: false, text: `Nicht prüfbar: die KVDT-Datei enthält keine Leistungen vom ${de(i.day)} – nach der Sprechstunde neu erzeugen.` });
  } else if (servicesToday.length === 0) {
    items.push({ level: 'gelb', kind: 'keine_leistung_am_tag', draft: false, text: `Aufgerufen, aber am ${de(i.day)} keine Ziffer erfasst – Ziffer vergessen?` });
  }
  // DEMO-Regeln (Simulator) sind nicht ärztlich freigegeben: ihre Konflikte höchstens gelb.
  const demo = i.rules.content_kind === 'synthetic_example';
  for (const c of cases) {
    const r = checkCase(c, { settings: i.settings, rules: i.rules, mode: i.mode, pairs: i.pairs, windows: i.windows, practice: i.practice, chronic: i.chronic, fileQuarter, day: i.day });
    items.push(...r.findings.map((f): DayItem => (demo && f.kind === 'regel'
      ? { level: 'gelb', kind: f.kind, text: f.text, draft: true }
      : { level: LEVEL_OF[f.severity], kind: f.kind, text: f.text, draft: false })));
    // Entwurf: höchstens gelb, auch bei einem Ausschluss.
    items.push(...r.pairFindings.filter((f) => f.verdict !== 'separate_confirmed').map((f): DayItem => ({ level: 'gelb', kind: 'kombination', draft: true, text: `${f.codes.join(' + ')}: ${f.text}` })));
    items.push(...r.windowFindings.map((f): DayItem => ({ level: 'gelb', kind: 'zeitraum', draft: true, text: `${f.codes.join(' + ')}: ${f.text}` })));
  }
  const status = items.reduce<DayStatus>((worst, it) => (RANK[it.level] > RANK[worst] ? it.level : worst), 'gruen');
  return { token, status, items, servicesToday, diagnoses };
}

export function checkDay(i: DayCheckInput): DayReport {
  const { cases, parseErrors } = readKvdt(i.kvdt);
  const fileQuarter = cases.map((c) => quarterRange(c.quarter)).find((q) => q !== null) ?? null;
  const fileCoversDay = cases.some((c) => c.services.some((s) => s.date === i.day));
  const calls = i.calls.filter((c) => i.dayOf(c.at) === i.day).sort((a, b) => a.at - b.at);
  const byToken = new Map<string, DayPatient['calls']>();
  for (const c of calls) byToken.set(c.token, [...(byToken.get(c.token) ?? []), { at: c.at, station: c.station, kuerzel: c.kuerzel }]);

  const patients = [...byToken].map(([token, tokenCalls]): DayPatient => {
    const own = cases.filter((c) => c.patientToken === token);
    const p = checkPatient(token, own, i, fileCoversDay, fileQuarter);
    if (parseErrors.length > 0) {
      const item: DayItem = { level: 'grau', kind: 'datei_unvollstaendig', draft: false, text: `${parseErrors.length} Zeilen der KVDT-Datei unlesbar – Ergebnis unvollständig.` };
      p.items.push(item);
      if (RANK[p.status] < RANK.grau) p.status = 'grau';
    }
    return { ...p, calls: tokenCalls };
  });
  const listed = new Set(byToken.keys());
  const unlisted = new Set(cases.filter((c) => c.patientToken && !listed.has(c.patientToken) && c.services.some((s) => s.date === i.day)).map((c) => c.patientToken)).size;
  const counts: Record<DayStatus, number> = { rot: 0, grau: 0, gelb: 0, gruen: 0 };
  for (const p of patients) counts[p.status] += 1;
  return { day: i.day, patients, counts, unlisted, fileCoversDay, parseErrors: parseErrors.length, notChecked: notChecked(i) };
}
