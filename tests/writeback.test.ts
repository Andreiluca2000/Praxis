import { describe, expect, it } from 'vitest';
import { ContextRegistry } from '../src/duria/context.js';
import { DuriaWriteback, type FileSink } from '../src/duria/writeback.js';
import { parseXdt } from '../src/duria/xdt.js';
import { release, type Note } from '../src/notes/note.js';

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1', serviceDate: '2026-11-12', author: 'AL', authorRole: 'arzt', form: 'kurz', transcript: 't',
  text: 'Husten, Lunge frei.', diagnoses: [], status: 'entwurf', releasedBy: null, releasedAt: null, generator: 'regelbasiert', ...over,
});
const arzt = { kuerzel: 'AL', name: 'Dr. Test', role: 'arzt' as const, active: true, createdAt: '' };

/** Austauschverzeichnis im Speicher – verhält sich wie das Rust-Kommando (exklusiv, atomar). */
class MemorySink implements FileSink {
  files = new Map<string, Uint8Array>();
  async writeExclusive(dir: string, name: string, data: Uint8Array) {
    const k = `${dir}/${name}`;
    if (this.files.has(k)) return 'exists' as const;
    this.files.set(k, data);
    return 'written' as const;
  }
  pickUp() { const v = [...this.files.values()][0]; this.files.clear(); return v; }
}

function setup(enabled = true) {
  const sink = new MemorySink();
  const contexts = new ContextRegistry();
  const ctx = contexts.open('PC1', '99001', new TextEncoder().encode('rev1'), 'bdt');
  const cfg = { enabled, exchangeDir: 'X:/gdt', fileName: 'PRAX_DUR.gdt', senderId: 'PRAX', receiverId: 'DURIA', encoding: 'iso-8859-15' as const };
  return { sink, contexts, ctx, wb: new DuriaWriteback(cfg, contexts, sink) };
}

describe('Rückweg zu DURIA (GDT 6310)', () => {
  it('nicht freigegebene Notiz wird nicht geschrieben', async () => {
    const { wb, ctx } = setup();
    expect(await wb.write(note(), 'PC1', ctx, '99001')).toMatchObject({ ok: false, reason: expect.stringMatching(/nicht vom Arzt freigegeben/) });
  });

  it('freigegebene Notiz → gültige GDT-Datei mit Kürzel, korrekte Satzlänge', async () => {
    const { wb, ctx, sink } = setup();
    expect((await wb.write(release(note(), arzt), 'PC1', ctx, '99001')).ok).toBe(true);
    const raw = sink.pickUp()!;
    const parsed = parseXdt(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.records[0]!.satzart).toBe('6310');
    const text = parsed.records[0]!.fields.filter((f) => f.fk === '6228').map((f) => f.value).join(' ');
    expect(text).toMatch(/^\[AL\] Kurz: Husten/);
    expect(Number(parsed.records[0]!.fields.find((f) => f.fk === '8100')!.value)).toBe(raw.length);
  });

  it('CTX-06: dieselbe Notiz wird nie zweimal übergeben', async () => {
    const { wb, ctx, sink } = setup();
    const n = release(note(), arzt);
    expect((await wb.write(n, 'PC1', ctx, '99001')).ok).toBe(true);
    sink.pickUp(); // DURIA hat abgeholt
    expect(await wb.write(n, 'PC1', ctx, '99001')).toMatchObject({ ok: false, reason: expect.stringMatching(/bereits übergeben/) });
  });

  it('CTX-01: Patientenwechsel vor dem Schreiben → gesperrt, keine Datei', async () => {
    const { wb, ctx, contexts, sink } = setup();
    contexts.open('PC1', '99002', new TextEncoder().encode('rev2'), 'bdt');
    expect((await wb.write(release(note(), arzt), 'PC1', ctx, '99001')).ok).toBe(false);
    expect(sink.files.size).toBe(0);
  });

  it('noch nicht abgeholte Datei wird nicht überschrieben', async () => {
    const { wb, ctx } = setup();
    expect((await wb.write(release(note({ id: 'a' }), arzt), 'PC1', ctx, '99001')).ok).toBe(true);
    expect(await wb.write(release(note({ id: 'b' }), arzt), 'PC1', ctx, '99001')).toMatchObject({ ok: false, reason: expect.stringMatching(/noch nicht abgeholt/) });
  });

  it('deaktiviert → kein Schreiben', async () => {
    const { wb, ctx } = setup(false);
    expect((await wb.write(release(note(), arzt), 'PC1', ctx, '99001')).ok).toBe(false);
  });

  it('langer Text mit Umlauten wird auf mehrere gültige Zeilen verteilt', async () => {
    const { wb, ctx, sink } = setup();
    const long = release(note({ form: 'lang', text: 'Anamnese: '.concat('sehr ausführlicher Verlauf, Übelkeit '.repeat(30)) }), arzt);
    expect((await wb.write(long, 'PC1', ctx, '99001')).ok).toBe(true);
    const parsed = parseXdt(sink.pickUp()!);
    expect(parsed.errors).toEqual([]);
    const lines = parsed.records[0]!.fields.filter((f) => f.fk === '6228');
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.map((l) => l.value).join(' ')).toContain('Übelkeit');
  });
});
