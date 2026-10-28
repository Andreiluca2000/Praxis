import { describe, expect, it } from 'vitest';
import { analyse, check, propose } from '../src/forms/advisor.js';
import { valuesOf } from '../src/forms/build.js';
import { extractFacts } from '../src/forms/facts.js';
import { icdCodes, quarterQJJ, reasonPhrase } from '../src/forms/text.js';
import type { FormId, FormIssue, FormProposal } from '../src/forms/types.js';

// Alle Beschreibungen sind erfunden (synthetisch); keine Patientendaten.
const TODAY = new Date('2026-10-27T10:00:00');

function run(formId: FormId, text: string) {
  const { facts } = analyse(text);
  const p = propose(formId, text, facts, TODAY);
  return { p, facts, issues: check(formId, valuesOf(p.fields), facts) };
}
const field = (p: FormProposal, id: string) => {
  const f = p.fields.find((x) => x.fieldId === id);
  if (!f) throw new Error(`Feld ${id} fehlt`);
  return f;
};
const levels = (issues: FormIssue[], level: FormIssue['level']) => issues.filter((i) => i.level === level).map((i) => i.text);

describe('Texthelfer', () => {
  it('Quartal als QJJ', () => {
    expect(quarterQJJ(new Date('2026-10-27'))).toBe('426');
    expect(quarterQJJ(new Date('2027-01-02'))).toBe('127');
  });
  it('ICD nur mit ausdrücklicher Sicherheit', () => {
    expect(icdCodes('V. a. KHK I25.9 V, Hypertonie I10.90')).toEqual([
      { icd: 'I25.9', certainty: 'V', evidence: 'I25.9 V' },
      { icd: 'I10.90', certainty: null, evidence: 'I10.90' },
    ]);
  });
  it('Anlass wörtlich, ohne „dringend“', () => {
    expect(reasonPhrase('Überweisung zum Kardiologen wegen Belastungsdyspnoe, dringend')).toBe('Belastungsdyspnoe');
    expect(reasonPhrase('zur Abklärung einer Synkope dringend')).toBe('Synkope');
  });
  it('Verneinung wird nicht als Tatsache übernommen', () => {
    expect(extractFacts('kein Unfall, kein Notfall').unfall).toBeNull();
    expect(extractFacts('kein Unfall, kein Notfall').notfall).toBeNull();
  });
});

describe('Analyse: welcher Vordruck passt', () => {
  it('Überweisung zum Kardiologen → Muster 6', () => {
    const a = analyse('Überweisung zum Kardiologen wegen Belastungsdyspnoe, dringend');
    expect(a.suggestions.map((s) => s.formId)).toEqual(['muster-06']);
  });
  it('„zum Orthopäden“ ohne das Wort Überweisung → Muster 6', () => {
    expect(analyse('Patientin bitte zum Orthopäden wegen Gonarthrose').suggestions[0]?.formId).toBe('muster-06');
  });
  it('Einweisung → Muster 2', () => {
    expect(analyse('Einweisung wegen Pneumonie, Notfall').suggestions[0]?.formId).toBe('muster-02');
  });
  it('Pflegegrad 5 allein → Taxi zur ambulanten Behandlung genehmigungsfrei (Muster 4 b)', () => {
    const a = analyse('Pflegegrad 5, Rollstuhl');
    expect(a.facts.pflegegrad?.value).toBe(5);
    expect(a.suggestions).toHaveLength(1);
    expect(a.suggestions[0]).toMatchObject({ formId: 'muster-04', role: 'zusaetzlich' });
    expect(a.suggestions[0]?.why).toContain('genehmigungsfrei (b)');
  });
  it('Überweisung + Merkzeichen aG → zusätzlich Muster 4', () => {
    const a = analyse('Überweisung zur Neurologie, Schwerbehindertenausweis Merkzeichen aG');
    expect(a.suggestions.map((s) => [s.formId, s.role])).toEqual([['muster-06', 'hauptsache'], ['muster-04', 'zusaetzlich']]);
  });
  it('„Taxi zum Neurologen“ → nur Muster 4, das Fachgebiet ist das Fahrtziel', () => {
    expect(analyse('Taxi zum Neurologen, Pflegegrad 5').suggestions.map((s) => s.formId)).toEqual(['muster-04']);
  });
  it('Laborüberweisung → Muster 10 (nicht Muster 6)', () => {
    expect(analyse('Überweisung ans Labor für Blutbild').suggestions.map((s) => s.formId)).toEqual(['muster-10', 'muster-10a']);
  });
  it('Gesamtkatalog: „SAPV“ findet Muster 63 (nur Regeln, noch keine Vorschau)', () => {
    const a = analyse('spezialisierte ambulante Palliativversorgung SAPV');
    expect(a.suggestions).toEqual([]);
    expect(a.catalog[0]?.entry.muster).toBe('63');
    expect(a.catalog[0]?.entry.rules.length).toBeGreaterThan(5);
  });
  it('ambulante OP im Krankenhaus ist keine Einweisung', () => {
    expect(analyse('ambulante OP im Krankenhaus, Leistenhernie').suggestions.map((s) => s.formId)).toEqual(['muster-06']);
  });
});

describe('Muster 6 – Überweisungsschein', () => {
  it('Beispiel aus der Aufgabe: Kardiologie, Belastungsdyspnoe, dringend', () => {
    const { p, issues } = run('muster-06', 'Überweisung zum Kardiologen wegen Belastungsdyspnoe, dringend');
    expect(field(p, 'personalien')).toMatchObject({ state: 'duria', value: 'aus DURIA' });
    expect(field(p, 'kurativ')).toMatchObject({ state: 'vorgeschlagen', value: true });
    expect(field(p, 'praeventiv')).toMatchObject({ state: 'leer', value: false });
    expect(field(p, 'quartal').value).toBe('426');
    expect(field(p, 'ueberweisung_an')).toMatchObject({ state: 'vorgeschlagen', value: 'Innere Medizin und Kardiologie' });
    expect(field(p, 'diagnose')).toMatchObject({ state: 'arzt', value: 'Belastungsdyspnoe' });
    expect(String(field(p, 'auftrag').value)).toContain('dringend');
    // Zweck nicht ableitbar → unbekannt, nichts erfunden
    expect(field(p, 'konsil')).toMatchObject({ state: 'unbekannt', value: null });
    expect(levels(issues, 'fehlt').join(' ')).toContain('Zweck der Überweisung');
    expect(levels(issues, 'hinweis').join(' ')).toContain('kein Feld für Dringlichkeit');
    expect(field(p, 'ueberweisung_an').rule?.source.locator).toContain('❻');
  });
  it('Echo und Belastungs-EKG beim Radiologen/Kardiologen „zur Durchführung“ → Auftragsleistung mit Art und Umfang', () => {
    const { p } = run('muster-06', 'Überweisung Kardiologie zur Durchführung Echo und Belastungs-EKG bei V. a. KHK I25.9 V');
    expect(field(p, 'auftragsleistung').value).toBe(true);
    expect(String(field(p, 'auftrag').value)).toContain('Echokardiographie, Belastungs-EKG');
    expect(String(field(p, 'diagnose').value)).toContain('I25.9 V');
  });
  it('ICD ohne Sicherheit wird nicht übernommen und gemeldet, wenn von Hand eingetragen', () => {
    const { p, facts } = run('muster-06', 'Überweisung Orthopädie zur Mitbehandlung bei Gonarthrose M17.1');
    expect(String(field(p, 'diagnose').value)).not.toContain('M17.1');
    const issues = check('muster-06', { ...valuesOf(p.fields), diagnose: 'Gonarthrose M17.1' }, facts);
    expect(levels(issues, 'fehlt').join(' ')).toContain('M17.1: Diagnosesicherheit');
  });
  it('Arbeitsunfall → Muster 6 unzulässig', () => {
    const { issues } = run('muster-06', 'Überweisung Orthopädie nach Arbeitsunfall, Distorsion');
    expect(levels(issues, 'unzulaessig')[0]).toContain('F 1050');
  });
  it('Unfall in der Freizeit → Unfall ankreuzen', () => {
    const { p } = run('muster-06', 'Überweisung Chirurgie zur Mitbehandlung nach Sturz beim Joggen');
    expect(field(p, 'unfall')).toMatchObject({ state: 'vorgeschlagen', value: true, evidence: 'Sturz' });
    expect(field(p, 'mitbehandlung').value).toBe(true);
  });
  it('Handänderungen werden geprüft: zwei Arten, Auftragsleistung ohne Auftrag, Arztname, AU ohne Weiterbehandlung, falsches Datum', () => {
    const { p, facts } = run('muster-06', 'Überweisung Kardiologie wegen Palpitationen');
    const values = { ...valuesOf(p.fields), praeventiv: true, auftragsleistung: true, auftrag: '', ueberweisung_an: 'Dr. Muster', au_bis: '311399' };
    const issues = check('muster-06', values, facts);
    const t = issues.map((i) => i.text).join(' | ');
    expect(t).toContain('nur ein Feld ankreuzen');
    expect(t).toContain('Art und Umfang');
    expect(t).toContain('Namentliche Überweisung');
    expect(t).toContain('AU bis');
    expect(t).toContain('kein gültiges Datum');
    expect(issues[0]?.level).toBe('unzulaessig');
  });
  it('AU bis aus der Beschreibung als TTMMJJ', () => {
    const { p } = run('muster-06', 'Überweisung Orthopädie zur Weiterbehandlung, AU bis 07.11.2026');
    expect(field(p, 'au_bis').value).toBe('071126');
  });
});

describe('Muster 2 – Krankenhausbehandlung', () => {
  it('Notfall-Einweisung mit Befund und Allergie', () => {
    const { p, issues } = run('muster-02', 'Einweisung ins St. Beispiel-Hospital wegen V. a. Pneumonie, Notfall. Befund: SpO2 88 %, Fieber 39,5. Medikation: Ramipril 5 mg. Allergie: Penicillin');
    expect(field(p, 'notfall').value).toBe(true);
    expect(field(p, 'diagnose').value).toBe('V. a. Pneumonie');
    expect(field(p, 'untersuchungsergebnisse').value).toBe('SpO2 88 %, Fieber 39,5');
    expect(field(p, 'massnahmen').value).toBe('Ramipril 5 mg');
    expect(field(p, 'fragestellung').value).toBe('Penicillin');
    expect(field(p, 'krankenhaeuser').value).toBe('St. Beispiel-Hospital');
    expect(levels(issues, 'unzulaessig')).toEqual([]);
    expect(issues.map((i) => i.rule?.id)).not.toContain('m02.ausfertigungen');
  });
  it('Reha → Muster 2 unzulässig', () => {
    const { issues } = run('muster-02', 'Einweisung in Rehaklinik nach Hüft-TEP');
    expect(levels(issues, 'unzulaessig')[0]).toContain('Muster 61');
  });
  it('nur Pflegebedarf → kein Anspruch', () => {
    const { issues } = run('muster-02', 'Einweisung, zu Hause nicht mehr versorgbar, Diagnose: Demenz');
    expect(levels(issues, 'unzulaessig')[0]).toContain('Pflegebedarf');
  });
  it('Begleitperson ohne KHB-Kriterium → fehlt', () => {
    const { issues } = run('muster-02', 'Einweisung wegen Ileus. Hinweis: Begleitperson erforderlich');
    expect(levels(issues, 'fehlt').join(' ')).toContain('KHB-RL');
  });
});

describe('Muster 4 – Krankenbeförderung (Taxischein)', () => {
  it('Pflegegrad 5, Rollstuhl, Termin beim Neurologen → b) Taxi, genehmigungsfrei', () => {
    const { p, issues } = run('muster-04', 'Taxi zum Neurologen, Pflegegrad 5, Rollstuhl, Hin- und Rückfahrt, Termin am 03.11.2026');
    expect(field(p, 'b_ambulant')).toMatchObject({ state: 'vorgeschlagen', value: true });
    expect(field(p, 'taxi').value).toBe(true);
    expect(field(p, 'rollstuhl').value).toBe(true);
    expect(field(p, 'zuzahlungspflicht').value).toBe(true);
    expect(field(p, 'behandlung_vom').value).toBe('031126');
    expect(field(p, 'behandlungsstaette').value).toBe('Fachrichtung: Neurologie');
    expect(levels(issues, 'unzulaessig')).toEqual([]);
    expect(levels(issues, 'fehlt')).toEqual([]);
  });
  it('Pflegegrad 2 und b) von Hand angekreuzt → „so nicht möglich“', () => {
    const { p, facts } = run('muster-04', 'Taxi zum Orthopäden, Pflegegrad 2, Hin- und Rückfahrt');
    expect(field(p, 'b_ambulant').state).toBe('unbekannt');
    const issues = check('muster-04', { ...valuesOf(p.fields), b_ambulant: true, taxi: true }, facts);
    expect(levels(issues, 'unzulaessig').join(' ')).toContain('b) ist so nicht möglich');
  });
  it('Pflegegrad 3 ohne Angabe zur Mobilität → Nachweis fehlt', () => {
    const { p, facts } = run('muster-04', 'Taxi zur Augenarzt-Praxis, Pflegegrad 3');
    const issues = check('muster-04', { ...valuesOf(p.fields), b_ambulant: true, taxi: true }, facts);
    expect(levels(issues, 'fehlt').join(' ')).toContain('Mobilitätsbeeinträchtigung');
  });
  it('Dialyse → d) genehmigungspflichtig, Hinweis zur Vorlage bei der Kasse', () => {
    const { p, issues } = run('muster-04', 'Fahrten zur Dialyse 3x pro Woche, Taxi, Hin- und Rückfahrt');
    expect(field(p, 'd_hochfrequent').value).toBe(true);
    expect(field(p, 'frequenz').value).toBe('3');
    expect(levels(issues, 'hinweis').join(' ')).toContain('Genehmigungspflichtig');
  });
  it('KTW bei Pflegegrad 4 → f), KTW-Begründung fehlt', () => {
    const { p, issues } = run('muster-04', 'KTW liegend zur Radiologie, Pflegegrad 4, Hin- und Rückfahrt');
    expect(field(p, 'f_ktw').value).toBe(true);
    expect(field(p, 'ktw').value).toBe(true);
    expect(field(p, 'liegend').value).toBe(true);
    expect(levels(issues, 'fehlt').join(' ')).toContain('Funktionsstörung');
  });
  it('Fahrt zum Rezept abholen → unzulässig', () => {
    const { issues } = run('muster-04', 'Taxi zum Rezept abholen, Pflegegrad 4');
    expect(levels(issues, 'unzulaessig')[0]).toContain('zwingenden medizinischen Grund');
  });
  it('Arbeitsunfall → zuzahlungsfrei, UV-Träger im Personalienfeld', () => {
    const { p, issues } = run('muster-04', 'Fahrt zur stationären Aufnahme nach Arbeitsunfall, KTW liegend wegen Beckenfraktur, Hinfahrt');
    expect(field(p, 'zuzahlungsfrei').value).toBe(true);
    expect(field(p, 'arbeitsunfall').value).toBe(true);
    expect(field(p, 'a_stationaer').value).toBe(true);
    expect(levels(issues, 'hinweis').join(' ')).toContain('Unfallversicherungsträger');
  });
  it('Rollstuhl ohne Taxi/KTW und zuzahlungsfrei ohne Nachweis → gemeldet', () => {
    const { p, facts } = run('muster-04', 'Fahrt zur Chemotherapie');
    const issues = check('muster-04', { ...valuesOf(p.fields), taxi: false, rollstuhl: true, zuzahlungspflicht: false, zuzahlungsfrei: true }, facts);
    const t = issues.map((i) => i.text).join(' | ');
    expect(t).toContain('nur zusammen mit Taxi/Mietwagen oder KTW');
    expect(t).toContain('Nachweis fehlt');
  });
});
