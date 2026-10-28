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
const marked = (p: FormProposal) => p.fields.filter((f) => f.fieldId.startsWith('lab') && f.value === true).map((f) => f.fieldId);
const texts = (issues: FormIssue[], level: FormIssue['level']) => issues.filter((i) => i.level === level).map((i) => i.text).join(' | ');

describe('Muster 10A – Laborgemeinschaft', () => {
  it('„Laborgemeinschaft“ → Muster 10A statt Muster 10', () => {
    expect(analyse('Laborgemeinschaft: kleines Blutbild, CRP').suggestions.map((s) => s.formId)).toEqual(['muster-10a']);
  });
  it('Labor mit Untersuchungen aus dem Auftragsfeld → Muster 10, Muster 10A als Alternative', () => {
    const s = analyse('Labor: Blutbild, CRP und TSH wegen Müdigkeit').suggestions;
    expect(s.map((x) => [x.formId, x.role])).toEqual([['muster-10', 'hauptsache'], ['muster-10a', 'alternativ']]);
    expect(s[1]!.why).toContain('kleines Blutbild, CRP, TSH');
  });
  it('markiert die genannten Untersuchungen durch Striche, kurativ, heutige Entnahme', () => {
    const { p, issues } = run('muster-10a', 'Laborgemeinschaft heute: Blutbild, CRP, Leberwerte, Kreatinin und Elektrolyte wegen Müdigkeit');
    expect(marked(p)).toEqual(['lab3', 'lab23', 'lab27', 'lab29', 'lab30', 'lab38', 'lab39', 'lab44']);
    expect(field(p, 'kurativ').value).toBe(true);
    expect(field(p, 'abnahmedatum').value).toBe('281026');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('Abnahmezeit eintragen (hhmm).');
  });
  it('Gesundheitsuntersuchung: präventiv, Felder 62–64 statt einzelner Lipide', () => {
    const { p, issues } = run('muster-10a', 'Laborgemeinschaft Check-up 35: Lipide, Nüchternglukose, Urin-Stix. Abnahme 28.10.26 um 7:45');
    expect(field(p, 'praeventiv').value).toBe(true);
    expect(marked(p)).toEqual(['lab55', 'lab62', 'lab63', 'lab64']);
    expect(field(p, 'abnahmezeit').value).toBe('0745');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('Quick unter Marcumar, großes Blutbild ohne kleines', () => {
    const { p } = run('muster-10a', 'Laborgemeinschaft: INR unter Marcumar, großes Blutbild');
    expect(marked(p)).toEqual(['lab2', 'lab9']);
  });
  it('nicht benannte Untersuchung → „Sonstiges“ mit Angabe unter „Zusätzliche Angaben“', () => {
    const { p, issues } = run('muster-10a', 'Laborgemeinschaft: Ferritin und TSH');
    expect(marked(p)).toEqual(['lab49', 'lab61']);
    expect(field(p, 'zusatzangaben').value).toBe('Sonstiges: Ferritin');
    expect(texts(issues, 'fehlt')).not.toContain('Sonstiges');
  });
  it('Kreatinin-Clearance ohne Sammelmenge/-zeit → fehlt', () => {
    const { p, issues } = run('muster-10a', 'Laborgemeinschaft: Kreatinin-Clearance');
    expect(marked(p)).toEqual(['lab40']);
    expect(field(p, 'zusatzangaben').state).toBe('unbekannt');
    expect(texts(issues, 'fehlt')).toContain('Sammelmenge');
  });
  it('„AP“ (Angina pectoris) und „alt“ lösen keine Laborfelder aus', () => {
    const { p } = run('muster-10a', 'Laborgemeinschaft: CK bei AP, 78 Jahre alt');
    expect(marked(p)).toEqual(['lab21']);
  });
  it('Prüfung: ohne Untersuchung fehlt das Auftragsfeld; Arbeitsunfall unzulässig; Knappschaft nur 87777', () => {
    const { p, facts } = run('muster-10a', 'Laborgemeinschaft nach Arbeitsunfall');
    const issues = check('muster-10a', { ...valuesOf(p.fields), knappschaft: '12345' }, facts);
    expect(texts(issues, 'fehlt')).toContain('mindestens eine Untersuchung');
    expect(texts(issues, 'unzulaessig')).toContain('Arbeitsunfall');
    expect(texts(issues, 'unzulaessig')).toContain('87777');
  });
});

describe('Muster 21 – Kind krank', () => {
  it('„Kind krank“ → Muster 21', () => {
    expect(analyse('Kind krank, Tochter 4 Jahre, Fieber, Betreuung vom 27.10. bis 29.10.2026').suggestions.map((s) => s.formId)).toEqual(['muster-21']);
  });
  it('Zeitraum aus der Beschreibung, Alter erkannt, keine Fehler', () => {
    const { p, facts, issues } = run('muster-21', 'Kinderkrankengeld: Sohn 6 J. mit Gastroenteritis, Betreuung vom 27.10. bis 29.10.2026');
    expect(facts.kindAlter?.value).toBe(6);
    expect(field(p, 'vom').value).toBe('271026');
    expect(field(p, 'bis').value).toBe('291026');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('„ab heute für 3 Tage“ → vom heute, bis einschließlich zwei Tage später', () => {
    const { p } = run('muster-21', 'Kind krank, 3-jährige Tochter, ab heute für 3 Tage');
    expect([field(p, 'vom').value, field(p, 'bis').value]).toEqual(['281026', '301026']);
  });
  it('ohne Zeitraum: vom/bis fehlen („!“)', () => {
    const { p, issues } = run('muster-21', 'Kind krank, Tochter 2 Jahre');
    expect(field(p, 'vom').state).toBe('unbekannt');
    expect(texts(issues, 'fehlt')).toContain('Zeitraum');
  });
  it('Kind 13 Jahre ohne Behinderung → unzulässig; mit Behinderung zulässig', () => {
    expect(texts(run('muster-21', 'Kind krank, Sohn 13 Jahre, vom 27.10. bis 28.10.26').issues, 'unzulaessig')).toContain('unter 12 Jahren');
    expect(texts(run('muster-21', 'Kind krank, Sohn 13 Jahre, mehrfachbehindert, vom 27.10. bis 28.10.26').issues, 'unzulaessig')).toBe('');
  });
  it('Mitaufnahme im Krankenhaus → kein Muster 21', () => {
    expect(texts(run('muster-21', 'Kind krank, 5 J., Mitaufnahme als Begleitperson im Krankenhaus').issues, 'unzulaessig')).toContain('Krankenhaus');
  });
  it('Kita-Unfall: Feld angekreuzt, Unfallversicherungsträger im Personalienfeld, nicht zugleich „sonstiger Unfall“', () => {
    const { p, facts } = run('muster-21', 'Kind krank nach Unfall in der Kita, 4 Jahre, vom 27.10. bis 31.10.26');
    expect(field(p, 'kita_unfall').value).toBe(true);
    expect(field(p, 'sonstiger_unfall').value).toBe(false);
    const issues = check('muster-21', { ...valuesOf(p.fields), sonstiger_unfall: true, bis: '201026' }, facts);
    expect(texts(issues, 'unzulaessig')).toContain('nicht beides');
    expect(texts(issues, 'unzulaessig')).toContain('liegt vor');
    expect(texts(issues, 'hinweis')).toContain('Unfallversicherungsträger');
  });
});

describe('Muster 20 – Wiedereingliederungsplan', () => {
  it('„Wiedereingliederung“ / „Hamburger Modell“ → Muster 20', () => {
    expect(analyse('Wiedereingliederung nach Bandscheiben-OP').suggestions.map((s) => s.formId)).toEqual(['muster-20']);
    expect(analyse('Hamburger Modell planen').suggestions[0]?.formId).toBe('muster-20');
  });
  it('Stufen mit Datum: bis = Tag vor der nächsten Stufe, Tätigkeit und Stunden vorher', () => {
    const { p, issues } = run('muster-20', 'Wiedereingliederung. Tätigkeit: Lagerist, vorher 8 h täglich. Stufenplan: ab 02.11.26 4 Std. tgl., ab 16.11.26 6 Std. tgl., 30.11.26 bis 11.12.26 8 h. Einschränkungen: nicht über 10 kg heben');
    expect(field(p, 'taetigkeit').value).toBe('Lagerist');
    expect(field(p, 'stunden_vorher').value).toBe('8');
    expect([field(p, 'vom1').value, field(p, 'bis1').value, field(p, 'std1').value]).toEqual(['021126', '151126', '4']);
    expect([field(p, 'vom2').value, field(p, 'bis2').value, field(p, 'std2').value]).toEqual(['161126', '291126', '6']);
    expect([field(p, 'vom3').value, field(p, 'bis3').value, field(p, 'std3').value]).toEqual(['301126', '111226', '8']);
    expect(field(p, 'art1').value).toBe('nicht über 10 kg heben');
    expect(field(p, 'vom4').state).toBe('leer');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(issues, 'hinweis')).toContain('Arbeitsunfähigkeit');
  });
  it('Stufen als Dauer mit Beginn → Daten', () => {
    const { p } = run('muster-20', 'Wiedereingliederung, arbeitet als Bürokauffrau, Vollzeit 8 h. Beginn 02.11.26: 2 Wochen 4 h, 2 Wochen 6 h');
    expect(field(p, 'taetigkeit').value).toBe('Bürokauffrau');
    expect([field(p, 'vom1').value, field(p, 'bis1').value, field(p, 'vom2').value, field(p, 'bis2').value]).toEqual(['021126', '151126', '161126', '291126']);
  });
  it('ohne Plan: Tätigkeit, Stunden und Stufe 1 fehlen („!“)', () => {
    const { p, issues } = run('muster-20', 'Wiedereingliederung bitte');
    expect(field(p, 'vom1').state).toBe('unbekannt');
    expect(texts(issues, 'fehlt')).toContain('Tätigkeit');
    expect(texts(issues, 'fehlt')).toContain('mindestens eine Stufe');
  });
  it('Prüfung: bis vor vom, mehr Stunden als vorher, über sechs Monate', () => {
    const { p, facts } = run('muster-20', 'Wiedereingliederung, Tätigkeit: Pfleger, vorher 6 h. ab 02.11.26 4 h');
    const issues = check('muster-20', { ...valuesOf(p.fields), bis1: '011126', vom2: '021126', bis2: '300627', std2: '7', art2: 'Station' }, facts);
    expect(texts(issues, 'unzulaessig')).toContain('liegt vor');
    expect(texts(issues, 'hinweis')).toContain('mehr Stunden');
    expect(texts(issues, 'hinweis')).toContain('sechs Monate');
  });
});
