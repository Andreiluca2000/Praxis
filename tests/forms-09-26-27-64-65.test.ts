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

describe('Muster 9 – Fehlgeburt, Frühgeburt, Behinderung', () => {
  it('Fehlgeburt in der 18. SSW → Muster 9, Datum und mindestens 17. SSW', () => {
    expect(analyse('Bescheinigung Fehlgeburt für Mutterschaftsgeld').suggestions[0]?.formId).toBe('muster-09');
    const { p, issues } = run('muster-09', 'Fehlgeburt am 20.10.2026 in der 18+2 SSW, Kürettage');
    expect(field(p, 'fehlgeburt_am').value).toBe('201026');
    expect([field(p, 'ssw_17').value, field(p, 'ssw_13').value, field(p, 'ssw_20').value]).toEqual([true, false, false]);
    expect(field(p, 'v_name').state).toBe('leer');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('Frühgeburt 2.100 g → a); Mehrlinge → nicht auszustellen; vor der 13. SSW unzulässig', () => {
    const { p } = run('muster-09', 'Frühgeburt, geboren am 15.10.2026, Geburtsgewicht 2100 g');
    expect([field(p, 'fruehgeburt_am').value, field(p, 'gewicht_unter').value, field(p, 'pflegebedarf').value]).toEqual(['151026', true, false]);
    expect(texts(run('muster-09', 'Frühgeburt Zwillinge, geboren am 15.10.2026, 1900 g').issues, 'unzulaessig')).toContain('Mehrlingsgeburt');
    const f = run('muster-09', 'Fehlgeburt am 20.10.2026 in der 10. SSW');
    expect(texts(check('muster-09', { ...valuesOf(f.p.fields), ssw_13: true }, f.facts), 'unzulaessig')).toContain('erst ab der 13. SSW');
  });
  it('Frühgeburt ab 2.500 g ohne erweiterten Pflegebedarf: entscheidet der Arzt', () => {
    const { p, issues } = run('muster-09', 'Frühgeburt am 15.10.2026, 2600 g');
    expect(field(p, 'pflegebedarf').state).toBe('unbekannt');
    expect(texts(issues, 'fehlt')).toContain('2.500');
  });
});

describe('Muster 26/27 – Soziotherapie', () => {
  it('Soziotherapie → Muster 26 und Betreuungsplan 27; Hinweis auf Verordnungsberechtigte', () => {
    expect(analyse('Soziotherapie verordnen, Schizophrenie').suggestions.map((s) => [s.formId, s.role])).toEqual([['muster-26', 'hauptsache'], ['muster-27', 'zusaetzlich']]);
    const { p, issues } = run('muster-26', 'Soziotherapie: F20.0 G, GAF 38, lebt allein, kein Betreuer, 30 Einheiten, insgesamt 60 Einheiten über 6 Monate, erstmals. Fähigkeitsstörungen: kann Termine nicht selbstständig wahrnehmen. Prognose: kann befähigt werden, fachärztliche Behandlung selbst in Anspruch zu nehmen. Krankenhausbehandlung wird vermieden. Begründung: wiederholte stationäre Aufenthalte');
    expect([field(p, 'diagnose').value, field(p, 'gaf').value, field(p, 'einheiten_beantragt').value, field(p, 'einheiten_gesamt').value]).toEqual(['F20.0 G', '38', '30', '60']);
    expect([field(p, 'betreuer_nein').value, field(p, 'kh_vermieden').value]).toEqual([true, true]);
    expect(field(p, 'wohnform').value).toBe('lebt allein');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'hinweis')).toContain('Hausärzte nicht');
  });
  it('Prüfung: über 30 Einheiten, GAF über 50, keine F-Diagnose unzulässig', () => {
    const { p, facts } = run('muster-26', 'Soziotherapie F20.0 G GAF 38');
    const t = texts(check('muster-26', { ...valuesOf(p.fields), einheiten_beantragt: '40', gaf: '55', diagnose: 'I10.90 G' }, facts), 'unzulaessig');
    expect(t).toContain('Höchstens 30');
    expect(t).toContain('GAF 55');
    expect(t).toContain('F00–F99');
  });
  it('Muster 27: Ziele, Maßnahmen, Durchführung aus der Beschreibung; IK mit 9 Ziffern', () => {
    const { p, facts, issues } = run('muster-27', 'Betreuungsplan. IK 123456789. Nahziele: Tagesstruktur. Fernziele: Rückkehr in Arbeit. Maßnahmen: psychiatrische Sprechstunde, Ergotherapie. Durchführung: Begleitung zu Arztterminen 1x/Woche 3 Monate');
    expect(field(p, 'ik').value).toBe('123456789');
    expect(field(p, 'ziele').value).toBe('Nahziel: Tagesstruktur; Fernziel: Rückkehr in Arbeit');
    expect([field(p, 'massnahme1').value, field(p, 'massnahme2').value]).toEqual(['psychiatrische Sprechstunde', 'Ergotherapie']);
    expect([field(p, 'art1').value, field(p, 'frequenz1').value, field(p, 'zeitraum1').value]).toEqual(['Begleitung zu Arztterminen', '1x/Woche', '3 Monate']);
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(check('muster-27', { ...valuesOf(p.fields), ik: '1234' }, facts), 'unzulaessig')).toContain('9 Ziffern');
  });
});

describe('Muster 64/65 – Vorsorge für Mütter/Väter, Attest Kind', () => {
  it('Mutter-Kind-Kur mit asthmakrankem Kind → Muster 64 und Attest Kind 65', () => {
    const s = analyse('Mutter-Kind-Kur, alleinerziehend, Erschöpfung F43.0 G, Sohn 6 Jahre mit Asthma').suggestions;
    expect(s.map((x) => [x.formId, x.role])).toEqual([['muster-64', 'hauptsache'], ['muster-65', 'zusaetzlich']]);
  });
  it('Muster 64: Leistungsform, Kontextfaktoren, Kind ohne Namen „!“, Heilmittel-Bestätigung', () => {
    const { p, issues } = run('muster-64', 'Mutter-Kind-Kur wegen Erschöpfungssyndrom F48.0 G, alleinerziehend, Schichtdienst, finanzielle Sorgen. Anamnese: seit 1 Jahr Erschöpfung. Beeinträchtigungen: Haushalt kaum zu bewältigen. Bisherige Therapie: Physiotherapie ohne Erfolg, Gespräche. Ziele: Stressbewältigung erlernen. Sohn 6 Jahre mit Asthma');
    expect(field(p, 'mutter_kind').value).toBe(true);
    expect([field(p, 'k_allein').value, field(p, 'k_arbeitszeiten').value, field(p, 'k_finanzen').value]).toEqual([true, true, true]);
    expect(field(p, 'icd1').value).toBe('F48.0 G');
    expect(field(p, 'heilmittel_nicht_ausreichend').value).toBe(true);
    expect(field(p, 'kind1_name').state).toBe('unbekannt');
    expect(field(p, 'kind1_attest').value).toBe(true);
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toContain('Name und Geburtsdatum des Kindes');
    expect(texts(issues, 'hinweis')).not.toContain('Muster 61');
  });
  it('Muster 65: Attest Kind mit Diagnose, Behandlung, Interventionen', () => {
    expect(analyse('Ärztliches Attest Kind für die Mutter-Kind-Kur').suggestions[0]?.formId).toBe('muster-65');
    const { p, issues } = run('muster-65', 'Attest Kind: Asthma bronchiale J45.0 G. Anamnese: seit 2 Jahren gehäufte Infekte. Bisherige Therapie: Salbutamol, Inhalationsschulung. Interventionen: Atemtherapie, Sport');
    expect([field(p, 'icd_1').value, field(p, 'anamnese').value]).toEqual(['J45.0 G', 'seit 2 Jahren gehäufte Infekte']);
    expect(field(p, 'interventionen').value).toBe('Atemtherapie, Sport');
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(issues, 'hinweis')).toContain('ersetzt nicht');
  });
});
