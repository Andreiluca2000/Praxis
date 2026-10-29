import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyse, check, propose } from '../src/forms/advisor.js';
import { valuesOf } from '../src/forms/build.js';
import { getForm } from '../src/forms/catalog.js';
import type { FormId, FormIssue, FormProposal } from '../src/forms/types.js';

// Synthetische Beschreibungen, keine Patientendaten.
const TODAY = new Date('2026-10-28T10:00:00');
// check() prüft „rückwirkend“ gegen die Systemzeit – daher hier dieselbe feste Uhrzeit.
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(TODAY); });
afterAll(() => { vi.useRealTimers(); });
function run(formId: FormId, text: string) {
  const { facts } = analyse(text);
  const p = propose(formId, text, facts, TODAY);
  return { p, facts, issues: check(formId, valuesOf(p.fields), facts) };
}
const field = (p: FormProposal, id: string) => p.fields.find((x) => x.fieldId === id)!;
const texts = (issues: FormIssue[], level: FormIssue['level']) => issues.filter((i) => i.level === level).map((i) => i.text).join(' | ');

describe('Analyse: häusliche Krankenpflege und Reha', () => {
  it('Verbandwechsel durch den Pflegedienst → Muster 12', () => {
    expect(analyse('Häusliche Krankenpflege: Verbandwechsel Ulcus cruris').suggestions.map((s) => s.formId)).toEqual(['muster-12']);
  });
  it('Reha nach Knie-TEP → Muster 61', () => {
    expect(analyse('Reha nach Knie-TEP, 78 Jahre, Rentnerin').suggestions[0]?.formId).toBe('muster-61');
  });
});

describe('Muster 12 – häusliche Krankenpflege', () => {
  it('Kompressionsstrümpfe beidseits 1x tgl. für 14 Tage, Erstverordnung: Zeitraum, Häufigkeit, Seite', () => {
    const { p, issues } = run('muster-12', 'Erstverordnung: Kompressionsstrümpfe an- und ausziehen beidseits, 1x tgl., für 14 Tage. I83.9 G. Einschränkungen: kann sich wegen Arthrose der Hände nicht bücken');
    expect(field(p, 'erst').value).toBe(true);
    expect(field(p, 'kstrumpf_an').value).toBe(true);
    expect(field(p, 'kstrumpf_aus').value).toBe(true);
    expect(field(p, 'k_beidseits').value).toBe(true);
    expect(field(p, 'kstrumpf_an_hf').value).toBe('1x tgl.');
    expect(field(p, 'vom').value).toBe('281026');
    expect(field(p, 'bis').value).toBe('101126');
    expect(field(p, 'icd1').value).toBe('I83.9 G');
    expect(field(p, 'einschraenkungen').value).toContain('nicht bücken');
    expect(texts(issues, 'unzulaessig')).toBe('');
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('Wundversorgung chronisch (Dekubitus): Wundart, Lokalisation, Größe, Grad; Pflegefachkraft nicht erlaubt', () => {
    const { p, facts } = run('muster-12', 'Wundversorgung Dekubitus am Sakrum 3 x 2 x 0,5 cm, Kategorie 2, 1x tgl.');
    expect(field(p, 'wund_chronisch').value).toBe(true);
    expect(field(p, 'wundart').value).toBe('Dekubitus');
    expect(field(p, 'lokalisation').value).toBe('Sakrum');
    expect(field(p, 'groesse').value).toBe('3 x 2 x 0,5 cm');
    expect(field(p, 'grad').value).toBe('2');
    const t = texts(check('muster-12', { ...valuesOf(p.fields), wund_chronisch_pfk: true }, facts), 'unzulaessig');
    expect(t).toContain('chronischer Wundversorgung legt der Arzt');
  });
  it('Blankoverordnung: Pflegefachkraft legt fest – dann keine ärztliche Häufigkeit; Medikamentengabe braucht Präparate', () => {
    const { p, facts } = run('muster-12', 'Blankoverordnung Kompressionsverbände anlegen und abnehmen links. Medikamentengabe');
    expect(field(p, 'kverband_an_pfk').value).toBe(true);
    expect(field(p, 'kverband_an_hf').state).toBe('leer');
    const issues = check('muster-12', { ...valuesOf(p.fields), kverband_an_hf: '2x tgl.' }, facts);
    expect(texts(issues, 'unzulaessig')).toContain('keine ärztlichen Angaben');
    expect(texts(issues, 'fehlt')).toContain('Präparate');
  });
  it('Unterstützungspflege bei Pflegegrad 3 → so nicht möglich; Hauswirtschaft ohne Grundpflege → so nicht möglich', () => {
    const { p, facts } = run('muster-12', 'Unterstützungspflege nach Krankenhausaufenthalt, Hauswirtschaft 3x wöchentlich, Pflegegrad 3');
    const t = texts(check('muster-12', valuesOf(p.fields), facts), 'unzulaessig');
    expect(t).toContain('nicht bei Pflegegrad 3');
    expect(t).toContain('nur zusammen mit Grundpflege');
  });
  it('rückwirkender Zeitraum ohne Begründung, Erstverordnung über 14 Tage, BZ-Messung über 4 Wochen', () => {
    const { p, facts } = run('muster-12', 'Erstverordnung Blutzuckermessung Neueinstellung 3x tgl.');
    const issues = check('muster-12', { ...valuesOf(p.fields), vom: '010120', bis: '150220' }, facts);
    expect(texts(issues, 'fehlt')).toContain('Rückwirkende Verordnung');
    expect(texts(issues, 'hinweis')).toContain('Erstverordnung über 46 Tage');
    expect(texts(issues, 'unzulaessig')).toContain('höchstens 4 Wochen');
  });
});

describe('Muster 61 – Rehabilitation (Teil A–E)', () => {
  it('ist mehrseitig: fünf Teile, jedes Feld auf einer Seite', () => {
    const f = getForm('muster-61');
    expect(f.pages).toEqual(['Teil A', 'Teil B', 'Teil C', 'Teil D', 'Teil E']);
    expect(new Set(f.fields.map((x) => x.page)).size).toBe(5);
  });
  it('Rentnerin, Knie-TEP, ambulant, Rollator: Teil B–E, ❶ vorgeschlagen, Teil A leer', () => {
    const { p, issues } = run('muster-61', 'Reha orthopädisch ambulant nach Knie-TEP rechts wegen Gonarthrose M17.1 G, 78 Jahre, Rentnerin, Rollator, lebt allein. Ziele: Gehstrecke 500 m, Treppensteigen');
    expect(field(p, 'b_erwerb').value).toBe(true);
    expect(field(p, 'a_beratung').state).toBe('leer');
    expect(field(p, 'icd1').value).toBe('M17.1 G');
    expect(field(p, 'rf_ambulant').value).toBe(true);
    expect(field(p, 'hilfsmittel_ja').value).toBe(true);
    expect(field(p, 'hilfsmittel_text').value).toBe('Rollator');
    expect(field(p, 'schwerpunkt').value).toBe('orthopädisch');
    expect(field(p, 'geriatrisch').value).toBe(true);
    expect(field(p, 'ziele').value).toBe('Gehstrecke 500 m, Treppensteigen');
    const fehlt = texts(issues, 'fehlt');
    expect(fehlt).toContain('Lebensbereiche noch nicht eingeschätzt');
    expect(fehlt).toContain('zwei Funktionstests');
    expect(fehlt).toContain('häusliche Versorgung gesichert');
  });
  it('Funktionstests aus zwei Bereichen erfüllen die geriatrische Pflicht', () => {
    const { p, facts } = run('muster-61', 'Geriatrische Reha stationär, TUG 22 s, MMST 24, 82 Jahre, Rentner');
    expect(field(p, 't_tug').value).toBe('22');
    expect(field(p, 't_mmst').value).toBe('24');
    expect(texts(check('muster-61', valuesOf(p.fields), facts), 'fehlt')).not.toContain('Funktionstests');
  });
  it('Erwerbsfähigkeit betroffen → Teil A (Prüfung des Trägers); Teil A + B–E zusammen → so nicht möglich', () => {
    const { p, facts } = run('muster-61', 'Reha wegen chronischer Lumbalgie, Erwerbsfähigkeit gefährdet, Lagerist');
    expect(field(p, 'a_pruefung').value).toBe(true);
    expect(field(p, 'anamnese').state).toBe('leer');
    const issues = check('muster-61', { ...valuesOf(p.fields), anamnese: 'seit 2 Jahren' }, facts);
    expect(texts(issues, 'unzulaessig')).toContain('schließen sich aus');
  });
  it('Arbeitsunfall → Teil B–E nicht zu Lasten der Kasse; F: zwei Kreuze in einer Zeile → so nicht möglich', () => {
    const { p, facts } = run('muster-61', 'Reha nach Arbeitsunfall, Rentner');
    const issues = check('muster-61', { ...valuesOf(p.fields), f_lernen_k: true, f_lernen_e: true }, facts);
    const t = texts(issues, 'unzulaessig');
    expect(t).toContain('Unfallversicherung');
    expect(t).toContain('nur ein Kreuz je Bereich');
  });
});
