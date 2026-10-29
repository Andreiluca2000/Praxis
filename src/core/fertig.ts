import { quarterEnd, quarterStart } from '../domain/dates.js';
import type { BilledService, BillingSystem, Expression, Facts, Finding, HzvStatus, IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import { declareCoverage, type DuriaSnapshot } from '../duria/adapter.js';
import { deriveChronicFacts, isApproved, type ChronicList, type DxRecord } from '../engine/chronic.js';
import { checkChronicCoding } from '../engine/dx-expectations.js';
import { patientStatus, type PatientStatus } from '../engine/patient-status.js';
import { evaluatePackage } from '../engine/evaluate.js';
import { checkPairs, type PairFinding, type PairRegistry, type SeparateConfirmation } from '../engine/pairs.js';
import type { Note } from '../notes/note.js';
import { applyToProposals, type PracticeFinding } from '../rules/evaluate.js';
import type { ActiveRule } from '../rules/model.js';

/**
 * „Fertig“: Abschlussprüfung nach der Behandlung, im Hintergrund.
 * - Prüft gegen das GANZE Quartal (Häufigkeitsgrenzen, einmal je Quartal abrechenbare Leistungen).
 * - Ergebnis sind Vorschläge; nichts wird ohne Bestätigung übernommen (BILLING_RULES.md, Abschnitt Ergebnis).
 * - Läuft asynchron und blockiert die Oberfläche nicht; kann abgebrochen werden.
 */

/** Strukturierter Eintrag, der nach Annahme als Abrechnungsdaten (nicht als Notiz) an DURIA geht. */
export type BillingEntry =
  | { type: 'ziffer'; system: BillingSystem; code: string; date: IsoDate; ruleId: string; ruleVersion: string }
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
  /** Paare „nicht nebeneinander je Sitzung“ (Entwurfs-Dossier) zwischen der vorgeschlagenen und einer erfassten Ziffer. */
  pairFindings?: PairFinding[];
  /** Hinweise aus Praxisregeln (können die Bereitschaft nur absenken). */
  practiceNotes?: PracticeFinding[];
}

export interface FertigReport {
  serviceDate: IsoDate;
  quarter: { from: IsoDate; to: IsoDate };
  quarterComplete: boolean;
  /** Neupatient / erster Kontakt im Quartal – Information, keine Ziffer (src/engine/patient-status.ts). */
  patient: PatientStatus;
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
  /** HZV-Teilnahme des Patienten; DURIA liefert sie nicht → im Fenster 'unknown', nie stillschweigend „kein HZV“. */
  hzvStatus: HzvStatus;
  /** Liste chronischer Erkrankungen; wirkt nur, wenn freigegeben (Chroniker-Fakten, Hinweise R1). */
  chronicList?: ChronicList | null;
  /** Vom Benutzer bestätigter Zeitraum des Exports für den Verlauf (Vorquartale); null = kein Verlauf. */
  history?: { from: IsoDate; to: IsoDate } | null;
  /** Bestätigungen „getrennte Sitzungen dokumentiert“ (Schlüssel `confirmationKey`). */
  confirmedSeparate?: ReadonlyMap<string, SeparateConfirmation>;
  /** Aktive Praxisregeln am Behandlungstag – senken Vorschläge höchstens ab, geben nie etwas frei. */
  practiceRules?: ActiveRule[];
}

/**
 * Paare zwischen einer vorgeschlagenen Ziffer und den bereits erfassten Leistungen desselben Tages.
 * Die Sitzung des Vorschlags ist unbekannt (null) – ein Ausschluss ergibt sich daher nur aus einer Bestätigung oder
 * bleibt „nicht prüfbar“; nie wird daraus eine Freigabe.
 */
export function pairsForProposal(
  proposed: BilledService, existing: BilledService[], reg: PairRegistry,
  opts: { hzv: boolean; confirmedSeparate?: ReadonlyMap<string, SeparateConfirmation> | undefined },
): PairFinding[] {
  const sameDay = existing.filter((s) => s.date === proposed.date);
  return checkPairs([...sameDay, proposed], reg, opts).findings
    .filter((f) => f.codes.includes(proposed.code) && f.verdict !== 'separate_confirmed');
}

const DERIVED_PREFIXES = ['diagnosis.', 'history.'];
function usesDerivedFacts(e: Expression): boolean {
  if (e.kind === 'fact') return DERIVED_PREFIXES.some((p) => e.field.startsWith(p));
  return e.kind === 'not' ? usesDerivedFacts(e.item) : e.items.some(usesDerivedFacts);
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

/**
 * `pairs`: Entwurfs-Dossier der Sitzungspaare. Es wirkt hier nur als Vorsichtsbremse – ein Paar macht aus „bereit“
 * eine „Klärung“ mit Normtext, nie umgekehrt – und gilt deshalb in beiden Modi. (Im Simulator laufen nur DEMO-Regeln,
 * deren Ziffern mit keinem EBM-/GOÄ-Paar übereinstimmen.)
 */
export function runFertig(
  input: FertigInput, settings: PracticeSettings, rules: RulePackage, mode: 'operational' | 'simulation', pairs?: PairRegistry | null,
): FertigReport {
  const registry = pairs ?? null;
  const quarter = { from: quarterStart(input.serviceDate), to: quarterEnd(input.serviceDate) };
  // Bestätigter Verlauf (Vorquartale) gilt als gelesen, wie das bestätigte Quartal.
  const coverage = [
    ...(input.quarterExportConfirmed ? declareCoverage(quarter.from, quarter.to) : input.snapshot.coverage),
    ...(input.history ? declareCoverage(input.history.from, input.history.to) : []),
  ];
  const proposals: FertigProposal[] = [];

  if (!input.quarterExportConfirmed) {
    proposals.push({
      kind: 'hinweis', readiness: 'info', finding: null, entries: [],
      title: 'Quartal nicht vollständig gelesen',
      detail: `Für ${quarter.from} bis ${quarter.to} liegen nur einzelne Tage vor. Ziffern mit Quartals- oder Häufigkeitsgrenzen bleiben „nicht prüfbar“. Bitte Quartalsexport aus DURIA laden.`,
    });
  }

  // Abgeleitete Fakten (Diagnosen, Verlauf) nur mit freigegebener Liste; Benutzerbestätigungen bleiben unverändert.
  const chronic = isApproved(input.chronicList) ? input.chronicList : null;
  const dx: DxRecord[] = input.snapshot.diagnoses.map((d) => ({ code: d.code, certainty: d.certainty, date: d.date, ref: d.ref }));
  const derived = chronic
    ? deriveChronicFacts({ serviceDate: input.serviceDate, services: input.snapshot.services, diagnoses: dx, list: chronic, history: input.history ?? null })
    : {};
  // Ohne freigegebene Liste lassen sich Diagnose-/Verlaufsfakten nicht ableiten: solche Regeln gar nicht prüfen,
  // statt bei jedem Patienten „Dokumentation unvollständig“ zu melden.
  const usable = chronic ? rules : { ...rules, rules: rules.rules.filter((r) => !usesDerivedFacts(r.eligibility)) };

  const findings = evaluatePackage(usable, {
    serviceDate: input.serviceDate,
    facts: { ...input.confirmedFacts, ...derived },
    billedServices: input.snapshot.services,
    coverage,
    hzvContractId: input.hzvContractId,
    hzvStatus: input.hzvStatus,
  }, settings, mode);

  for (const f of findings) {
    if (f.outcome === 'not_applicable' || f.outcome === 'already_billed' || f.outcome === 'excluded') continue;
    const codes = f.codes.join(', ');
    if (f.outcome === 'candidate') {
      const pairFindings = registry
        ? f.codes.flatMap((code) => pairsForProposal(
          { code, system: f.billingSystem, date: f.serviceDate, state: 'active', session: null, evidence: [] },
          input.snapshot.services, registry, { hzv: input.hzvContractId !== null, confirmedSeparate: input.confirmedSeparate },
        ))
        : [];
      if (pairFindings.length > 0) {
        // Kein „bereit“: ein Paar mit einer erfassten Ziffer desselben Tages muss erst geklärt werden.
        const blocked = pairFindings.some((p) => p.verdict === 'excluded');
        proposals.push({
          kind: 'ziffer', readiness: 'klaerung', finding: f, entries: [], pairFindings,
          title: `${blocked ? 'Nicht nebeneinander' : 'Kombination klären'}: ${codes}`,
          detail: [f.explanation, ...pairFindings.map((p) => `${p.text} (${p.sessionNote}; ${p.evidence[0]?.locator ?? p.clauseId})`)].join(' '),
        });
        continue;
      }
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

  // R1: Diagnose ↔ Ziffern im Quartal, nur Hinweise. „Vermutlich vergessen“ entfällt, wenn eine Regel zu der Ziffer schon
  // entschieden hat (auch „nein“); „Begründung fehlt“ für eine erfasste Ziffer bleibt immer.
  if (chronic) {
    const decided = new Set(findings.filter((f) => f.outcome !== 'not_applicable').flatMap((f) => f.codes));
    const shown = new Set([...decided, ...proposals.flatMap((p) => p.finding?.codes ?? [])]);
    for (const h of checkChronicCoding({ services: input.snapshot.services, diagnoses: dx, list: chronic, quarter, undatedInQuarter: false, kv: settings.region.kv, contactToday: true })) {
      if (h.kind !== 'zuschlag_ohne_diagnose' && h.codes.some((c) => shown.has(c))) continue;
      proposals.push({ kind: 'hinweis', readiness: 'klaerung', finding: null, entries: [], title: `Diagnose ↔ Ziffer: ${h.codes.join(', ')}`, detail: h.text });
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

  const finalProposals = input.practiceRules?.length
    ? applyToProposals(input.practiceRules, proposals, { facts: input.confirmedFacts, services: input.snapshot.services })
    : proposals;
  const patient = patientStatus({ serviceDate: input.serviceDate, services: input.snapshot.services, coverage, history: input.history ?? null });
  return { serviceDate: input.serviceDate, quarter, quarterComplete: input.quarterExportConfirmed, patient, proposals: finalProposals, finishedAt: new Date().toISOString() };
}

/** Hintergrund-Ausführung mit Abbruch: blockiert die Oberfläche nicht. */
export function runFertigInBackground(
  input: FertigInput, settings: PracticeSettings, rules: RulePackage, mode: 'operational' | 'simulation', pairs?: PairRegistry | null,
): { promise: Promise<FertigReport>; cancel: () => void } {
  let cancelled = false;
  const promise = new Promise<FertigReport>((resolve, reject) => {
    setTimeout(() => {
      if (cancelled) return reject(new Error('Abgebrochen.'));
      try { resolve(runFertig(input, settings, rules, mode, pairs)); } catch (e) { reject(e); }
    }, 0);
  });
  return { promise, cancel: () => { cancelled = true; } };
}
