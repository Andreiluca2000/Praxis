import { describe, expect, it } from 'vitest';
import { analyse } from '../src/core/analyze.js';
import { DuriaBillingWriteback } from '../src/duria/billing-writeback.js';
import { ContextRegistry } from '../src/duria/context.js';
import { DEFAULT_MAPPING } from '../src/duria/mapping.js';
import type { FileSink } from '../src/duria/writeback.js';
import { concatBytes, parseXdt, xdtLine } from '../src/duria/xdt.js';
import { settings } from './fixtures.js';

/**
 * Simuliert, was das Fenster nach der Rust-Bereinigung bekommt:
 * keine Identitätsfelder, FK 3000 = Pseudonym "P-…". Die Fachlogik muss damit vollständig arbeiten,
 * und die Ausgabe darf nur das Pseudonym enthalten (Rust ersetzt es später).
 */
const TOKEN = 'P-0123456789abcdef0123';
const sanitized = concatBytes([
  xdtLine('8000', '6200'), xdtLine('3000', TOKEN), xdtLine('5000', '12112026'), xdtLine('5001', 'TEST_A'),
  xdtLine('6200', '12112026'), xdtLine('6220', 'Untersuchung heute durchgeführt, 15 Min.'),
]);
const rules = { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'synthetic_example', rules: [] } as never;

describe('Grenze Fenster ↔ Rust: Fenster arbeitet nur mit dem Pseudonym', () => {
  it('Analyse funktioniert mit bereinigten Daten', () => {
    const contexts = new ContextRegistry();
    const r = analyse(sanitized, 'bdt', { sessionId: 'S', serviceDate: '2026-11-12', mode: 'simulation' }, { mapping: DEFAULT_MAPPING, settings: settings(), rules, contexts });
    expect(r.blocked).toBeNull();
    expect(r.snapshot.droppedIdentityFields).toBe(0); // schon in Rust entfernt
    expect(r.mentions[0]?.status).toBe('performed');
  });

  it('Übergabe an DURIA enthält nur das Pseudonym (echte Nummer setzt erst Rust ein)', async () => {
    const contexts = new ContextRegistry();
    const ctx = contexts.open('S', TOKEN, sanitized, 'bdt');
    const written: Uint8Array[] = [];
    const sink: FileSink = { writeExclusive: async (_d, _n, data) => { written.push(data); return 'written'; } };
    const cfg = { enabled: true, billingEnabled: true, exchangeDir: '', fileName: '', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const };
    const arzt = { kuerzel: 'AL', name: 'Dr', role: 'arzt' as const, active: true, createdAt: '' };
    const r = await new DuriaBillingWriteback(cfg, contexts, sink).write(
      [{ entry: { type: 'diagnose', icd: 'J20.9', certainty: 'G', side: null, date: '2026-11-12' }, acceptedBy: 'AL' }],
      arzt, 'S', ctx, TOKEN, { codes: [], diagnoses: [] });
    expect(r.ok).toBe(true);
    const f = parseXdt(written[0]!).records[0]!.fields;
    expect(f.find((x) => x.fk === '3000')?.value).toBe(TOKEN);
  });
});
