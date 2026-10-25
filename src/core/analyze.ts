import type { Facts, Finding, IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import { declareCoverage, readDuriaExport, type DuriaSnapshot } from '../duria/adapter.js';
import type { ContextRegistry, PatientContext } from '../duria/context.js';
import type { XdtMapping } from '../duria/mapping.js';
import { evaluatePackage } from '../engine/evaluate.js';
import { classifyMention, type Mention } from '../facts/extract.js';

/**
 * Verbindet Adapter, Faktenerkennung und Prüfmotor für eine Sitzung.
 * Erkannte Fakten sind Vorschläge ('uncertain'); erst die Bestätigung im UI macht sie 'confirmed'.
 */

export interface AnalysisRequest {
  sessionId: string;
  serviceDate: IsoDate;
  /** Vom Benutzer bestätigt: Export umfasst den ganzen Zeitraum (sonst zählen nur gelesene Tage). */
  declaredRange?: { from: IsoDate; to: IsoDate } | null;
  confirmedFacts?: Facts;
  hzvContractId?: string | null;
  mode: 'operational' | 'simulation';
}

export interface AnalysisResponse {
  context: Omit<PatientContext, 'sessionId'> | null;
  snapshot: Omit<DuriaSnapshot, 'patientId' | 'notes'> & { noteCount: number };
  mentions: (Mention & { text: string })[];
  findings: Finding[];
  blocked: string | null;
}

export function analyse(
  raw: Uint8Array,
  source: 'gdt' | 'bdt',
  req: AnalysisRequest,
  deps: { mapping: XdtMapping; settings: PracticeSettings; rules: RulePackage; contexts: ContextRegistry },
): AnalysisResponse {
  const snap = readDuriaExport(raw, deps.mapping, source);
  const { patientId, notes, ...rest } = snap;
  const snapshot = { ...rest, noteCount: notes.length };

  if (!patientId) {
    deps.contexts.close(req.sessionId);
    const blocked = snap.multiplePatients ? 'Mehrere Patienten im Export.' : 'Kein eindeutiger Patient im Export.';
    return { context: null, snapshot, mentions: [], findings: [], blocked };
  }

  const ctx = deps.contexts.open(req.sessionId, patientId, raw, source);
  const mentions = notes
    .filter((n) => n.date === req.serviceDate)
    .map((n) => ({ ...classifyMention(n.text, n.date, n.ref), text: n.text }));

  const coverage = req.declaredRange ? declareCoverage(req.declaredRange.from, req.declaredRange.to) : snap.coverage;
  const findings = evaluatePackage(
    deps.rules,
    {
      serviceDate: req.serviceDate,
      facts: req.confirmedFacts ?? {},
      billedServices: snap.services,
      coverage,
      hzvContractId: req.hzvContractId ?? null,
    },
    deps.settings,
    req.mode,
  );
  const { sessionId: _omit, ...context } = ctx;
  return { context, snapshot, mentions, findings, blocked: null };
}
