/**
 * Domänentypen – spiegeln schemas/billing-rule.schema.json und
 * schemas/practice-settings.schema.json (Version 0.1.0).
 * Enthält keine Patientendaten; Fakten kommen zur Laufzeit vom (künftigen) DURIA-Adapter.
 */

export type IsoDate = string; // YYYY-MM-DD

// ---------- Regeln ----------

/** 'KV': regionale KV-Vertragsleistung (z. B. DMP-Symbolnummern KV Nordrhein), über KVDT abgerechnet. */
export type BillingSystem = 'EBM' | 'GOAE' | 'HZV' | 'KV' | 'DEMO';
export type RuleStatus = 'draft' | 'reviewed' | 'active' | 'retired';
export type Jurisdiction = 'DE' | 'Nordrhein' | 'Westfalen-Lippe' | 'synthetic';
export type WindowUnit = 'visit' | 'day' | 'treatment_case' | 'quarter' | 'year';

export interface RuleWindow {
  unit: WindowUnit;
  lookback_periods: number;
  anchor: 'service_date';
}

export interface RuleSource {
  id: string;
  kind: 'legal_text' | 'official_catalogue' | 'contract' | 'official_guidance' | 'synthetic';
  publisher: string;
  title: string;
  uri: string;
  version: string;
  locator: string;
  checked_on: IsoDate;
  sha256?: string | null;
  license_status: 'pending' | 'permitted_for_local_use' | 'permitted_for_distribution' | 'synthetic_owned';
}

export interface RuleReview {
  state: 'pending' | 'approved' | 'rejected' | 'not_applicable';
  reviewer: string | null;
  reviewed_at: string | null;
  rationale: string | null;
}

export const FACT_FIELDS = [
  'service.status',
  'service.date',
  'service.mode',
  'service.performer',
  'service.age_years_at_date',
  'documentation.duration_minutes',
  'documentation.required_components_complete',
  'practice.required_authorization',
  'practice.required_qualification',
  'contract.practice_participation',
  'contract.patient_enrollment',
  'contract.covers_service_date',
  'contract.service_included',
  'evidence.complete',
  'billed_services.count',
  // Abgeleitet aus Diagnosen/Leistungen (src/engine/chronic.ts), nie aus Freitext.
  'diagnosis.chronic_confirmed',
  'diagnosis.dm2_confirmed',
  'history.chronic_contact_quarters',
  'history.personal_contact_quarters',
  'history.base_03100_two_quarters_before',
  /** 03221: mind. zwei persönliche Kontakte im Quartal und Überprüfung/Anpassung der leitliniengestützten Behandlung (bestätigt). */
  'documentation.intensive_care_confirmed',
  // DMP (KV-Vertrag): Teilnahme der Praxis, Einschreibung, übermittelte Dokumentation – nur bestätigt, nie vermutet.
  'dmp.practice_participation',
  'dmp.patient_enrolled',
  'dmp.documentation_transmitted',
] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export type Scalar = string | number | boolean;
export type Operator = 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'is_known';

export interface FactExpression {
  kind: 'fact';
  field: FactField;
  operator: Operator;
  value?: Scalar | Scalar[];
  source_ids: string[];
}
export interface GroupExpression {
  kind: 'all' | 'any';
  items: Expression[];
}
export interface NotExpression {
  kind: 'not';
  item: Expression;
}
export type Expression = FactExpression | GroupExpression | NotExpression;

export type ContextDomain =
  | 'documentation'
  | 'billed_services'
  | 'practice_authorizations'
  | 'contract_terms'
  | 'practice_participation'
  | 'patient_enrollment';

export interface CombinationRule {
  /**
   * `excluded_by`: Partnerziffer im Zeitraum erfasst → die Ziffer der Regel kommt nicht in Frage (Ausschluss, kein Konflikt).
   * Für Vorschlagsregeln: ein Partner schließt den Vorschlag aus, statt eine Fehlermeldung zu erzeugen.
   */
  relationship: 'cannot_combine' | 'included_in' | 'requires_code' | 'excluded_by';
  with_codes: string[];
  window: RuleWindow;
  reason: string;
  source_ids: string[];
}

export interface FrequencyLimit {
  max_count: number;
  count_codes: string[];
  window: RuleWindow;
  source_ids: string[];
}

export type ResultType =
  | 'possible_missing_code'
  | 'documentation_incomplete'
  | 'coding_missing'
  | 'billing_conflict';

export interface Rule {
  id: string;
  version: string;
  billing_system: BillingSystem;
  status: RuleStatus;
  title: string;
  procedure_codes: string[];
  valid_from: IsoDate;
  valid_to: IsoDate | null;
  jurisdiction: Jurisdiction;
  contract_id: string | null;
  sources: RuleSource[];
  reviews: { billing: RuleReview; clinical: RuleReview };
  required_context: { domain: ContextDomain; window: RuleWindow }[];
  eligibility: Expression;
  combination_rules: CombinationRule[];
  frequency_limits: FrequencyLimit[];
  result: {
    type: ResultType;
    explanation: string;
    missing_evidence_message: string;
    requires_human_confirmation: true;
  };
}

export interface RulePackage {
  schema_version: '0.1.0';
  package_id: string;
  package_version: string;
  content_kind: 'synthetic_example' | 'reviewed_catalogue';
  rules: Rule[];
}

// ---------- Praxiseinstellungen ----------

export type Kv = 'Nordrhein' | 'Westfalen-Lippe';

export interface HzvContract {
  contract_id: string;
  name: string;
  version: string;
  kv: Kv;
  insurer_ids: string[];
  valid_from: IsoDate;
  valid_to: IsoDate | null;
  source_uri: string;
  terms_review_status: 'pending' | 'approved' | 'rejected';
  practice_participation: {
    status: 'unknown' | 'confirmed' | 'not_participating';
    valid_from: IsoDate | null;
    valid_to: IsoDate | null;
    evidence_ref: string | null;
  };
}

export interface PracticeSettings {
  schema_version: '0.1.0';
  region: { country: 'DE'; bundesland: 'NRW'; kv: Kv | null };
  available_billing_systems: ('EBM' | 'GOAE')[];
  hzv: { enabled: boolean; contracts: HzvContract[] };
  analysis: {
    default_scope: 'selected_date' | 'date_range' | 'quarter' | 'whole_record';
    unknown_condition_policy: 'not_verifiable';
    date_basis: 'service_date';
  };
  safety: {
    auto_submit_billing: false;
    auto_write_to_duria: false;
    require_patient_context_recheck: true;
    allow_patient_data_in_project_files: false;
  };
}

// ---------- Laufzeit-Fakten (vom Adapter, nie im Repository) ----------

/** Verweis auf die Fundstelle in der Dokumentation – nur lokale Referenz, kein Klartext. */
export interface EvidenceRef {
  ref: string;
  recorded_on?: IsoDate;
}

export interface FactValue {
  value: Scalar;
  /** Nur 'confirmed' gilt als belastbar; unsichere KI-Extraktion bleibt 'uncertain'. */
  verification: 'confirmed' | 'uncertain';
  contradictory?: boolean;
  evidence: EvidenceRef[];
}

export type Facts = Partial<Record<FactField, FactValue>>;

export interface BilledService {
  code: string;
  system: BillingSystem;
  date: IsoDate;
  /** Stornierte/korrigierte Einträge zählen nicht (PVS-Korrekturen). */
  state: 'active' | 'cancelled';
  /** Sitzungskennung aus der Quelle (KVDT/BDT FK 5006 Uhrzeit); fehlt sie, ist die Sitzung unbekannt. */
  session?: string | null;
  evidence: EvidenceRef[];
}

/** Tatsächlich gelesener Bereich je Datendomäne (inklusive Grenzen). */
export interface CoverageEntry {
  domain: ContextDomain;
  from: IsoDate;
  to: IsoDate;
}

export interface EvaluationInput {
  serviceDate: IsoDate;
  facts: Facts;
  billedServices: BilledService[];
  coverage: CoverageEntry[];
  /** Kennung des HZV-Vertrags des Falls, wie vom Adapter geliefert (sonst null). */
  hzvContractId?: string | null;
  /**
   * HZV-Teilnahme des Patienten – Pflicht, damit kein Aufrufer stillschweigend „kein HZV“ annimmt.
   * 'unknown' (DURIA liefert kein HZV-Merkmal) macht EBM-Regeln „nicht prüfbar“.
   */
  hzvStatus: HzvStatus;
}

export type HzvStatus = 'enrolled' | 'not_enrolled' | 'unknown';

// ---------- Ergebnisse ----------

export type Tri = 'fulfilled' | 'not_fulfilled' | 'unknown';

export interface ConditionResult {
  label: string;
  state: Tri;
  reason: string;
  evidence: EvidenceRef[];
  source_ids: string[];
}

export type Outcome =
  | 'candidate' // alle Bedingungen erfüllt, menschliche Prüfung nötig
  | 'excluded' // mindestens eine Pflichtbedingung nachweislich nicht erfüllt
  | 'already_billed' // Code bereits im relevanten Zeitraum erfasst
  | 'billing_conflict'
  | 'documentation_incomplete' // Pflichtbedingung unbekannt
  | 'not_verifiable' // Kontext/Region/Vertrag fehlt oder Datenbereich unvollständig
  | 'not_applicable'; // Regel passt nicht zu System/Region/Vertrag/Datum

export interface CoverageReport {
  domain: ContextDomain;
  required: { from: IsoDate; to: IsoDate } | null;
  complete: boolean;
  reason: string;
}

export interface Finding {
  ruleId: string;
  ruleVersion: string;
  billingSystem: BillingSystem;
  contractId: string | null;
  serviceDate: IsoDate;
  codes: string[];
  outcome: Outcome;
  /** Anzeige-Kategorie gemäß BILLING_RULES.md; null wenn nicht anwendbar. */
  category: ResultType | 'not_verifiable' | null;
  conditions: ConditionResult[];
  coverage: CoverageReport[];
  conflicts: string[];
  blockers: string[];
  existingEntries: BilledService[];
  explanation: string;
  simulated: boolean;
  requiresHumanConfirmation: true;
  settingsFingerprint: string;
}
