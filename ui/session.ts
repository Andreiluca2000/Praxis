import { runFertigInBackground, type BillingEntry, type FertigReport } from '../src/core/fertig.js';
import { DuriaBillingWriteback } from '../src/duria/billing-writeback.js';
import { analyse, type AnalysisResponse } from '../src/core/analyze.js';
import type { Facts, IsoDate, PracticeSettings, RulePackage } from '../src/domain/types.js';
import { readDuriaExport, type DuriaSnapshot } from '../src/duria/adapter.js';
import { ContextRegistry, type PatientContext } from '../src/duria/context.js';
import { DEFAULT_MAPPING } from '../src/duria/mapping.js';
import { DuriaWriteback } from '../src/duria/writeback.js';
import type { Note, PublicAccount } from '../src/notes/note.js';
import { validateRulePackage, validateSettings } from '../src/validation/validate.js';
import practice from '../config/practice.example.json';
import rulesJson from '../data/billing/rules.example.json';
import { NoteBook } from './notebook.js';
import { tauriSink, type AppConfig } from './platform.js';

/**
 * Behandlungssitzung im Fenster: Patientendaten nur im Arbeitsspeicher, nie gespeichert.
 * Fachlogik kommt unverändert aus src/ (dort mit Tests abgesichert).
 */

function validated<T>(r: { ok: boolean; value: T | null; errors: string[] }, name: string): T {
  if (!r.ok || !r.value) throw new Error(`${name} ungültig: ${r.errors.join('; ')}`);
  return r.value;
}

export const today = (): IsoDate => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Current {
  raw: Uint8Array;
  source: 'gdt' | 'bdt';
  snapshot: DuriaSnapshot;
  context: PatientContext;
  patientId: string;
}

export class TreatmentSession {
  settings: PracticeSettings = validated(validateSettings(practice), 'Praxiseinstellungen');
  readonly rules: RulePackage = validated(validateRulePackage(rulesJson), 'Regelpaket');
  readonly notes: NoteBook;
  private readonly contexts = new ContextRegistry();
  private current: Current | null = null;
  private fertigJob: { cancel: () => void } | null = null;

  constructor(private readonly sessionId: string, private config: AppConfig) {
    this.notes = new NoteBook(() => this.config.ollama_model);
  }

  setConfig(c: AppConfig) { this.config = c; }
  get mode() { return this.config.mode; }
  get hasPatient() { return this.current !== null; }
  get snapshot() { return this.current?.snapshot ?? null; }

  private deps() { return { mapping: DEFAULT_MAPPING, settings: this.settings, rules: this.rules, contexts: this.contexts }; }

  load(raw: Uint8Array, name: string, serviceDate: IsoDate): AnalysisResponse {
    this.fertigJob?.cancel();
    const source = name.toLowerCase().endsWith('.bdt') ? 'bdt' : 'gdt';
    const before = this.current?.context.patientToken;
    const snapshot = readDuriaExport(raw, DEFAULT_MAPPING, source);
    const res = analyse(raw, source, { sessionId: this.sessionId, serviceDate, mode: this.mode }, this.deps());
    const ctx = this.contexts.current(this.sessionId);
    if (res.context && ctx && snapshot.patientId) {
      if (before && before !== ctx.patientToken) this.notes.clear(); // Patientenwechsel
      this.current = { raw, source, snapshot, context: ctx, patientId: snapshot.patientId };
    } else {
      this.current = null;
      this.notes.clear();
    }
    return res;
  }

  reanalyse(serviceDate: IsoDate, facts: Facts, range: { from: IsoDate; to: IsoDate } | null): AnalysisResponse {
    if (!this.current) throw new Error('Kein Patient geladen.');
    const res = analyse(this.current.raw, this.current.source, {
      sessionId: this.sessionId, serviceDate, confirmedFacts: facts, declaredRange: range, mode: this.mode,
    }, this.deps());
    const ctx = this.contexts.current(this.sessionId);
    if (ctx) this.current.context = ctx;
    return res;
  }

  clear() {
    this.fertigJob?.cancel();
    this.contexts.close(this.sessionId);
    this.current = null;
    this.notes.clear();
  }

  /** Nach Arzt-Freigabe: GDT-Datei an DURIA, wenn der Rückweg aktiv ist. */
  async send(note: Note): Promise<string> {
    if (!this.config.writeback_enabled) return 'Freigegeben. Rückweg zu DURIA ist aus – Text bitte kopieren.';
    if (!this.current) return 'Freigegeben, aber kein Patient geladen – nicht übergeben.';
    const cfg = { enabled: true, exchangeDir: '', fileName: '', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const };
    const r = await new DuriaWriteback(cfg, this.contexts, tauriSink).write(note, this.sessionId, this.current.context, this.current.patientId);
    return r.ok ? 'An DURIA übergeben.' : r.reason;
  }

  /** Angenommene Vorschläge als Abrechnungsdaten (Ziffern/Diagnosen) an DURIA – nicht als Notiz. */
  async sendBilling(user: PublicAccount, entries: BillingEntry[]): Promise<string> {
    if (!this.current) return 'Kein Patient geladen.';
    const cfg = {
      enabled: true, billingEnabled: this.config.billing_writeback_enabled,
      exchangeDir: '', fileName: '', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const,
    };
    const snap = this.current.snapshot;
    const recorded = {
      codes: snap.services.filter((s) => s.state === 'active').map((s) => ({ code: s.code, date: s.date })),
      diagnoses: snap.diagnoses.filter((d) => d.date).map((d) => ({ icd: d.code, date: d.date! })),
    };
    const accepted = entries.map((entry) => ({ entry, acceptedBy: user.kuerzel }));
    const r = await new DuriaBillingWriteback(cfg, this.contexts, tauriSink)
      .write(accepted, user, this.sessionId, this.current.context, this.current.patientId, recorded);
    return r.ok ? `${r.written} Eintrag/Einträge an DURIA übergeben.` : r.reason;
  }

  fertig(serviceDate: IsoDate, facts: Facts, quarterConfirmed: boolean): Promise<FertigReport> {
    if (!this.current) return Promise.reject(new Error('Kein Patient geladen.'));
    this.fertigJob?.cancel();
    const job = runFertigInBackground({
      serviceDate, snapshot: this.current.snapshot, notes: this.notes.list, confirmedFacts: facts,
      quarterExportConfirmed: quarterConfirmed, hzvContractId: null,
    }, this.settings, this.rules, this.mode);
    this.fertigJob = job;
    return job.promise;
  }
}
