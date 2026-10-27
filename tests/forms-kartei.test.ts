import { describe, expect, it } from 'vitest';
import { analyse } from '../src/forms/advisor.js';
import { applyKartei, factSentence, karteiOffer, type KarteiInput } from '../src/forms/kartei.js';

// Synthetischer, bereits pseudonymisierter DURIA-Auszug (wie ihn Rust nach DS-01 liefert).
const input: KarteiInput = {
  serviceDate: '2026-10-27',
  diagnoses: [
    { code: 'R06.0', certainty: 'G', side: null, date: '2026-10-27', ref: 'r1' },
    { code: 'I10.90', certainty: 'G', side: null, date: '2026-04-02', ref: 'r2' },
    { code: 'I10.90', certainty: 'G', side: null, date: '2025-01-10', ref: 'r3' },
    { code: 'M17.1', certainty: null, side: 'R', date: '2026-10-27', ref: 'r4' },
  ],
  notes: [
    { date: '2026-10-27', text: 'Belastungsdyspnoe seit 3 Wochen, RR 150/90, EKG Sinusrhythmus.', ref: 'n1' },
    { date: '2026-03-12', text: 'Pflegegrad 4 laut Bescheid, Rollstuhl.', ref: 'n2' },
  ],
  title: (c) => ({ 'R06.0': 'Dyspnoe', 'I10.90': 'Essentielle Hypertonie, nicht näher bezeichnet' } as Record<string, string>)[c] ?? null,
};

describe('Vorbefüllen aus dem geöffneten Patienten (Kartei)', () => {
  const offer = karteiOffer(input);
  const byId = (id: string) => offer.find((i) => i.id === id)!;

  it('Diagnosen mit Sicherheit und ICD-Titel; je Kode nur einmal; heutige vorausgewählt', () => {
    expect(byId('dx:R06.0')).toMatchObject({ text: 'R06.0 G Dyspnoe', preselected: true, blocked: null });
    expect(byId('dx:I10.90')).toMatchObject({ preselected: false, source: 'DURIA-Diagnose vom 02.04.2026' });
    expect(offer.filter((i) => i.id === 'dx:I10.90')).toHaveLength(1);
  });

  it('Diagnose ohne Sicherheit wird angezeigt, aber nicht übernommen', () => {
    const m = byId('dx:M17.1');
    expect(m.blocked).toContain('G/V/A/Z');
    expect(m.preselected).toBe(false);
    expect(applyKartei('muster-06', {}, [m])).toEqual({});
  });

  it('Pflegegrad und Rollstuhl aus der Kartei werden als Tatsachen angeboten und gehen in die Regeln ein', () => {
    expect(byId('fact:pflegegrad').text).toBe('Pflegegrad 4');
    expect(byId('fact:rollstuhl').text).toBe('Rollstuhl');
    const sentence = factSentence([byId('fact:pflegegrad'), byId('fact:rollstuhl')]);
    expect(sentence).toBe('Aus der Kartei: Pflegegrad 4, Rollstuhl.');
    const a = analyse(`Überweisung zum Kardiologen. ${sentence}`);
    expect(a.facts.pflegegrad?.value).toBe(4);
    expect(a.suggestions.map((s) => s.formId)).toEqual(['muster-06', 'muster-04']);
  });

  it('Übernahme hängt an, überschreibt nichts und wiederholt nichts', () => {
    const chosen = [byId('dx:R06.0'), byId('note:n1')];
    const v1 = applyKartei('muster-06', { diagnose: 'Belastungsdyspnoe' }, chosen);
    expect(v1).toEqual({ diagnose: 'Belastungsdyspnoe; R06.0 G Dyspnoe', befund: 'Belastungsdyspnoe seit 3 Wochen, RR 150/90, EKG Sinusrhythmus.' });
    expect(applyKartei('muster-06', v1, chosen)).toEqual({});
  });

  it('Muster 2 nimmt den Karteitext als Untersuchungsergebnisse; Muster 4 bekommt keine Diagnosen', () => {
    const chosen = [byId('dx:R06.0'), byId('note:n1')];
    expect(Object.keys(applyKartei('muster-02', {}, chosen))).toEqual(['diagnose', 'untersuchungsergebnisse']);
    expect(applyKartei('muster-04', {}, chosen)).toEqual({});
  });

  it('ohne Patient: leeres Angebot', () => {
    expect(karteiOffer({ diagnoses: [], notes: [], serviceDate: '2026-10-27' })).toEqual([]);
  });
});
