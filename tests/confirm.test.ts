import { describe, expect, it } from 'vitest';
import { evaluateRule } from '../src/engine/evaluate.js';
import { classifyMention } from '../src/facts/extract.js';
import { conflicts, emptyConfirmation, suggestedStatus, toFacts, type FactConfirmation } from '../src/facts/confirm.js';
import { input, settings, testRule } from './fixtures.js';

const c = (over: Partial<FactConfirmation>): FactConfirmation => ({ ...emptyConfirmation(), ...over });

describe('Bestätigung erkannter Angaben → Fakten', () => {
  it('ohne Bestätigung keine Fakten', () => {
    expect(toFacts(emptyConfirmation())).toEqual({});
  });

  it('Vorschlag: Verneinung und Familienanamnese werden nie als Leistung vorgeschlagen', () => {
    expect(suggestedStatus(classifyMention('Kein Hinweis auf Fieber.', '2026-11-12', 'r'))).toBeNull();
    expect(suggestedStatus(classifyMention('Mutter mit Diabetes.', '2026-11-12', 'r'))).toBeNull();
    expect(suggestedStatus(classifyMention('Untersuchung heute durchgeführt.', '2026-11-12', 'r'))).toBe('performed');
  });

  it('bestätigter Status + Dauer werden zu bestätigten Fakten mit Beleg', () => {
    const f = toFacts(c({
      decisions: [{ ref: 'bdt:2:15', status: 'performed', by: 'AL' }],
      durationMinutes: { value: 15, by: 'AL', source: 'text', ref: 'bdt:2:15' },
    }));
    expect(f['service.status']).toMatchObject({ value: 'performed', verification: 'confirmed', evidence: [{ ref: 'bdt:2:15' }] });
    expect(f['documentation.duration_minutes']).toMatchObject({ value: 15, verification: 'confirmed' });
  });

  it('Chroniker/DMP: nur angehakte Bestätigungen werden zu Fakten, fehlende bleiben unbekannt', () => {
    const f = toFacts(c({ chronic: { intensiveCare: { by: 'AL' }, dmpEnrolled: { by: 'AL' } } }));
    expect(f['documentation.intensive_care_confirmed']).toMatchObject({ value: true, verification: 'confirmed', evidence: [{ ref: 'benutzer:AL:intensiveCare' }] });
    expect(f['dmp.patient_enrolled']).toMatchObject({ value: true, verification: 'confirmed' });
    expect(f['dmp.documentation_transmitted']).toBeUndefined();
    expect(f['dmp.practice_participation']).toBeUndefined();
  });

  it('„nicht verwenden“ erzeugt keinen Fakt', () => {
    expect(toFacts(c({ decisions: [{ ref: 'x', status: null, by: 'AL' }] }))).toEqual({});
  });

  it('widersprüchliche Bestätigungen bleiben Widerspruch → Motor bleibt unbekannt', () => {
    const conf = c({
      decisions: [{ ref: 'a', status: 'performed', by: 'AL' }, { ref: 'b', status: 'refused', by: 'AL' }],
      durationMinutes: { value: 15, by: 'AL', source: 'benutzer', ref: 'benutzer:dauer' },
    });
    expect(conflicts(conf)).toHaveLength(1);
    expect(evaluateRule(testRule(), input(toFacts(conf)), settings(), 'operational').outcome).toBe('documentation_incomplete');
  });

  it('Ende-zu-Ende: bestätigt erbracht + 12 Minuten → Kandidat', () => {
    const f = toFacts(c({
      decisions: [{ ref: 'a', status: 'performed', by: 'AL' }],
      durationMinutes: { value: 12, by: 'AL', source: 'benutzer', ref: 'benutzer:dauer' },
    }));
    expect(evaluateRule(testRule(), input(f), settings(), 'operational').outcome).toBe('candidate');
  });
});
