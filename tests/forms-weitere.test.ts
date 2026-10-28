import { describe, expect, it } from 'vitest';
import { analyse, check, propose } from '../src/forms/advisor.js';
import { valuesOf } from '../src/forms/build.js';
import { getForm } from '../src/forms/catalog.js';
import { WEITERE_IDS } from '../src/forms/weitere.js';
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
const ids = (text: string) => analyse(text).suggestions.map((s) => s.formId);

describe('Weitere Vordrucke – allgemeine Ausfüllhilfe', () => {
  it.each(WEITERE_IDS)('%s: Vorschlag deckt jedes Feld ab, Personalien aus DURIA bzw. von anderen, Prüfung läuft', (id) => {
    const { p, issues } = run(id, 'Bitte ausfüllen');
    const form = getForm(id);
    expect(p.fields.map((f) => f.fieldId)).toEqual(form.fields.map((f) => f.id));
    for (const f of form.fields) {
      const pr = field(p, f.id);
      if (f.kind === 'personalien' && f.filled_by === 'duria') expect(pr.state).toBe('duria');
      if (!['arzt', 'praxis', 'duria'].includes(f.filled_by)) expect(pr.state).toBe('leer');
    }
    for (const i of issues) expect(i.rule === null || typeof i.rule.source.locator === 'string').toBe(true);
  });

  it('Stichwörter → passender Vordruck', () => {
    expect(ids('Zeugnis über den mutmaßlichen Tag der Entbindung')).toEqual(['muster-03']);
    expect(ids('Brille verordnen, Myopie')).toEqual(['muster-08']);
    expect(ids('Lupenbrille bei Makuladegeneration')).toEqual(['muster-08a']);
    expect(ids('Hörgerät beidseits')).toEqual(['muster-15']);
    expect(ids('Rehasport nach Knie-TEP')).toEqual(['muster-56']);
    expect(ids('Überweisung zur Indikationsstellung für Soziotherapie')).toEqual(['muster-28']);
    expect(ids('Außerklinische Intensivpflege verordnen')).toEqual(['muster-62b', 'muster-62c']);
    expect(ids('Folge-Behandlungsplan künstliche Befruchtung')).toEqual(['muster-70a']);
    expect(ids('Präventionsempfehlung Bewegung und Ernährung')).toEqual(['muster-36']);
  });
});

describe('Weitere Vordrucke – vordruckeigene Regeln', () => {
  it('Muster 3: Entbindungstermin aus der Beschreibung, Untersuchung heute; Termin vor der Untersuchung unzulässig', () => {
    const { p, facts, issues } = run('muster-03', 'Mutterschutz: Entbindungstermin 12.03.2027');
    expect([field(p, 'entbindung_am').value, field(p, 'untersuchung_am').value]).toEqual(['120327', '281026']);
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(check('muster-03', { ...valuesOf(p.fields), entbindung_am: '011026' }, facts), 'unzulaessig')).toContain('nicht nach dem Untersuchungstag');
  });
  it('Muster 5 und 16: keine Abrechnungsziffern; bei Arbeitsunfall nicht zu verwenden bzw. Unfalltag nötig', () => {
    const m5 = run('muster-05', 'Abrechnungsschein wegen Lumbago M54.5 G, Arbeitsunfall');
    expect(field(m5.p, 'leistungen_links').state).toBe('leer');
    expect(field(m5.p, 'diagnose1').value).toContain('M54.5 G');
    expect(texts(m5.issues, 'unzulaessig')).toContain('Arbeitsunfall');
    const m16 = run('muster-16', 'Rezept für Ibuprofen 600 nach Arbeitsunfall');
    expect(field(m16.p, 'arbeitsunfall').value).toBe(true);
    expect(texts(m16.issues, 'fehlt')).toContain('Unfalltag');
  });
  it('Muster 16: Präparate aus der Beschreibung, zuzahlungsbefreit → Gebühr frei', () => {
    const { p, issues } = run('muster-16', 'Kassenrezept, zuzahlungsbefreit. Präparate: Ramipril 5 mg N3');
    expect(field(p, 'verordnung_1').value).toBe('Ramipril 5 mg N3');
    expect([field(p, 'gebuehr_frei').value, field(p, 'geb_pfl').value]).toEqual([true, false]);
    expect(texts(issues, 'fehlt')).toBe('');
  });
  it('Muster 36: Handlungsfelder aus der Beschreibung; ohne Handlungsfeld fehlt', () => {
    const { p, issues } = run('muster-36', 'Präventionsempfehlung: Bewegung und Stressbewältigung');
    expect([field(p, 'bewegung').value, field(p, 'stress').value, field(p, 'sucht').value]).toEqual([true, true, false]);
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(run('muster-36', 'Präventionsempfehlung').issues, 'fehlt')).toContain('Handlungsfeld');
  });
  it('Muster 39: Alterskategorie aus dem Alter, Auftrag Ko-Testung', () => {
    const { p } = run('muster-39', 'Zervix-Früherkennung, 42 Jahre, Ko-Testung');
    expect([field(p, 'alter_ab_35').value, field(p, 'alter_20_29').value, field(p, 'auftrag_ko').value]).toEqual([true, false, true]);
  });
  it('Muster 56: Funktionstraining Wasser, Diagnose mit ICD; Folgeverordnung braucht Begründung', () => {
    const { p, facts, issues } = run('muster-56', 'Funktionstraining Wassergymnastik bei Gonarthrose M17.1 G. Ziel: Beweglichkeit erhalten');
    expect([field(p, 'funktionstraining').value, field(p, 'reha_sport').value, field(p, 'ft_wasser').value, field(p, 'icd1').value]).toEqual([true, false, true, 'M17.1 G']);
    expect(field(p, 'ziel').value).toBe('Beweglichkeit erhalten');
    expect(texts(issues, 'fehlt')).toBe('');
    expect(texts(check('muster-56', { ...valuesOf(p.fields), folgeverordnung: true }, facts), 'fehlt')).toContain('Folgeverordnung');
  });
  it('Muster 62B: Zeitraum, Erstverordnung, Stunden je Tag fehlt', () => {
    const { p, issues } = run('muster-62b', 'Außerklinische Intensivpflege, Erstverordnung vom 01.11.2026 bis 31.01.2027, ALS G12.2 G, invasive Beatmung');
    expect([field(p, 'vom').value, field(p, 'bis').value, field(p, 'erstverordnung').value, field(p, 'diagnose_1').value]).toEqual(['011126', '310127', true, 'G12.2 G']);
    expect(texts(issues, 'fehlt')).toContain('Stunden je Tag');
  });
  it('genau-eins-Gruppen ohne Treffer sind zu entscheiden („?“); ICD ohne Sicherheit fehlt', () => {
    const { p, facts } = run('muster-15', 'Hörgerät, Diagnose: Schwerhörigkeit');
    expect(field(p, 'traeger_ja').state).toBe('unbekannt');
    expect(texts(check('muster-15', { ...valuesOf(p.fields), diagnose: 'H90.3' }, facts), 'fehlt')).toContain('Diagnosesicherheit');
  });
});
