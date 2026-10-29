import { runFertigInBackground, type BillingEntry, type FertigReport } from '../src/core/fertig.js';
import { DuriaBillingWriteback } from '../src/duria/billing-writeback.js';
import { CHANNELS } from '../src/duria/channel.js';
import { analyse, type AnalysisResponse } from '../src/core/analyze.js';
import { patientPairs } from '../src/core/patient-pairs.js';
import { confirmationKey, type PairRegistry, type PairReport, type SeparateConfirmation } from '../src/engine/pairs.js';
import { checkWindowRules, type WindowFinding, type WindowRuleSet } from '../src/engine/window-rules.js';
import { evaluateOnServices, type PracticeFinding } from '../src/rules/evaluate.js';
import { activeRules, EMPTY_FILE, parseRuleFile, type PracticeRuleFile } from '../src/rules/model.js';
import type { Facts, IsoDate, PracticeSettings, RulePackage } from '../src/domain/types.js';
import { readDuriaExport, type DuriaSnapshot } from '../src/duria/adapter.js';
import { ContextRegistry, type PatientContext } from '../src/duria/context.js';
import { DEFAULT_MAPPING } from '../src/duria/mapping.js';
import { DuriaWriteback } from '../src/duria/writeback.js';
import type { Note, PublicAccount } from '../src/notes/note.js';
import { validateRulePackage, validateSettings } from '../src/validation/validate.js';
import practice from '../config/practice.example.json';
import rulesJson from '../data/billing/rules.example.json';
import reviewedJson from '../data/billing/reviewed/hausarzt-welle1.json';
import chronicJson from '../data/billing/reviewed/chronic-dx.json';
import { loadCatalogue, rulesFor } from '../src/engine/catalogue.js';
import { NoteBook } from './notebook.js';
import { api, tauriSink, type AppConfig } from './platform.js';

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
  private readonly example: RulePackage = validated(validateRulePackage(rulesJson), 'Regelpaket');
  /** Geprüfter Katalog (Welle 1) und Liste chronischer Erkrankungen; wirken erst nach ärztlicher Freigabe. */
  readonly catalogue = loadCatalogue(reviewedJson, chronicJson);
  /** Simulator: DEMO-Regeln; operativ: geprüfter Katalog (fehlerhaft → keine Ziffernvorschläge). */
  get rules(): RulePackage { return rulesFor(this.mode, this.example, this.catalogue); }
  readonly notes: NoteBook;
  private readonly contexts = new ContextRegistry();
  private current: Current | null = null;
  private fertigJob: { cancel: () => void } | null = null;
  /** Entwurfs-Dossier der Sitzungspaare (nur Simulator), vom Fenster bei Bedarf geladen. */
  private pairRegistry: PairRegistry | null = null;
  /** Bestätigungen „getrennte Sitzungen dokumentiert“ – nur für den geöffneten Patienten, nur im Arbeitsspeicher. */
  private separate = new Map<string, SeparateConfirmation>();
  /** Pseudonym des geöffneten Patienten (von Rust); Grundlage für jede Übergabe an DURIA. */
  private token: string | null = null;

  constructor(private readonly sessionId: string, private config: AppConfig) {
    this.notes = new NoteBook(() => this.config.ollama_model);
  }

  setConfig(c: AppConfig) { this.config = c; }
  get mode() { return this.config.mode; }
  get hasPatient() { return this.current !== null; }
  get snapshot() { return this.current?.snapshot ?? null; }

  private deps() { return { mapping: DEFAULT_MAPPING, settings: this.settings, rules: this.rules, contexts: this.contexts }; }

  /**
   * `raw` ist bereits von Rust bereinigt: keine Identitätsfelder, FK 3000 enthält nur das Pseudonym (`token`).
   * Die Fachlogik arbeitet unverändert damit; die echte Nummer kennt nur das Rust-Backend.
   */
  load(raw: Uint8Array, source: 'gdt' | 'bdt', serviceDate: IsoDate, token: string | null): AnalysisResponse {
    this.fertigJob?.cancel();
    this.token = token;
    const before = this.current?.context.patientToken;
    const snapshot = readDuriaExport(raw, DEFAULT_MAPPING, source);
    const res = analyse(raw, source, { sessionId: this.sessionId, serviceDate, mode: this.mode }, this.deps());
    const ctx = this.contexts.current(this.sessionId);
    if (res.context && ctx && snapshot.patientId) {
      if (before && before !== ctx.patientToken) { this.notes.clear(); this.separate.clear(); } // Patientenwechsel
      this.current = { raw, source, snapshot, context: ctx, patientId: snapshot.patientId };
    } else {
      this.current = null;
      this.notes.clear();
      this.separate.clear();
    }
    return res;
  }

  setPairRegistry(reg: PairRegistry | null) { this.pairRegistry = reg; }

  /** Praxisregeln (praxisweit, aus praxisregeln.json). Fehlerhafte Datei → keine Regel, Meldung in `practiceError`. */
  practice: PracticeRuleFile = EMPTY_FILE;
  practiceError = '';

  async loadPractice(): Promise<void> {
    try {
      const raw = await api.rulesRead();
      const parsed = parseRuleFile(raw === null ? null : JSON.parse(raw));
      if ('error' in parsed) { this.practice = EMPTY_FILE; this.practiceError = parsed.error; } else { this.practice = parsed; this.practiceError = ''; }
    } catch (e) {
      this.practice = EMPTY_FILE;
      this.practiceError = `Praxisregeln nicht lesbar: ${String(e)}`;
    }
  }

  /** Speichert die ganze Datei (nur Ärzte; auf dem Server nur als Administrator). Erst nach Erfolg gilt sie im Fenster. */
  async savePractice(file: PracticeRuleFile): Promise<void> {
    const check = parseRuleFile(JSON.parse(JSON.stringify(file)));
    if ('error' in check) throw new Error(check.error);
    await api.rulesWrite(JSON.stringify(file, null, 2));
    this.practice = file;
    this.practiceError = '';
  }

  /** Praxisregeln auf die erfassten Leistungen des geöffneten Patienten. */
  practiceFindings(serviceDate: IsoDate, quarterComplete: boolean): PracticeFinding[] {
    if (!this.current) return [];
    return evaluateOnServices(activeRules(this.practice, serviceDate), this.current.snapshot.services, { behandlungsfallComplete: quarterComplete });
  }

  /** Regeln mit Zeitraum (Tag/Woche/Fall) und Höchstanzahlen – Entwurf, nur im Simulator. */
  private windowRules: WindowRuleSet | null = null;
  setWindowRules(r: WindowRuleSet | null) { this.windowRules = r; }
  get windowSkipped() { return this.windowRules?.skipped ?? {}; }

  /** Behandlungsfall gilt nur als vollständig, wenn der Export das ganze Quartal enthält (vom Benutzer bestätigt). */
  windowFindings(quarterComplete: boolean): WindowFinding[] | null {
    if (!this.current || this.mode !== 'simulation' || !this.windowRules) return null;
    return checkWindowRules({ services: this.current.snapshot.services, behandlungsfallComplete: quarterComplete }, this.windowRules).findings;
  }

  /** Paare der erfassten Leistungen (Entwurf); `null` außerhalb des Simulators oder ohne Dossier. */
  pairs(): PairReport | null {
    if (!this.current) return null;
    return patientPairs(this.current.snapshot, this.pairRegistry, { mode: this.mode, hzvContractId: null, confirmedSeparate: this.separate });
  }

  /** Nur ein Arzt bestätigt, dass getrennte Sitzungen in der Karteikarte dokumentiert sind (mit Kürzel und Zeit). */
  confirmSeparate(user: PublicAccount, clauseId: string, date: IsoDate) {
    if (user.role !== 'arzt') throw new Error('Nur ein Arzt kann getrennte Sitzungen bestätigen.');
    const at = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    this.separate.set(confirmationKey(clauseId, date), { by: user.kuerzel, at });
  }

  revokeSeparate(clauseId: string, date: IsoDate) { this.separate.delete(confirmationKey(clauseId, date)); }

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
    this.token = null;
    this.notes.clear();
    this.separate.clear();
    void api.closePatient();
  }

  private sink() {
    if (!this.token || !this.current || this.current.patientId !== this.token) throw new Error('Kein eindeutiger Patient geladen.');
    return tauriSink(this.token);
  }

  /** Nach Arzt-Freigabe: GDT-Datei an DURIA, wenn der Rückweg aktiv ist. */
  async send(note: Note): Promise<string> {
    if (!this.config.writeback_enabled) return 'Freigegeben. Rückweg zu DURIA ist aus – Text bitte kopieren.';
    if (!this.current) return 'Freigegeben, aber kein Patient geladen – nicht übergeben.';
    const cfg = { enabled: true, exchangeDir: '', fileName: '', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const };
    const r = await new DuriaWriteback(cfg, this.contexts, this.sink()).write(note, this.sessionId, this.current.context, this.current.patientId);
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
    const channel = CHANNELS[this.config.billing_channel] ?? CHANNELS.gdt;
    const r = await new DuriaBillingWriteback(cfg, this.contexts, this.sink(), channel.build)
      .write(accepted, user, this.sessionId, this.current.context, this.current.patientId, recorded);
    return r.ok ? `${r.written} Eintrag/Einträge an DURIA übergeben.` : r.reason;
  }

  fertig(serviceDate: IsoDate, facts: Facts, quarterConfirmed: boolean): Promise<FertigReport> {
    if (!this.current) return Promise.reject(new Error('Kein Patient geladen.'));
    this.fertigJob?.cancel();
    const job = runFertigInBackground({
      serviceDate, snapshot: this.current.snapshot, notes: this.notes.list, confirmedFacts: facts,
      quarterExportConfirmed: quarterConfirmed, hzvContractId: null, confirmedSeparate: new Map(this.separate),
      // DURIA liefert kein HZV-Merkmal: unbekannt, nie „kein HZV“. Verlauf (Vorquartale) erst mit bestätigtem Export.
      hzvStatus: 'unknown', chronicList: this.catalogue.chronic, history: null,
      practiceRules: activeRules(this.practice, serviceDate),
    }, this.settings, this.rules, this.mode, this.mode === 'simulation' ? this.pairRegistry : null);
    this.fertigJob = job;
    return job.promise;
  }
}
