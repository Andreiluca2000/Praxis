import { quarterEnd, quarterStart } from '../domain/dates.js';
import type { Facts, Finding, IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import { declareCoverage, type DuriaSnapshot } from '../duria/adapter.js';
import { evaluatePackage } from '../engine/evaluate.js';
import type { Note } from '../notes/note.js';

/**
 * „Fertig“: Abschlussprüfung nach der Behandlung, im Hintergrund.
 * - Prüft gegen das GANZE Quartal (Häufigkeitsgrenzen, einmal je Quartal abrechenbare Leistungen).
 * - Ergebnis sind Vorschläge; nichts wird ohne Bestätigung übernommen (BILLING_RULES.md, Abschnitt Ergebnis).
 * - Läuft asynchron und blockiert die Oberfläche nicht; kann abgebrochen werden.
 */

/** Strukturierter Eintrag, der nach Annahme als Abrechnungsdaten (nicht als Notiz) an DURIA geht. */
export type BillingEntry =
  | { type: 'ziffer'; system: 'EBM' | 'GOAE' | 'HZV' | 'DEMO'; code: string; date: IsoDate; ruleId: string; ruleVersion: string }
  | { type: 'diagnose'; icd: string; certainty: 'G' | 'V' | 'A' | 'Z'; side: 'R' | 'L' | 'B' | null; date: IsoDate };

export interface FertigProposal {
  kind: 'ziffer' | 'diagnose_kodieren' | 'dokumentation' | 'hinweis';
  title: string;
  detail: string;
  finding: Finding | null;
  /** Nur bei readiness 'bereit': genau das, was nach Annahme eingetragen wird. */
  entries: BillingEntry[];
  /** Nur Vorschläge mit 'bereit' können nach Bestätigung übergeben werden. */
  readiness: 'bereit' | 'klaerung' | 'info';
}

export interface FertigReport {
  serviceDate: IsoDate;
  quarter: { from: IsoDate; to: IsoDate };
  quarterComplete: boolean;
  proposals: FertigProposal[];
  finishedAt: string;
}

export interface FertigInput {
  serviceDate: IsoDate;
  snapshot: DuriaSnapshot;
  notes: Note[];
  confirmedFacts: Facts;
  /** Bestätigt der Benutzer bzw. der DURIA-Export (Quartalsexport), dass das ganze Quartal enthalten ist? */
  quarterExportConfirmed: boolean;
  hzvContractId: string | null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

export function runFertig(input: FertigInput, settings: PracticeSettings, rules: RulePackage, mode: 'operational' | 'simulation'): FertigReport {
  const quarter = { from: quarterStart(input.serviceDate), to: quarterEnd(input.serviceDate) };
  const coverage = input.quarterExportConfirmed
    ? declareCoverage(quarter.from, quarter.to)
    : input.snapshot.coverage;
  const proposals: FertigProposal[] = [];

  if (!input.quarterExportConfirmed) {
    proposals.push({
      kind: 'hinweis', readiness: 'info', finding: null, entries: [],
      title: 'Quartal nicht vollständig gelesen',
      detail: `Für ${quarter.from} bis ${quarter.to} liegen nur einzelne Tage vor. Ziffern mit Quartals- oder Häufigkeitsgrenzen bleiben „nicht prüfbar“. Bitte Quartalsexport aus DURIA laden.`,
    });
  }

  const findings = evaluatePackage(rules, {
    serviceDate: input.serviceDate,
    facts: input.confirmedFacts,
    billedServices: input.snapshot.services,
    coverage,
    hzvContractId: input.hzvContractId,
  }, settings, mode);

  for (const f of findings) {
    if (f.outcome === 'not_applicable' || f.outcome === 'already_billed' || f.outcome === 'excluded') continue;
    const codes = f.codes.join(', ');
    if (f.outcome === 'candidate') {
      const entries: BillingEntry[] = f.codes.map((code) => ({
        type: 'ziffer', system: f.billingSystem, code, date: f.serviceDate, ruleId: f.ruleId, ruleVersion: f.ruleVersion,
      }));
      proposals.push({ kind: 'ziffer', readiness: 'bereit', finding: f, entries, title: `Möglicherweise fehlend: ${codes}`, detail: f.explanation });
    } else if (f.outcome === 'billing_conflict') {
      proposals.push({ kind: 'hinweis', readiness: 'klaerung', finding: f, entries: [], title: `Konflikt bei ${codes}`, detail: f.conflicts.join(' ') });
    } else {
      proposals.push({ kind: 'dokumentation', readiness: 'klaerung', finding: f, entries: [], title: `${codes}: ${f.outcome === 'documentation_incomplete' ? 'Dokumentation unvollständig' : 'nicht prüfbar'}`, detail: [f.explanation, ...f.blockers].join(' ') });
    }
  }

  // BILL-13: Im Diktat genannte Diagnose ohne erfassten Code → „mögliche fehlende Kodierung“, nie automatisch kodiert.
  const coded = input.snapshot.diagnoses.filter((d) => d.date === input.serviceDate).map((d) => d.code);
  for (const note of input.notes.filter((n) => n.serviceDate === input.serviceDate)) {
    for (const d of note.diagnoses) {
      if (d.icd && coded.includes(d.icd.toUpperCase())) continue;
      const alreadyAsked = proposals.some((p) => p.kind === 'diagnose_kodieren' && norm(p.title).includes(norm(d.text)));
      if (alreadyAsked) continue;
      // Bereit nur mit ICD-Code UND Diagnosesicherheit, vom Arzt eingetragen – nie automatisch „G“.
      const ready = Boolean(d.icd && d.certainty && d.confirmedBy);
      const entries: BillingEntry[] = ready
        ? [{ type: 'diagnose', icd: d.icd!.toUpperCase(), certainty: d.certainty!, side: null, date: input.serviceDate }]
        : [];
      proposals.push({
        kind: 'diagnose_kodieren', readiness: ready ? 'bereit' : 'klaerung', finding: null, entries,
        title: `Diagnose im Diktat ohne Kodierung: „${d.text}“`,
        detail: d.icd
          ? `Vorgeschlagen: ${d.icd}${d.certainty ? ` ${d.certainty}` : ''} – nicht in DURIA erfasst.`
          : 'ICD-Code und Diagnosesicherheit (G/V/A/Z) bitte auswählen; es wird nichts automatisch gesetzt.',
      });
    }
  }

  return { serviceDate: input.serviceDate, quarter, quarterComplete: input.quarterExportConfirmed, proposals, finishedAt: new Date().toISOString() };
}

/** Hintergrund-Ausführung mit Abbruch: blockiert die Oberfläche nicht. */
export function runFertigInBackground(
  input: FertigInput, settings: PracticeSettings, rules: RulePackage, mode: 'operational' | 'simulation',
): { promise: Promise<FertigReport>; cancel: () => void } {
  let cancelled = false;
  const promise = new Promise<FertigReport>((resolve, reject) => {
    setTimeout(() => {
      if (cancelled) return reject(new Error('Abgebrochen.'));
      try { resolve(runFertig(input, settings, rules, mode)); } catch (e) { reject(e); }
    }, 0);
  });
  return { promise, cancel: () => { cancelled = true; } };
}
