import { describe, expect, it } from 'vitest';
import { adoptCorrection, correctionText, createCorrection, listText, markDone, proposeCorrections } from '../src/corrections/corrections.js';
import type { Note } from '../src/notes/note.js';

const arzt = { kuerzel: 'AL', role: 'arzt' };
const mfa = { kuerzel: 'MF', role: 'mfa' };
const D = '2026-11-12';
const dx = (code: string, certainty: string | null) => ({ code, certainty, side: null, date: D, ref: 'r' });
const note = (icd: string, certainty: 'G' | 'V' | 'A' | 'Z'): Note => ({
  id: 'n', serviceDate: D, author: 'AL', authorRole: 'arzt', form: 'kurz', transcript: '', text: '', status: 'entwurf',
  releasedBy: null, releasedAt: null, generator: 'regelbasiert', diagnoses: [{ text: 'x', icd, certainty, confirmedBy: 'AL' }],
});

describe('Korrekturliste', () => {
  it('Text: Datum, alt → neu, Grund, Kürzel', () => {
    const c = createCorrection({ kind: 'diagnose_aendern', from: { icd: 'J06.9', certainty: 'G' }, to: { icd: 'j20.9', certainty: 'G' } }, D, 'Befund spricht für Bronchitis', arzt);
    expect(correctionText(c)).toBe('12.11.2026 · Diagnose J06.9 G → J20.9 G (Grund: Befund spricht für Bronchitis) [AL]');
  });

  it('nur Arzt, Grund Pflicht, ICD-Format und Sicherheit geprüft', () => {
    const body = { kind: 'diagnose_aendern' as const, from: { icd: 'J06.9', certainty: 'G' as const }, to: { icd: 'J20.9', certainty: 'G' as const } };
    expect(() => createCorrection(body, D, 'x', mfa)).toThrow(/Nur Ärzte/);
    expect(() => createCorrection(body, D, '  ', arzt)).toThrow(/Grund/);
    expect(() => createCorrection({ ...body, to: { icd: 'Bronchitis', certainty: 'G' } }, D, 'x', arzt)).toThrow(/ICD/);
    expect(() => createCorrection({ ...body, to: { icd: 'J20.9', certainty: null } }, D, 'x', arzt)).toThrow(/sicherheit/i);
  });

  it('Vorschlag: gleiche Diagnose, andere Sicherheit', () => {
    const [c] = proposeCorrections({ date: D, recordedDiagnoses: [dx('J20.9', 'V')], recordedServices: [], notes: [note('J20.9', 'G')], report: null });
    expect(c).toMatchObject({ kind: 'diagnose_aendern', from: { icd: 'J20.9', certainty: 'V' }, to: { certainty: 'G' }, createdBy: null });
  });

  it('Vorschlag: unspezifischer Code derselben Kategorie → spezifischer', () => {
    const [c] = proposeCorrections({ date: D, recordedDiagnoses: [dx('J20.9', 'G')], recordedServices: [], notes: [note('J20.1', 'G')], report: null });
    expect(c).toMatchObject({ from: { icd: 'J20.9' }, to: { icd: 'J20.1' } });
  });

  it('kein Vorschlag bei fremder Kategorie (das ist eine neue Diagnose, kein Ersatz)', () => {
    expect(proposeCorrections({ date: D, recordedDiagnoses: [dx('J06.9', 'G')], recordedServices: [], notes: [note('J20.9', 'G')], report: null })).toEqual([]);
  });

  it('Vorschlag muss vom Arzt übernommen werden, bevor er erledigt oder kopiert wird', () => {
    const [c] = proposeCorrections({ date: D, recordedDiagnoses: [dx('J20.9', 'V')], recordedServices: [], notes: [note('J20.9', 'G')], report: null });
    expect(() => markDone(c!, mfa)).toThrow(/zuerst/);
    expect(listText([c!])).toBe('');
    expect(() => adoptCorrection(c!, mfa)).toThrow();
    const adopted = adoptCorrection(c!, arzt);
    expect(listText([adopted])).toMatch(/^1\. 12\.11\.2026 · Diagnose J20\.9 V → J20\.9 G/);
    expect(markDone(adopted, mfa)).toMatchObject({ status: 'erledigt', doneBy: 'MF' });
  });
});
