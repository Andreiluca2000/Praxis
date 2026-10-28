import { describe, expect, it } from 'vitest';
import { analyse, check, propose } from '../src/forms/advisor.js';
import { valuesOf } from '../src/forms/build.js';
import type { FormId, FormIssue, FormProposal } from '../src/forms/types.js';

// Synthetische Beschreibungen, keine Patientendaten.
const TODAY = new Date('2026-10-28T10:00:00');
function run(formId: FormId, text: string) {
  const { facts } = analyse(text);
  const p = propose(formId, text, facts, TODAY);
  return { p, facts, issues: check(formId, valuesOf(p.fields), facts) };
}
const field = (p: FormProposal, id: string) => p.fields.find((x) => x.fieldId === id)!;
const texts = (issues: FormIssue[], level: FormIssue['level']) => issues.filter((i) => i.level === level).map((i) => i.text).join(' | ');
const recheck = (formId: FormId, r: ReturnType<typeof run>, patch: Record<string, string | boolean | null>) => check(formId, { ...valuesOf(r.p.fields), ...patch }, r.facts);

describe('Muster 16 – Fachregeln', () => {
  it('bis zu drei Verordnungen, Dosierung erkannt, grundsätzlich gebührenpflichtig', () => {
    const r = run('muster-16', 'Rezept für Dauermedikation. Präparate: Ramipril 5 mg N3 1-0-0; Metformin 1000 mg N3 1-0-1; ASS 100 N3 0-1-0');
    expect([field(r.p, 'verordnung_1').value, field(r.p, 'verordnung_3').value]).toEqual(['Ramipril 5 mg N3 1-0-0', 'ASS 100 N3 0-1-0']);
    expect([field(r.p, 'geb_pfl').value, field(r.p, 'gebuehr_frei').value]).toEqual([true, false]);
    expect(texts(r.issues, 'unzulaessig')).toBe('');
    expect(texts(r.issues, 'hinweis')).not.toContain('Dosierung angeben');
  });
  it('Betäubungsmittel und T-Rezept-Wirkstoffe sind unzulässig; fehlende Dosierung ist ein Hinweis', () => {
    const r = run('muster-16', 'Rezept für Schmerzmittel. Präparate: Oxycodon 10 mg N1; Lenalidomid 10 mg; Pantoprazol 20 mg N3');
    const t = texts(r.issues, 'unzulaessig');
    expect(t).toContain('BtM-Rezept');
    expect(t).toContain('T-Rezept');
    expect(texts(r.issues, 'hinweis')).toContain('Dosierung angeben');
  });
  it('Arznei- und Hilfsmittel getrennt; Hilfsmittel mit Sonderkennzeichen 7; Brille nie', () => {
    const r = run('muster-16', 'Rezept. Präparate: Kompressionsstrümpfe AD Klasse 2; Ibuprofen 400 mg 1-1-1');
    expect(field(r.p, 'sk_hilfsmittel').value).toBe('7');
    expect(texts(r.issues, 'unzulaessig')).toContain('getrennten Blättern');
    expect(texts(run('muster-16', 'Rezept. Präparate: Brille für die Ferne').issues, 'unzulaessig')).toContain('Seh- und Hörhilfen');
  });
  it('Gebühr frei bei Kindern unter 18 und Arbeitsunfall; Unfall und Arbeitsunfall nicht zugleich', () => {
    expect(field(run('muster-16', 'Rezept für Sohn 8 Jahre. Präparate: Amoxicillin Saft 250 mg 1-1-1').p, 'gebuehr_frei').value).toBe(true);
    const r = run('muster-16', 'Rezept nach Arbeitsunfall am 20.10.2026. Präparate: Diclofenac 75 mg 1-0-1');
    expect([field(r.p, 'arbeitsunfall').value, field(r.p, 'unfalltag').value, field(r.p, 'gebuehr_frei').value]).toEqual([true, '201026', true]);
    expect(texts(r.issues, 'fehlt')).toContain('Unfallbetrieb');
    expect(texts(recheck('muster-16', r, { unfall: true }), 'unzulaessig')).toContain('Arbeitsunfall');
  });
});

describe('Muster 39 – Fachregeln', () => {
  it('Primärscreening unter 35: nur Zytologie; ab 35: Ko-Testung', () => {
    const jung = run('muster-39', 'Zervix-Früherkennung, 28 Jahre, Vorsorge, letzte Periode 10.10.2026, erstmals, unauffällig');
    expect([field(jung.p, 'alter_20_29').value, field(jung.p, 'auftrag_primaer').value, field(jung.p, 'auftrag_zytologie').value, field(jung.p, 'auftrag_ko').value]).toEqual([true, true, true, false]);
    expect([field(jung.p, 'vor_nein').value, field(jung.p, 'befund_unauffaellig').value, field(jung.p, 'letzte_periode').value]).toEqual([true, true, '101026']);
    expect(texts(jung.issues, 'unzulaessig')).toBe('');
    expect(texts(jung.issues, 'fehlt')).toBe('');
    expect(texts(recheck('muster-39', jung, { auftrag_ko: true }), 'unzulaessig')).toContain('unter 35');
    const alt = run('muster-39', 'Zervix-Früherkennung, 42 Jahre, Vorsorge');
    expect(field(alt.p, 'auftrag_ko').value).toBe(true);
  });
  it('Ja/Nein eindeutig; auffälliger Befund braucht Erläuterung; frühere Untersuchung braucht Monat/Jahr', () => {
    const r = run('muster-39', 'Zervix-Abklärung, 40 Jahre, Kontaktblutung, letzter Abstrich 2024, LP 01.10.2026');
    expect(field(r.p, 'befund_auffaellig').value).toBe(true);
    const t = texts(recheck('muster-39', r, { iup_ja: true, iup_nein: true }), 'unzulaessig');
    expect(t).toContain('IUP');
    const f = texts(r.issues, 'fehlt');
    expect(f).toContain('im Freitextfeld erläutern');
    expect(f).toContain('Monat/Jahr');
  });
});

describe('Muster 56 – Fachregeln', () => {
  it('Rehasport: eine Sportart, Richtwert 50 Einheiten, Wochenfrequenz', () => {
    const r = run('muster-56', 'Rehasport Gymnastik 2x pro Woche bei Lumbalgie M54.5 G. Ziel: Rumpfstabilität verbessern');
    expect([field(r.p, 'reha_sport').value, field(r.p, 'sport_gymnastik').value, field(r.p, 'sport_50').value, field(r.p, 'woche_sport_2').value]).toEqual([true, true, true, true]);
    expect(texts(r.issues, 'unzulaessig')).toBe('');
    expect(texts(r.issues, 'fehlt')).toBe('');
    const t = recheck('muster-56', r, { sport_schwimmen: true, woche_sport_2: false, woche_sport_3: true });
    expect(texts(t, 'unzulaessig')).toContain('Nur eine Rehabilitationssportart');
    expect(texts(t, 'fehlt')).toContain('mit Begründung');
  });
  it('Funktionstraining bei rheumatoider Arthritis: 24 Monate, Wasser; höchstens drei pro Woche', () => {
    const r = run('muster-56', 'Funktionstraining Wassergymnastik bei rheumatoider Arthritis M06.0 G, 2x pro Woche. Ziel: Beweglichkeit erhalten');
    expect([field(r.p, 'ft_24').value, field(r.p, 'ft_wasser').value, field(r.p, 'woche_wasser_2').value]).toEqual([true, true, true]);
    expect(texts(r.issues, 'fehlt')).toBe('');
    expect(texts(recheck('muster-56', r, { woche_trocken_2: true }), 'unzulaessig')).toContain('Höchstens 3');
  });
  it('Herzgruppe: Erstverordnung 90 Einheiten; Folgeverordnung braucht Begründung', () => {
    const r = run('muster-56', 'Rehasport Herzgruppe nach Herzinfarkt I25.12 G. Ziel: Belastbarkeit steigern');
    expect([field(r.p, 'herzgruppe').value, field(r.p, 'herz_erst').value]).toEqual([true, true]);
    expect(texts(recheck('muster-56', r, { herz_erst: false, herz_folge: true }), 'fehlt')).toContain('1,4 Watt/kg');
  });
});

describe('Muster 62B – Fachregeln', () => {
  it('Erstverordnung mit Beatmung: Zeitraum, invasiv, 24 h; Potenzialerhebung und Status', () => {
    const r = run('muster-62b', 'Außerklinische Intensivpflege, Erstverordnung vom 01.11.2026 bis 30.11.2026, ALS G12.2 G, invasive Beatmung, Tracheostoma, 24 Stunden pro Tag. Potenzialerhebung am 15.10.2026');
    expect([field(r.p, 'beatmung').value, field(r.p, 'form_invasiv').value, field(r.p, 'tracheostoma').value, field(r.p, 'stunden_je_tag').value]).toEqual([true, true, true, '24']);
    expect(field(r.p, 'erlaeuterungen').value).toContain('15.10.2026');
    expect(texts(r.issues, 'unzulaessig')).toBe('');
    const f = texts(r.issues, 'fehlt');
    expect(f).toContain('Beatmung: seit wann');
    expect(f).toContain('Therapieoptimierung');
    expect(f).toContain('Mitwirkung');
    expect(texts(r.issues, 'hinweis')).toContain('Potenzialerhebung');
  });
  it('Erstverordnung über 5 Wochen Hinweis; Folgeverordnung über 6 Monate unzulässig; Erhebung älter als 3 Monate unzulässig', () => {
    const r = run('muster-62b', 'Intensivpflege, Erstverordnung vom 01.11.2026 bis 31.12.2026, G12.2 G, Beatmung NIV, Potenzialerhebung am 01.06.2026');
    expect(texts(r.issues, 'hinweis')).toContain('5 Wochen');
    expect(texts(r.issues, 'unzulaessig')).toContain('älter als 3 Monate');
    expect(texts(recheck('muster-62b', r, { erstverordnung: false, folgeverordnung: true, bis: '300627' }), 'unzulaessig')).toContain('längstens 6 Monate');
  });
  it('ohne Beatmung und Kanüle: Konsilpartner-Hinweis; über 24 Stunden unzulässig', () => {
    const r = run('muster-62b', 'Intensivpflege, Folgeverordnung vom 01.11.2026 bis 30.04.2027, Epilepsie G40.9 G, 12 Stunden pro Tag');
    expect(texts(r.issues, 'hinweis')).toContain('Konsilpartner');
    expect(texts(recheck('muster-62b', r, { stunden_je_tag: '30' }), 'unzulaessig')).toContain('höchstens 24');
  });
});
