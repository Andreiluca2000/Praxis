/**
 * Synthetische Testbausteine. KEINE echten Patientendaten, KEINE echten GOP/GOÄ-Ziffern.
 * Kennungen mit Präfix TEST_ sind ausschließlich für den Testkontext bestimmt (ACCEPTANCE.md).
 */
import type {
  BilledService, CoverageEntry, EvaluationInput, Expression, FactField, FactValue, Facts,
  Operator, PracticeSettings, Rule, RuleSource, Scalar,
} from '../src/domain/types.js';

export const DATE = '2026-11-12'; // Q4 2026
export const Q4 = { from: '2026-10-01', to: '2026-12-31' };

export function settings(over: Partial<PracticeSettings> = {}): PracticeSettings {
  return {
    schema_version: '0.1.0',
    region: { country: 'DE', bundesland: 'NRW', kv: null },
    available_billing_systems: ['EBM', 'GOAE'],
    hzv: { enabled: false, contracts: [] },
    analysis: { default_scope: 'selected_date', unknown_condition_policy: 'not_verifiable', date_basis: 'service_date' },
    safety: { auto_submit_billing: false, auto_write_to_duria: false, require_patient_context_recheck: true, allow_patient_data_in_project_files: false },
    ...over,
  };
}

export const TEST_SOURCE: RuleSource = {
  id: 'TEST_SRC',
  kind: 'official_catalogue',
  publisher: 'Testkontext',
  title: 'Fiktive Quelle nur für automatisierte Tests',
  uri: 'urn:praxis-assistent:test:source',
  version: '1',
  locator: 'Testabschnitt 1',
  checked_on: '2026-10-25',
  sha256: null,
  license_status: 'permitted_for_local_use',
};

export const fact = (field: FactField, operator: Operator, value?: Scalar | Scalar[]): Expression =>
  value === undefined
    ? { kind: 'fact', field, operator, source_ids: ['TEST_SRC'] }
    : { kind: 'fact', field, operator, value, source_ids: ['TEST_SRC'] };

/**
 * Fiktive Testregel (ACCEPTANCE.md BILL-01…03): lokal erbracht, Dauer ≥ 10 Minuten, kein Duplikat.
 * Als „active“ markiert, damit der operative Pfad testbar ist – existiert nur im Testkontext.
 */
export function testRule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'TEST_SERVICE_10_MIN',
    version: '1',
    billing_system: 'EBM',
    status: 'active',
    title: 'Fiktive Testleistung (≥ 10 Minuten)',
    procedure_codes: ['TEST_SERVICE_10_MIN'],
    valid_from: '2026-01-01',
    valid_to: null,
    jurisdiction: 'DE',
    contract_id: null,
    sources: [TEST_SOURCE],
    reviews: {
      billing: { state: 'approved', reviewer: 'test-reviewer', reviewed_at: '2026-10-25T10:00:00Z', rationale: 'Testkontext' },
      clinical: { state: 'not_applicable', reviewer: 'test-reviewer', reviewed_at: '2026-10-25T10:00:00Z', rationale: 'Rein formale Testregel' },
    },
    required_context: [
      { domain: 'documentation', window: { unit: 'visit', lookback_periods: 0, anchor: 'service_date' } },
      { domain: 'billed_services', window: { unit: 'day', lookback_periods: 0, anchor: 'service_date' } },
    ],
    eligibility: {
      kind: 'all',
      items: [fact('service.status', 'eq', 'performed'), fact('documentation.duration_minutes', 'gte', 10)],
    },
    combination_rules: [],
    frequency_limits: [],
    result: {
      type: 'possible_missing_code',
      explanation: 'Fiktiver Kandidat zur Prüfung.',
      missing_evidence_message: 'Nachweise fehlen; nichts wird angenommen.',
      requires_human_confirmation: true,
    },
    ...over,
  };
}

export const confirmed = (value: Scalar, ref = 'doc#1'): FactValue => ({ value, verification: 'confirmed', evidence: [{ ref }] });

export const fullCoverage = (from = DATE, to = DATE): CoverageEntry[] => [
  { domain: 'documentation', from, to },
  { domain: 'billed_services', from, to },
];

export function input(facts: Facts, over: Partial<EvaluationInput> = {}): EvaluationInput {
  return { serviceDate: DATE, facts, billedServices: [], coverage: fullCoverage(), ...over };
}

export const billed = (code: string, date = DATE, state: BilledService['state'] = 'active'): BilledService => ({
  code, system: 'EBM', date, state, evidence: [{ ref: `pvs#${code}@${date}` }],
});
