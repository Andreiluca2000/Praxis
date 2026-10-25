import { describe, expect, it } from 'vitest';
import { evaluateRule } from '../src/engine/evaluate.js';
import type { HzvContract, PracticeSettings } from '../src/domain/types.js';
import { confirmed, input, settings, testRule } from './fixtures.js';

const ok12 = { 'service.status': confirmed('performed'), 'documentation.duration_minutes': confirmed(12) };
const enrolled = { ...ok12, 'contract.patient_enrollment': confirmed(true) };

const contract = (over: Partial<HzvContract> = {}): HzvContract => ({
  contract_id: 'TEST_HZV', name: 'Fiktiver Testvertrag', version: '1', kv: 'Nordrhein',
  insurer_ids: ['TEST_KK'], valid_from: '2026-01-01', valid_to: null,
  source_uri: 'urn:praxis-assistent:test:hzv', terms_review_status: 'approved',
  practice_participation: { status: 'confirmed', valid_from: '2026-01-01', valid_to: null, evidence_ref: 'local#teilnahme' },
  ...over,
});
const hzvSettings = (c: HzvContract[] = [contract()]): PracticeSettings =>
  settings({ region: { country: 'DE', bundesland: 'NRW', kv: 'Nordrhein' }, hzv: { enabled: true, contracts: c } });
const hzvRule = testRule({ billing_system: 'HZV', contract_id: 'TEST_HZV', jurisdiction: 'Nordrhein' });

const run = (s: PracticeSettings, facts: object = enrolled, hzvContractId: string | null = 'TEST_HZV') =>
  evaluateRule(hzvRule, input(facts, { hzvContractId }), s, 'operational');

describe('HZV – ACCEPTANCE.md HZV-01…06', () => {
  it('Referenz: vollständig belegt → Kandidat', () => {
    expect(run(hzvSettings()).outcome).toBe('candidate');
  });

  it('HZV-01: Modul aktiv, Vertrag fehlt → nicht prüfbar mit Grund', () => {
    const f = run(hzvSettings([]));
    expect(f.outcome).toBe('not_verifiable');
    expect(f.blockers.join(' ')).toMatch(/nicht konfiguriert/);
  });

  it('HZV-02: Einschreibung unbekannt → nicht angenommen', () => {
    expect(run(hzvSettings(), ok12, null).outcome).toBe('not_verifiable');
  });

  it('HZV-03: Einschreibung für das Leistungsdatum nicht belegt → nicht rückwirkend', () => {
    expect(run(hzvSettings(), ok12).outcome).toBe('documentation_incomplete');
    expect(run(hzvSettings(), { ...ok12, 'contract.patient_enrollment': confirmed(false) }).outcome).toBe('excluded');
  });

  it('HZV-04: Teilnahme der Praxis unbestätigt → Menüauswahl ist kein Nachweis', () => {
    const c = contract({ practice_participation: { status: 'unknown', valid_from: null, valid_to: null, evidence_ref: null } });
    expect(run(hzvSettings([c])).outcome).toBe('not_verifiable');
  });

  it('Vertrag am Leistungsdatum nicht gültig → nicht anwendbar', () => {
    expect(run(hzvSettings([contract({ valid_from: '2027-01-01' })])).outcome).toBe('not_applicable');
  });

  it('HZV-05: im HZV-Fall enthaltene Leistung über EBM → mögliche Doppelabrechnung', () => {
    const s = hzvSettings();
    const inc = evaluateRule(testRule(), input({ ...ok12, 'contract.service_included': confirmed(true) }, { hzvContractId: 'TEST_HZV' }), s, 'operational');
    expect(inc.outcome).toBe('not_verifiable');
    expect(inc.blockers.join(' ')).toMatch(/Doppelabrechnung/);
    const unknown = evaluateRule(testRule(), input(ok12, { hzvContractId: 'TEST_HZV' }), s, 'operational');
    expect(unknown.blockers.join(' ')).toMatch(/kein automatischer EBM-Weg/);
    const notIncluded = evaluateRule(testRule(), input({ ...ok12, 'contract.service_included': confirmed(false) }, { hzvContractId: 'TEST_HZV' }), s, 'operational');
    expect(notIncluded.outcome).toBe('candidate');
  });

  it('HZV-06: Modul in UI deaktiviert, Fall ist HZV → kein stiller Wechsel zu EBM', () => {
    const off = settings({ hzv: { enabled: false, contracts: [] } });
    expect(evaluateRule(hzvRule, input(enrolled, { hzvContractId: 'TEST_HZV' }), off, 'operational').outcome).toBe('not_applicable');
    expect(evaluateRule(testRule(), input(ok12, { hzvContractId: 'TEST_HZV' }), off, 'operational').outcome).toBe('not_verifiable');
  });
});
