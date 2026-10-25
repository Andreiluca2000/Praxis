import { describe, expect, it } from 'vitest';
import type { BillingEntry } from '../src/core/fertig.js';
import { DuriaBillingWriteback } from '../src/duria/billing-writeback.js';
import { CHANNELS } from '../src/duria/channel.js';
import { ContextRegistry } from '../src/duria/context.js';
import type { FileSink } from '../src/duria/writeback.js';

const arzt = { kuerzel: 'AL', name: 'Dr', role: 'arzt' as const, active: true, createdAt: '' };
const entries: BillingEntry[] = [
  { type: 'ziffer', system: 'EBM', code: 'TEST_A', date: '2026-11-12', ruleId: 'R', ruleVersion: '1' },
  { type: 'diagnose', icd: 'J20.9', certainty: 'G', side: null, date: '2026-11-12' },
];
const cfg = { enabled: true, billingEnabled: true, exchangeDir: 'X', fileName: 'out', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const };

async function send(channel: keyof typeof CHANNELS) {
  const contexts = new ContextRegistry();
  const ctx = contexts.open('S', 'P-tok', new Uint8Array([1]), 'gdt');
  const out: Uint8Array[] = [];
  const sink: FileSink = { writeExclusive: async (_d, _n, d) => { out.push(d); return 'written'; } };
  const r = await new DuriaBillingWriteback(cfg, contexts, sink, CHANNELS[channel].build)
    .write(entries.map((entry) => ({ entry, acceptedBy: 'AL' })), arzt, 'S', ctx, 'P-tok', { codes: [], diagnoses: [] });
  return { r, text: new TextDecoder('latin1').decode(out[0] ?? new Uint8Array()) };
}

describe('Austauschbarer Übertragungsweg', () => {
  it('GDT (Standard) enthält 5001 und 6001', async () => {
    const { r, text } = await send('gdt');
    expect(r.ok).toBe(true);
    expect(text).toMatch(/5001TEST_A/);
    expect(text).toMatch(/6001J20\.9/);
  });

  it('HL7 DFT^P03: MSH, PID mit Pseudonym, FT1 je Ziffer, DG1 je Diagnose', async () => {
    const { r, text } = await send('hl7');
    expect(r.ok).toBe(true);
    const segs = text.split('\r').filter(Boolean);
    expect(segs[0]).toMatch(/^MSH\|\^~\\&\|PRAX\|/);
    expect(segs[0]).toContain('DFT^P03');
    expect(segs.find((s) => s.startsWith('PID'))).toContain('P-tok^^^PRAXIS^PI');
    expect(segs.find((s) => s.startsWith('FT1'))).toContain('TEST_A^^EBM');
    expect(segs.find((s) => s.startsWith('DG1'))).toContain('J20.9^^I10GM');
  });

  it('beide Wege sind als „nicht vom Hersteller bestätigt“ markiert', () => {
    expect(Object.values(CHANNELS).every((c) => !c.confirmedByVendor)).toBe(true);
  });
});
