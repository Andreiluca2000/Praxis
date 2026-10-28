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

describe('Muster 15 – Fachregeln', () => {
  it('Seite und Nachversorgung aus der Beschreibung; Audiometrie und Ohrbefund fehlen', () => {
    const r = run('muster-15', 'Hörgerät rechts, Nachversorgung. Diagnose: Innenohrschwerhörigkeit H90.3 G');
    expect([field(r.p, 'hoerhilfe_rechts').value, field(r.p, 'hoerhilfe_links').value, field(r.p, 'traeger_ja').value]).toEqual([true, false, true]);
    const f = texts(r.issues, 'fehlt');
    expect(f).toContain('Tonaudiogramm');
    expect(f).toContain('Sprachaudiogramm');
    expect(f).toContain('Nachversorgung');
    expect(f).toContain('Ohrbefund rechts');
  });
  it('vollständig ausgefüllt: keine Fehler; Widersprüche unzulässig', () => {
    const r = run('muster-15', 'Hörgerät beidseits, Erstversorgung. Diagnose: Presbyakusis H91.1 G');
    const full = { tonaudiogramm_r: '0,5–4 kHz 40–60 dB', tonaudiogramm_l: '0,5–4 kHz 45–65 dB', sprachaudiogramm_r: '70 % bei 65 dB', gehoergang_normal_r: true, gehoergang_normal_l: true, trommelfell_intakt_r: true, trommelfell_intakt_l: true };
    expect(texts(recheck('muster-15', r, full), 'fehlt')).toBe('');
    const t = texts(recheck('muster-15', r, { ...full, hoerhilfe_rechts: true, trommelfell_durchloechert_l: true, tinnitus_links_khz: '4' }), 'unzulaessig');
    expect(t).toContain('beiderseits');
    expect(t).toContain('intakt und durchlöchert');
    expect(texts(recheck('muster-15', r, { ...full, tinnitus_links_khz: '4' }), 'fehlt')).toContain('Verdeckbarkeit');
  });
});

describe('Muster 62C – Fachregeln', () => {
  it('Ziele und Notfallmanagement aus der Beschreibung, MRE und Trachealkanüle mit Pflichtangaben', () => {
    const r = run('muster-62c', 'Behandlungsplan Intensivpflege. Therapieziele: stabile Beatmung zu Hause. Notfallmanagement: bei Entsättigung Kanülenwechsel, Notarzt. MRSA im Nasenabstrich. Tracheostoma, Absaugen');
    expect(field(r.p, 'therapieziele').value).toBe('stabile Beatmung zu Hause');
    expect([field(r.p, 'mre_ja').value, field(r.p, 'trachealkanuele').value, field(r.p, 'absaug_ja').value]).toEqual([true, true, true]);
    const f = texts(r.issues, 'fehlt');
    expect(f).toContain('Keim angeben');
    expect(f).toContain('dilatativ oder chirurgisch');
    expect(f).toContain('Häufigkeit pro Tag');
    expect(texts(r.issues, 'hinweis')).toContain('Muster 12');
  });
  it('Sauerstoff über 24 Stunden unzulässig; Behandlungspflege braucht Häufigkeit und Dauer', () => {
    const r = run('muster-62c', 'Behandlungsplan Intensivpflege. Therapieziele: x. Notfallmanagement: y. Keine MRE');
    const t = recheck('muster-62c', r, { mre_nein: true, sauerstoff: true, sauerstoff_ja: true, o2_spontan_flow: '2', o2_spontan_dauer: '20', o2_mobilitaet_flow: '4', o2_mobilitaet_dauer: '6', pflege_leistung_1: 'PEG-Pflege' });
    expect(texts(t, 'unzulaessig')).toContain('26 Stunden');
    expect(texts(t, 'fehlt')).toContain('Behandlungspflege Zeile 1');
  });
});

describe('Muster 8/8A – Fachregeln', () => {
  it('Muster 8: Folgeversorgung ohne 0,5 dpt nur mit +20 Prozentpunkten; Achse höchstens 180', () => {
    const r = run('muster-08', 'Brille, Folgeversorgung. Diagnose: Myopie beidseits, WHO 1. Verordnung: Einstärkengläser');
    expect([field(r.p, 'folgeversorgung').value, field(r.p, 'who1').value]).toEqual([true, true]);
    expect(field(r.p, 'menge_art').value).toBe('Einstärkengläser');
    expect(texts(r.issues, 'fehlt')).toContain('0,5 Dioptrien');
    const t = texts(recheck('muster-08', r, { aenderung_nein: true, zylinder_f_r: '-0,75', achse_f_r: '200' }), 'unzulaessig');
    expect(t).toContain('20 Prozentpunkte');
    expect(t).toContain('0 bis 180');
  });
  it('Muster 8: Erwachsene ohne WHO 1 Hinweis; Kinder nicht; Keratokonus braucht Hornhautradien', () => {
    expect(texts(run('muster-08', 'Brille. Diagnose: Myopie. Verordnung: Einstärkengläser').issues, 'hinweis')).toContain('WHO-Stufe 1');
    expect(texts(run('muster-08', 'Brille für Tochter 9 Jahre. Diagnose: Hyperopie. Verordnung: Einstärkengläser').issues, 'hinweis')).not.toContain('WHO-Stufe 1');
    expect(texts(run('muster-08', 'Kontaktlinsen. Diagnose: Keratokonus beidseits. Verordnung: formstabile Kontaktlinsen').issues, 'fehlt')).toContain('Hornhautradien');
  });
  it('Muster 8A: Visus und Vergrößerung aus der Beschreibung; WHO 1 bei Visus über 0,3 unzulässig; binokular begründen', () => {
    const r = run('muster-08a', 'Lupenbrille, Visus R 0,2 L 0,1 mit Brille, 4-fach. Diagnose: AMD WHO 1. Verordnung: Lupenbrille binokular');
    expect([field(r.p, 'fernvisus_rechts').value, field(r.p, 'fernvisus_links').value, field(r.p, 'vergroesserungsbedarf').value, field(r.p, 'mit_brille').value]).toEqual(['0,2', '0,1', '4', true]);
    expect(texts(r.issues, 'fehlt')).toContain('Binokulare Versorgung');
    expect(texts(recheck('muster-08a', r, { fernvisus_rechts: '0,5' }), 'unzulaessig')).toContain('höchstens 0,3');
  });
});

describe('Muster 25 – Fachregeln', () => {
  it('Vorsorgeart, Risikofaktoren, Befundlage und Kurort aus der Beschreibung', () => {
    const r = run('muster-25', 'Ambulante Vorsorge im Kurort. Diagnose: chronische Lumbalgie. Ziel: Schmerzlinderung. Bewegungsmangel, Übergewicht, Stress. Krankengymnastik. Reizklima');
    expect([field(r.p, 'art_verschlimmerung').value, field(r.p, 'rf_bewegungsmangel').value, field(r.p, 'rf_uebergewicht').value, field(r.p, 'm_krankengymnastik').value]).toEqual([true, true, true, true]);
    expect([field(r.p, 'befunde_mdk').value, field(r.p, 'kurort_anf_ja').value, field(r.p, 'kompaktkur_nein').value]).toEqual([true, true, true]);
    expect(texts(r.issues, 'fehlt')).toContain('Datum der letzten Untersuchung');
  });
  it('Diagnose in Klarschrift; Kennziffern 1–3; Wartezeit nur bei Dringlichkeit', () => {
    const r = run('muster-25', 'Ambulante Vorsorge im Kurort. Diagnose: Lumbalgie. Ziel: x');
    const t = recheck('muster-25', r, { diagnose_1: 'M54.5 G', ursache_1: '5', wartezeit_begruendung: 'Wunsch der Patientin' });
    expect(texts(t, 'hinweis')).toContain('Klarschrift');
    expect(texts(t, 'unzulaessig')).toContain('Kennziffer 1');
    expect(texts(t, 'hinweis')).toContain('3 Jahren');
  });
});
