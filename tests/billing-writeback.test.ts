import { describe, expect, it } from 'vitest';
import type { BillingEntry } from '../src/core/fertig.js';
import { DuriaBillingWriteback, type AcceptedEntry } from '../src/duria/billing-writeback.js';
import { ContextRegistry } from '../src/duria/context.js';
import type { FileSink } from '../src/duria/writeback.js';
import { parseXdt } from '../src/duria/xdt.js';

const arzt = { kuerzel: 'AL', name: 'Dr. Test', role: 'arzt' as const, active: true, createdAt: '' };
const mfa = { ...arzt, kuerzel: 'MF', role: 'mfa' as const };
const ziffer = (code: string, date = '2026-11-12'): BillingEntry => ({ type: 'ziffer', system: 'EBM', code, date, ruleId: 'R', ruleVersion: '1' });
const diag = (icd: string): BillingEntry => ({ type: 'diagnose', icd, certainty: 'G', side: null, date: '2026-11-12' });
const acc = (...e: BillingEntry[]): AcceptedEntry[] => e.map((entry) => ({ entry, acceptedBy: 'AL' }));
const none = { codes: [], diagnoses: [] };

class MemorySink implements FileSink {
  files: Uint8Array[] = [];
  async writeExclusive(_d: string, _n: string, data: Uint8Array) {
    if (this.files.length) return 'exists' as const;
    this.files.push(data);
    return 'written' as const;
  }
}

function setup(billingEnabled = true) {
  const sink = new MemorySink();
  const contexts = new ContextRegistry();
  const ctx = contexts.open('PC1', '99001', new TextEncoder().encode('rev'), 'bdt');
  const cfg = { enabled: true, billingEnabled, exchangeDir: 'X', fileName: 'PRAX_DUR.gdt', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const };
  return { sink, contexts, ctx, wb: new DuriaBillingWriteback(cfg, contexts, sink) };
}

describe('Übernahme angenommener Ziffern/Diagnosen als Abrechnungsdaten', () => {
  it('schreibt Ziffern (5001) und Diagnosen (6001/6003) mit Datum, nicht als Notiztext', async () => {
    const { wb, ctx, sink } = setup();
    const r = await wb.write(acc(ziffer('TEST_A'), diag('J20.9')), arzt, 'PC1', ctx, '99001', none);
    expect(r).toMatchObject({ ok: true, written: 2 });
    const parsed = parseXdt(sink.files[0]!);
    expect(parsed.errors).toEqual([]);
    const f = parsed.records[0]!.fields;
    const val = (fk: string) => f.filter((x) => x.fk === fk).map((x) => x.value);
    expect(val('5000')).toEqual(['12112026']);
    expect(val('5001')).toEqual(['TEST_A']);
    expect(val('6001')).toEqual(['J20.9']);
    expect(val('6003')).toEqual(['G']);
    expect(val('6228')[0]).toContain('[AL]');
    // Reihenfolge: Ziffer steht nach ihrem Datum
    expect(f.findIndex((x) => x.fk === '5001')).toBeGreaterThan(f.findIndex((x) => x.fk === '5000'));
  });

  it('bereits in DURIA erfasste Einträge werden nicht doppelt geschrieben', async () => {
    const { wb, ctx, sink } = setup();
    const r = await wb.write(acc(ziffer('TEST_A'), ziffer('TEST_B')), arzt, 'PC1', ctx, '99001',
      { codes: [{ code: 'TEST_A', date: '2026-11-12' }], diagnoses: [] });
    expect(r).toMatchObject({ ok: true, written: 1 });
    expect(parseXdt(sink.files[0]!).records[0]!.fields.filter((x) => x.fk === '5001').map((x) => x.value)).toEqual(['TEST_B']);
  });

  it('nur Arzt; MFA kann nicht übernehmen', async () => {
    const { wb, ctx } = setup();
    expect(await wb.write(acc(ziffer('TEST_A')), mfa, 'PC1', ctx, '99001', none)).toMatchObject({ ok: false });
  });

  it('DEMO-Ziffern nie; Schalter aus → nichts', async () => {
    const { wb, ctx } = setup();
    const demo: BillingEntry = { ...ziffer('DEMO_SERVICE_A'), system: 'DEMO' } as BillingEntry;
    expect(await wb.write(acc(demo), arzt, 'PC1', ctx, '99001', none)).toMatchObject({ ok: false, reason: expect.stringMatching(/DEMO/) });
    const off = setup(false);
    expect(await off.wb.write(acc(ziffer('TEST_A')), arzt, 'PC1', off.ctx, '99001', none)).toMatchObject({ ok: false, reason: expect.stringMatching(/nicht aktiviert/) });
  });

  it('Patientenwechsel → gesperrt; gleiche Einträge nie zweimal', async () => {
    const { wb, ctx, contexts, sink } = setup();
    const entries = acc(ziffer('TEST_A'));
    expect((await wb.write(entries, arzt, 'PC1', ctx, '99001', none)).ok).toBe(true);
    sink.files = [];
    expect(await wb.write(entries, arzt, 'PC1', ctx, '99001', none)).toMatchObject({ ok: false, reason: expect.stringMatching(/bereits übergeben/) });
    contexts.open('PC1', '99002', new TextEncoder().encode('x'), 'bdt');
    expect((await wb.write(acc(ziffer('TEST_C')), arzt, 'PC1', ctx, '99001', none)).ok).toBe(false);
  });
});
