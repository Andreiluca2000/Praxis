import { describe, expect, it } from 'vitest';
import { analyse, check, propose } from '../src/forms/advisor.js';
import { valuesOf } from '../src/forms/build.js';
import { gruppe, HEILMITTEL } from '../src/forms/heilmittel.js';
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

describe('Analyse: Labor und Heilmittel', () => {
  it('„Überweisung ans Labor“ → Muster 10 statt Muster 6', () => {
    expect(analyse('Überweisung ans Labor: Blutbild, CRP').suggestions.map((s) => s.formId)).toEqual(['muster-10']);
  });
  it('Kardiologie und Labor zusammen → Muster 6 und Muster 10', () => {
    expect(analyse('Überweisung zum Kardiologen, vorher Blutbild und TSH ins Labor').suggestions.map((s) => s.formId)).toEqual(['muster-06', 'muster-10']);
  });
  it('„Laborwerte“ nur im Befund-Abschnitt löst kein Muster 10 aus', () => {
    expect(analyse('Überweisung Kardiologie wegen Palpitationen. Befund: Laborwerte unauffällig').suggestions.map((s) => s.formId)).toEqual(['muster-06']);
  });
  it('Physiotherapie → Muster 13', () => {
    expect(analyse('Physiotherapie bei Bandscheibenprolaps').suggestions[0]?.formId).toBe('muster-13');
  });
});

describe('Muster 10 – Labor', () => {
  it('Blutbild, CRP, TSH bei Müdigkeit: kurativ, Auftrag nach Art und Umfang, Diagnose wörtlich', () => {
    const { p, issues } = run('muster-10', 'Labor: Blutbild, CRP und TSH wegen Müdigkeit');
    expect(field(p, 'kurativ').value).toBe(true);
    expect(field(p, 'auftrag').value).toBe('Blutbild, CRP, TSH');
    expect(field(p, 'quartal').value).toBe('426');
    expect(field(p, 'diagnose').value).toBe('Müdigkeit');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('„80 Jahre alt“ ist kein Leberwert (ALT)', () => {
    const { p } = run('muster-10', 'Blutbild wegen Anämie, Patientin 80 Jahre alt');
    expect(field(p, 'auftrag').value).toBe('Blutbild');
  });
  it('Check-up → präventiv; eilig per Fax → Nummer fehlt', () => {
    const { p, issues } = run('muster-10', 'Labor zur Gesundheitsuntersuchung (Check-up): Lipidprofil, Glukose. Befund eilt, per Fax');
    expect(field(p, 'praeventiv').value).toBe(true);
    expect(field(p, 'eilt').value).toBe(true);
    expect(field(p, 'fax').value).toBe(true);
    expect(field(p, 'nr').state).toBe('unbekannt');
    expect(texts(issues, 'fehlt')).toContain('Faxnummer');
  });
  it('Kontrolle bekannter Infektion ohne Befund-Erläuterung → fehlt; Schwangerschaft ohne SSW → offen', () => {
    const { p, issues } = run('muster-10', 'Labor: Urinkultur zur Kontrolle der bekannten Infektion, schwanger');
    expect(field(p, 'kontrolle').value).toBe(true);
    expect(texts(issues, 'fehlt')).toContain('Sachverhalt');
    expect(field(p, 'ssw').state).toBe('unbekannt');
  });
  it('Handänderungen: falsche Knappschaftsziffer, Uhrzeit, SSW; Arbeitsunfall unzulässig', () => {
    const { p, facts } = run('muster-10', 'Labor: Blutbild wegen Infekt');
    const t = texts(check('muster-10', { ...valuesOf(p.fields), knappschaft: '12345', abnahmezeit: '2575', ssw: '60' }, facts), 'unzulaessig');
    expect(t).toContain('87777');
    expect(t).toContain('hhmm');
    expect(t).toContain('1–45');
    expect(texts(run('muster-10', 'Labor nach Arbeitsunfall: CK').issues, 'unzulaessig')).toContain('nicht zu verwenden');
  });
});

describe('Heilmittelkatalog (HeilM-RL)', () => {
  it('enthält alle Bereiche und eindeutige Codes; WS: Höchstmenge 6, Frequenz 1-3x', () => {
    expect(HEILMITTEL.bereiche.map((b) => b.id)).toEqual(['physiotherapie', 'podologie', 'stimm_sprech_sprach_schluck', 'ergotherapie', 'ernaehrungstherapie']);
    const codes = HEILMITTEL.bereiche.flatMap((b) => b.diagnosegruppen.map((g) => g.code));
    expect(new Set(codes).size).toBe(codes.length);
    expect(gruppe('physiotherapie', 'WS')).toMatchObject({ hoechstmenge_je_vo: 6, orientierende_menge: 18 });
    expect(gruppe(null, 'ps 2')?.code).toBe('PS2');
  });
});

describe('Muster 13 – Heilmittel', () => {
  it('KG 6x bei WS, Leitsymptomatik a, 2x wöchentlich, kein Hausbesuch: vollständig bis auf Zuzahlung/ICD', () => {
    const { p, issues } = run('muster-13', 'Physiotherapie WS, Leitsymptomatik a, KG 6x, 2x pro Woche, kein Hausbesuch, wegen Lumbalgie M54.5 G');
    expect(field(p, 'physio').value).toBe(true);
    expect(field(p, 'diagnosegruppe').value).toBe('WS');
    expect(field(p, 'ls_a').value).toBe(true);
    expect(field(p, 'hm1').value).toBe('KG (allgemeine Krankengymnastik)');
    expect(field(p, 'diagnose').value).toBe('Lumbalgie – M54.5 G');
    expect(field(p, 'hm1_einheiten').value).toBe('6');
    expect(field(p, 'frequenz').value).toBe('2x wöchentlich');
    expect(field(p, 'hausbesuch_nein').value).toBe(true);
    expect(field(p, 'icd').value).toBe('M54.5 G');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('Zuzahlung: genau ein Feld ankreuzen.');
  });
  it('Diagnosegruppe aus der Beispieldiagnose des Katalogs (Bandscheibenprolaps → WS), Höchstmenge im Grund', () => {
    const { p } = run('muster-13', 'Physiotherapie bei Bandscheibenprolaps');
    expect(field(p, 'diagnosegruppe')).toMatchObject({ value: 'WS', state: 'vorgeschlagen' });
    expect(field(p, 'hm1').state).toBe('unbekannt');
    expect(field(p, 'hm1').reason).toContain('KG');
  });
  it('mehr Einheiten als die Höchstmenge → so nicht möglich; ergänzend mehr als vorrangig → so nicht möglich', () => {
    const { p, facts } = run('muster-13', 'Physiotherapie WS, Leitsymptomatik a, KG 10x, Wärmetherapie, 2x pro Woche');
    const issues = check('muster-13', { ...valuesOf(p.fields), ergaenzend_einheiten: '12' }, facts);
    const t = texts(issues, 'unzulaessig');
    expect(t).toContain('Höchstmenge je Verordnung für WS ist 6');
    expect(t).toContain('höchstens 10 Einheiten');
  });
  it('unbekannte Diagnosegruppe, falscher Buchstabe, zwei Bereiche, Doppelbehandlung beim ergänzenden Heilmittel', () => {
    const { p, facts } = run('muster-13', 'Physiotherapie WS, KG 6x');
    const issues = check('muster-13', { ...valuesOf(p.fields), diagnosegruppe: 'XY', ergo: true, ergaenzend: 'Wärmetherapie als Doppelbehandlung', ergaenzend_einheiten: '6' }, facts);
    const t = texts(issues, 'unzulaessig');
    expect(t).toContain('„XY“ gibt es im Heilmittelkatalog');
    expect(t).toContain('nur ein Feld ankreuzen');
    expect(t).toContain('Doppelbehandlung');
    const c = check('muster-13', { ...valuesOf(p.fields), ls_c: true }, facts);
    expect(texts(c, 'unzulaessig')).toContain('Leitsymptomatik c gibt es in Diagnosegruppe WS nicht');
  });
  it('ergänzendes Heilmittel allein: nur Elektrotherapie u. a. in der Physiotherapie', () => {
    const { p, facts } = run('muster-13', 'Physiotherapie WS');
    const bad = check('muster-13', { ...valuesOf(p.fields), hm1: '', ergaenzend: 'Wärmetherapie', ergaenzend_einheiten: '6' }, facts);
    expect(texts(bad, 'unzulaessig')).toContain('ergänzendes Heilmittel allein');
    const ok = check('muster-13', { ...valuesOf(p.fields), hm1: '', ergaenzend: 'Elektrotherapie', ergaenzend_einheiten: '6' }, facts);
    expect(texts(ok, 'unzulaessig')).not.toContain('ergänzendes Heilmittel allein');
  });
});
