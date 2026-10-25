import { describe, expect, it } from 'vitest';
import { runFertig, runFertigInBackground, type FertigInput } from '../src/core/fertig.js';
import type { RulePackage } from '../src/domain/types.js';
import { readDuriaExport } from '../src/duria/adapter.js';
import { DEFAULT_MAPPING } from '../src/duria/mapping.js';
import type { Note } from '../src/notes/note.js';
import { confirmed, settings, testRule } from './fixtures.js';
import { syntheticBdt } from './synthetic-bdt.js';

const pkg = (rules = [testRule({ procedure_codes: ['TEST_NEU'] })]): RulePackage =>
  ({ schema_version: '0.1.0', package_id: 'TEST', package_version: '1', content_kind: 'reviewed_catalogue', rules });
const facts = { 'service.status': confirmed('performed'), 'documentation.duration_minutes': confirmed(15) };
const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1', serviceDate: '2026-11-12', author: 'AL', authorRole: 'arzt', form: 'kurz', transcript: 't',
  text: 'Husten, Lunge frei.', diagnoses: [], status: 'entwurf', releasedBy: null, releasedAt: null, generator: 'regelbasiert', ...over,
});
const input = (over: Partial<FertigInput> = {}): FertigInput => ({
  serviceDate: '2026-11-12', snapshot: readDuriaExport(syntheticBdt(), DEFAULT_MAPPING, 'bdt'),
  notes: [], confirmedFacts: facts, quarterExportConfirmed: true, hzvContractId: null, ...over,
});
const QUARTER_RULE = testRule({
  procedure_codes: ['TEST_NEU'],
  required_context: [{ domain: 'billed_services', window: { unit: 'quarter', lookback_periods: 0, anchor: 'service_date' } }],
  frequency_limits: [{ max_count: 1, count_codes: ['TEST_NEU'], window: { unit: 'quarter', lookback_periods: 0, anchor: 'service_date' }, source_ids: ['TEST_SRC'] }],
});

describe('„Fertig“ – Abschlussprüfung im Hintergrund', () => {
  it('ohne Quartalsexport: Hinweis, Quartalsregel nicht als fehlend vorgeschlagen', () => {
    const r = runFertig(input({ quarterExportConfirmed: false }), settings(), pkg([QUARTER_RULE]), 'operational');
    expect(r.quarter).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(r.proposals[0]?.title).toMatch(/Quartal nicht vollständig/);
    expect(r.proposals.some((p) => p.kind === 'ziffer')).toBe(false);
  });

  it('mit Quartalsexport: fehlende Ziffer als bestätigungspflichtiger Vorschlag', () => {
    const z = runFertig(input(), settings(), pkg([QUARTER_RULE]), 'operational').proposals.find((p) => p.kind === 'ziffer');
    expect(z).toMatchObject({ readiness: 'bereit' });
    expect(z?.finding?.requiresHumanConfirmation).toBe(true);
  });

  it('nur einmal je Quartal: im Oktober schon abgerechnet → kein Vorschlag im November', () => {
    const snapshot = readDuriaExport(syntheticBdt(), DEFAULT_MAPPING, 'bdt');
    snapshot.services.push({ code: 'TEST_NEU', system: 'EBM', date: '2026-10-07', state: 'active', evidence: [{ ref: 'pvs#okt' }] });
    const r = runFertig(input({ snapshot }), settings(), pkg([QUARTER_RULE]), 'operational');
    expect(r.proposals.some((p) => p.kind === 'ziffer')).toBe(false);
  });

  it('BILL-13: Diagnose im Diktat ohne Kodierung → Klärung, nichts automatisch kodiert', () => {
    const n = note({ diagnoses: [{ text: 'akute Bronchitis', icd: null, certainty: null, confirmedBy: null }] });
    const r = runFertig(input({ notes: [n], confirmedFacts: {} }), settings(), pkg(), 'operational');
    expect(r.proposals.find((p) => p.kind === 'diagnose_kodieren')).toMatchObject({ readiness: 'klaerung' });
  });

  it('bereits in DURIA kodierte Diagnose wird nicht erneut vorgeschlagen', () => {
    const n = note({ diagnoses: [{ text: 'Infekt', icd: 'J06.9', certainty: 'G', confirmedBy: 'AL' }] });
    const r = runFertig(input({ notes: [n], confirmedFacts: {} }), settings(), pkg(), 'operational');
    expect(r.proposals.some((p) => p.kind === 'diagnose_kodieren')).toBe(false);
  });

  it('läuft asynchron und ist abbrechbar', async () => {
    const job = runFertigInBackground(input(), settings(), pkg(), 'operational');
    job.cancel();
    await expect(job.promise).rejects.toThrow(/Abgebrochen/);
    await expect(runFertigInBackground(input(), settings(), pkg(), 'operational').promise).resolves.toHaveProperty('proposals');
  });
});
