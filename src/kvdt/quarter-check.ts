import { quarterEnd, quarterStart } from '../domain/dates.js';
import type { BilledService, IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import { declareCoverage } from '../duria/adapter.js';
import { evaluatePackage } from '../engine/evaluate.js';
import { checkPairs, type PairFinding, type PairRegistry } from '../engine/pairs.js';
import { first, parseXdt, parseXdtDate, type XdtRecord } from '../duria/xdt.js';

/**
 * Quartalsprüfung der KVDT-Abrechnungsdatei VOR dem Versand an die KV. Nur lesen, nie schreiben.
 * - Jeder Schein (Satzart 0101–0104) = ein Behandlungsfall eines Patienten im Quartal.
 * - Patientenbezug nur über das Pseudonym (FK 3000 wird in Rust vorher ersetzt; Identitätsfelder entfernt).
 * - Ergebnis: je Fall Konflikte, fehlende Diagnosen, Häufigkeitsüberschreitungen, mögliche fehlende Ziffern.
 * Feldkennungen nach KVDT: 5000 Leistungstag, 5001 GNR, 5005 Multiplikator, 5006 Uhrzeit (zur vorigen GNR), 6001 ICD, 6003 Sicherheit,
 * 6004 Seite, 4101 Quartal (QJJJJ). Ob DURIA weitere/abweichende Felder nutzt, ist zu bestätigen.
 */

export const SCHEIN_SATZARTEN = ['0101', '0102', '0103', '0104'];

export interface KvdtCase {
  index: number;
  satzart: string;
  patientToken: string | null;
  quarter: string | null; // z. B. "42026"
  services: BilledService[];
  diagnoses: { icd: string; certainty: string | null; side: string | null }[];
  warnings: string[];
}

export interface CaseFinding {
  caseIndex: number;
  patientToken: string | null;
  severity: 'fehler' | 'hinweis';
  kind: 'keine_diagnose' | 'diagnose_ohne_sicherheit' | 'leistung_ohne_datum' | 'datum_ausserhalb_quartal' | 'regel';
  text: string;
}

/** Paarprüfung aus dem Entwurfs-Dossier – nur im Simulator, nie als Fehler gezählt. */
export interface QuarterCombinations {
  findings: (PairFinding & { caseIndex: number; patientToken: string | null })[];
  outOfRange: number;
  schemaVersion: string;
}

export interface QuarterReport {
  quarter: { from: IsoDate; to: IsoDate } | null;
  cases: number;
  findings: CaseFinding[];
  combinations: QuarterCombinations | null;
  parseErrors: string[];
  bySeverity: { fehler: number; hinweis: number };
}

function caseFromRecord(rec: XdtRecord, index: number): KvdtCase {
  const c: KvdtCase = { index, satzart: rec.satzart, patientToken: first(rec, '3000')?.trim() ?? null, quarter: first(rec, '4101')?.trim() ?? null, services: [], diagnoses: [], warnings: [] };
  let date: IsoDate | null = null;
  let lastService: BilledService | null = null;
  let lastDx: KvdtCase['diagnoses'][number] | null = null;
  for (const f of rec.fields) {
    if (f.fk === '5000') date = parseXdtDate(f.value);
    else if (f.fk === '5001') {
      const code = f.value.trim();
      lastService = date ? { code, system: 'EBM', date, state: 'active', session: null, evidence: [{ ref: `kvdt:${index}:${f.line}` }] } : null;
      if (lastService) c.services.push(lastService);
      else c.warnings.push(`Ziffer ${code} ohne Leistungstag (Zeile ${f.line}).`);
    } else if (f.fk === '5006' && lastService) {
      lastService.session = f.value.trim() || null;
    } else if (f.fk === '6001') {
      lastDx = { icd: f.value.trim().toUpperCase(), certainty: null, side: null };
      c.diagnoses.push(lastDx);
    } else if (f.fk === '6003' && lastDx) lastDx.certainty = f.value.trim().toUpperCase() || null;
    else if (f.fk === '6004' && lastDx) lastDx.side = f.value.trim().toUpperCase() || null;
  }
  return c;
}

export function readKvdt(data: Uint8Array): { cases: KvdtCase[]; parseErrors: string[] } {
  const parsed = parseXdt(data);
  const cases = parsed.records.filter((r) => SCHEIN_SATZARTEN.includes(r.satzart)).map(caseFromRecord);
  return { cases, parseErrors: parsed.errors };
}

/** Quartal aus FK 4101 (QJJJJ) → Zeitraum. */
function quarterRange(q: string | null): { from: IsoDate; to: IsoDate } | null {
  if (!q || !/^[1-4]\d{4}$/.test(q)) return null;
  const month = (Number(q[0]) - 1) * 3 + 1;
  const anchor = `${q.slice(1)}-${String(month).padStart(2, '0')}-01`;
  return { from: quarterStart(anchor), to: quarterEnd(anchor) };
}

export function checkQuarter(
  data: Uint8Array, settings: PracticeSettings, rules: RulePackage, mode: 'operational' | 'simulation', pairs?: PairRegistry | null,
): QuarterReport {
  const { cases, parseErrors } = readKvdt(data);
  // Entwurfsdaten sind operativ wirkungslos (wie DEMO-Regeln): nur im Simulator.
  const combinations: QuarterCombinations | null = pairs && mode === 'simulation' ? { findings: [], outOfRange: 0, schemaVersion: pairs.schemaVersion } : null;
  const findings: CaseFinding[] = [];
  const quarter = cases.map((c) => quarterRange(c.quarter)).find((q) => q !== null) ?? null;
  const add = (c: KvdtCase, severity: CaseFinding['severity'], kind: CaseFinding['kind'], text: string) =>
    findings.push({ caseIndex: c.index, patientToken: c.patientToken, severity, kind, text });

  for (const c of cases) {
    for (const w of c.warnings) add(c, 'fehler', 'leistung_ohne_datum', w);
    if (c.services.length > 0 && c.diagnoses.length === 0) add(c, 'fehler', 'keine_diagnose', 'Fall mit Leistungen, aber ohne Diagnose.');
    for (const d of c.diagnoses) if (!d.certainty) add(c, 'fehler', 'diagnose_ohne_sicherheit', `Diagnose ${d.icd} ohne Sicherheit (G/V/A/Z).`);
    const range = quarterRange(c.quarter) ?? quarter;
    if (range) {
      for (const s of c.services) {
        if (s.date < range.from || s.date > range.to) add(c, 'fehler', 'datum_ausserhalb_quartal', `Ziffer ${s.code} am ${s.date} liegt außerhalb des Quartals.`);
      }
    }
    // Regelprüfung je Leistungstag mit vollständigem Quartal (die KVDT-Datei enthält den ganzen Fall).
    if (combinations && pairs) {
      const r = checkPairs(c.services, pairs);
      combinations.outOfRange += r.outOfRange;
      combinations.findings.push(...r.findings.map((f) => ({ ...f, caseIndex: c.index, patientToken: c.patientToken })));
    }
    const coverage = range ? declareCoverage(range.from, range.to) : [];
    const days = [...new Set(c.services.map((s) => s.date))];
    for (const day of days) {
      for (const f of evaluatePackage(rules, { serviceDate: day, facts: {}, billedServices: c.services, coverage, hzvContractId: null }, settings, mode)) {
        if (f.outcome === 'billing_conflict') add(c, 'fehler', 'regel', `${f.codes.join(', ')} am ${day}: ${f.conflicts.join(' ')}`);
      }
    }
  }
  const bySeverity = { fehler: findings.filter((f) => f.severity === 'fehler').length, hinweis: findings.filter((f) => f.severity === 'hinweis').length };
  return { quarter, cases: cases.length, findings, combinations, parseErrors, bySeverity };
}
