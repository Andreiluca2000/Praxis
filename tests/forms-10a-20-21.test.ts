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

describe('Muster 55 – Chroniker', () => {
  it('„Chroniker-Bescheinigung“ → Muster 55, Diagnosen mit Sicherheit, unbefristet', () => {
    expect(analyse('Chroniker-Bescheinigung für die Zuzahlungsbefreiung').suggestions[0]?.formId).toBe('muster-55');
    const { p, issues } = run('muster-55', 'Chronikerbescheinigung: Diabetes mellitus E11.9 G, Hypertonie I10.90 G, Dauerbehandlung seit 15.01.2019, Behandlung weiterhin erforderlich, dauerhaft');
    expect(field(p, 'seit').value).toBe('150119');
    expect([field(p, 'icd1').value, field(p, 'icd2').value]).toEqual(['E11.9 G', 'I10.90 G']);
    expect(field(p, 'versorgung_unbefristet').value).toBe(true);
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(issues, 'hinweis')).toContain('Kalenderjahr');
  });
  it('„seit 2019“ ohne Tag → Datum aus der Kartei ergänzen; Dauerbehandlung unter einem Jahr unzulässig', () => {
    const { p, facts } = run('muster-55', 'Chroniker, in Behandlung seit 2019, E11.9 G');
    expect(field(p, 'seit').state).toBe('unbekannt');
    const issues = check('muster-55', { ...valuesOf(p.fields), seit: '010926', versorgung_unbefristet: true }, facts);
    expect(texts(issues, 'unzulaessig')).toContain('mindestens ein Jahr');
  });
  it('„voraussichtlich bis 12/27“ → MMJJ; falsches Format unzulässig', () => {
    const { p, facts } = run('muster-55', 'Chroniker E11.9 G seit 01.02.2020, voraussichtlich bis 12/2027');
    expect([field(p, 'versorgung_bis').value, field(p, 'bis').value]).toEqual([true, '1227']);
    expect(texts(check('muster-55', { ...valuesOf(p.fields), bis: '1327' }, facts), 'unzulaessig')).toContain('MMJJ');
  });
});

describe('Muster 19 – Notfall-/Vertretungsschein', () => {
  it('Bereitschaftsdienst → Muster 19, Notfalldienst angekreuzt, Quartal, AU bis', () => {
    expect(analyse('Notfallschein im Bereitschaftsdienst, Gastroenteritis').suggestions[0]?.formId).toBe('muster-19');
    const { p, issues } = run('muster-19', 'Notfallschein im Bereitschaftsdienst wegen Gastroenteritis A09.9 G, AU bis 30.10.2026. Befund: Exsikkose leicht. Therapie: Flüssigkeit');
    expect(field(p, 'notfalldienst').value).toBe(true);
    expect(field(p, 'quartal').value).toBe('426');
    expect(field(p, 'au_bis').value).toBe('301026');
    expect(field(p, 'leistungen').state).toBe('leer');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('Arbeitsunfall → nicht zu verwenden', () => {
    expect(texts(run('muster-19', 'Vertretungsschein, Arbeitsunfall auf der Baustelle').issues, 'unzulaessig')).toContain('nicht zu verwenden');
  });
});

describe('Muster 52 – Bericht bei Fortbestehen der AU', () => {
  it('Anfrage der Kasse → Muster 52, Diagnosen, Tätigkeit, Maßnahmen, Überweisung, keine Erwerbsminderung', () => {
    expect(analyse('Anfrage der Krankenkasse, Bericht bei Fortbestehen der AU').suggestions[0]?.formId).toBe('muster-52');
    expect(analyse('Bericht für die Krankenkasse: M51.2 G, Überweisung zum Orthopäden, Reha beantragt').suggestions.map((x) => x.formId)).toEqual(['muster-52']);
    const { p, issues } = run('muster-52', 'Bericht für die Krankenkasse: M51.2 G, arbeitet als Lagerist, 40 Stunden pro Woche. Physiotherapie seit 01.10. Reha beantragt. Überweisung zum Orthopäden. Kein Hinweis auf Erwerbsminderung.');
    expect(field(p, 'icd1').value).toBe('M51.2 G');
    expect([field(p, 'taetigkeit').value, field(p, 'stunden_woche').value]).toEqual(['Lagerist', '40']);
    expect(field(p, 'heilmittel').value).toContain('Physiotherapie');
    expect(field(p, 'reha_beantragt').value).toBe(true);
    expect(field(p, 'ueberw_ja').value).toBe(true);
    expect(field(p, 'em_nein').value).toBe(true);
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('Arbeitslosengeld: 2.2 statt 2.1; Wiedereingliederung gilt nicht für Arbeitslose; „keine“ braucht Begründung', () => {
    const { p, facts } = run('muster-52', 'Bericht für die Kasse, F32.1 G, bezieht Arbeitslosengeld, steht der Vermittlung 30 Stunden zur Verfügung');
    expect(field(p, 'alg').value).toBe(true);
    expect(field(p, 'alg_stunden').value).toBe('30');
    expect(field(p, 'taetigkeit').state).toBe('leer');
    const issues = check('muster-52', { ...valuesOf(p.fields), stw_geplant: true, keine: true }, facts);
    expect(texts(issues, 'unzulaessig')).toContain('nicht für Arbeitslose');
    expect(texts(issues, 'fehlt')).toContain('Begründung');
  });
});

describe('Muster 63 – SAPV', () => {
  it('SAPV-Erstverordnung: Symptome, Zeitraum, Maßnahmen', () => {
    expect(analyse('SAPV verordnen, Pankreaskarzinom').suggestions[0]?.formId).toBe('muster-63');
    const { p, issues } = run('muster-63', 'SAPV Erstverordnung vom 28.10. bis 10.11.2026 wegen Pankreaskarzinom C25.9 G mit Lebermetastasen. Tumorschmerz therapierefraktär, Erbrechen. Beschreibung: therapierefraktäre Schmerzen trotz Opioid, nicht beherrschbares Erbrechen. Medikation: Hydromorphon 4 mg retard 2x tgl. (BtM), Metoclopramid. Koordination und additive Teilversorgung, Beratung der Angehörigen.');
    expect(field(p, 'erst').value).toBe(true);
    expect([field(p, 'vom').value, field(p, 'bis').value]).toEqual(['281026', '101126']);
    expect([field(p, 'schmerz').value, field(p, 'gastro').value]).toEqual([true, true]);
    expect([field(p, 'koordination').value, field(p, 'teilversorgung').value, field(p, 'beratung').value, field(p, 'beratung_patient').value]).toEqual([true, true, true, true]);
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('ohne Symptomgeschehen und Maßnahmen: fehlt; Teil- und Vollversorgung zugleich unzulässig', () => {
    const { p, facts } = run('muster-63', 'SAPV bitte');
    const issues = check('muster-63', { ...valuesOf(p.fields), teilversorgung: true, vollversorgung: true }, facts);
    expect(texts(issues, 'fehlt')).toContain('komplexes Symptomgeschehen');
    expect(texts(issues, 'unzulaessig')).toContain('Teilversorgung');
  });
});
