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

describe('Muster 3 und 5', () => {
  it('Muster 3: Entbindungstermin nach Naegele aus der letzten Periode; Termin vor Untersuchung unzulässig', () => {
    const r = run('muster-03', 'Zeugnis über den mutmaßlichen Tag der Entbindung, LP 01.06.2026');
    expect(field(r.p, 'entbindung_am').value).toBe('080327');
    expect(texts(r.issues, 'unzulaessig')).toBe('');
    expect(texts(recheck('muster-03', r, { entbindung_am: '011026' }), 'unzulaessig')).toContain('nicht nach dem Untersuchungstag');
  });
  it('Muster 5: belegärztlich braucht Zeitraum; Psychotherapie braucht Anerkennungsbescheid', () => {
    const r = run('muster-05', 'Abrechnungsschein belegärztlich, Diagnose: Cholezystolithiasis K80.20 G');
    expect(field(r.p, 'belegaerztlich').value).toBe(true);
    expect(texts(r.issues, 'fehlt')).toContain('stationären Aufenthalts');
    expect(texts(recheck('muster-05', r, { psychotherapie: true }), 'fehlt')).toContain('Anerkennungsbescheids');
  });
});

describe('Muster 7, 11, 22', () => {
  it('Muster 7: Hinweis auf Muster 22 binnen drei Wochen', () => {
    expect(texts(run('muster-07', 'Überweisung zur Abklärung somatischer Ursachen. Diagnose: depressive Episode F32.1 G').issues, 'hinweis')).toContain('Muster 22');
  });
  it('Muster 11: Diagnose oder Befunde genügt; Mitbehandlung ja braucht Fachbereich', () => {
    const r = run('muster-11', 'Bericht für den MD, heute untersucht. Befunde: Lumbalgie mit Bewegungseinschränkung');
    expect(field(r.p, 'datum_untersuchung').value).toBe('281026');
    expect(texts(r.issues, 'fehlt')).toBe('');
    const t = recheck('muster-11', r, { mitbehandlung_ja: true, mitbehandlung_nein: true });
    expect(texts(t, 'unzulaessig')).toContain('entweder ja oder nein');
    expect(texts(t, 'fehlt')).toContain('Fachbereich');
  });
  it('Muster 22: Chiffre aus DURIA, LANR/BSNR mit 9 Ziffern, Widersprüche unzulässig', () => {
    const r = run('muster-22', 'Konsiliarbericht. Befund: körperlich unauffällig, keine somatische Ursache');
    expect(field(r.p, 'chiffre_buchstabe').state).toBe('duria');
    expect(texts(r.issues, 'fehlt')).toContain('Arztnummer');
    const t = texts(recheck('muster-22', r, { arztnummer: '1234', psych_nicht_erforderlich: true, psych_veranlasst: true }), 'unzulaessig');
    expect(t).toContain('9 Ziffern');
    expect(t).toContain('nicht erforderlich');
  });
});

describe('Muster 28, 50, 51, 53', () => {
  it('Muster 28: nur eine Angabe zur Krankenhausbehandlung', () => {
    const r = run('muster-28', 'Überweisung zur Indikationsstellung für Soziotherapie, F20.0 V, Krankenhausbehandlung wird vermieden');
    expect(texts(r.issues, 'unzulaessig')).toBe('');
    expect(texts(recheck('muster-28', r, { kh_verkuerzt: true }), 'unzulaessig')).toContain('nur die zutreffende');
  });
  it('Muster 50: Name falsch → berichtigen; Behandlungstage nur bei neuer Kasse', () => {
    const r = run('muster-50', 'Anfrage zur Zuständigkeit einer anderen Krankenkasse');
    const t = recheck('muster-50', r, { name_richtig_nein: true, ausweis_ja: true, krankenkasse_name: 'AOK', behandlungstag_01: '011026' });
    expect(texts(t, 'fehlt')).toContain('berichtigen');
    expect(texts(t, 'hinweis')).toContain('nur bei Angabe einer neuen Krankenkasse');
  });
  it('Muster 51: Abschnitt 1 vollständig, Behandlungstage in jedem Fall; Abschnitt 2 nur wenn gefragt', () => {
    const r = run('muster-51', 'Anfrage zur Zuständigkeit eines sonstigen Kostenträgers');
    expect(texts(r.issues, 'fehlt')).toContain('Sachverhalt');
    const t = recheck('muster-51', r, { ueberw_nein: true, leistungen_ja: true });
    const f = texts(t, 'fehlt');
    expect(f).toContain('Behandlung dauert noch an');
    expect(f).toContain('genau bezeichnen');
    expect(f).toContain('in jedem Fall');
    expect(f).not.toContain('Versorgungsleiden');
  });
  it('Muster 53: hinzugetretene Krankheit mit Datum und Folgefragen', () => {
    const r = run('muster-53', 'Anfrage zum Zusammenhang von AU-Zeiten');
    const t = recheck('muster-53', r, { dieselbe_nein: true, hinzu_ja: true });
    const f = texts(t, 'fehlt');
    expect(f).toContain('Hinzugetretene Krankheit');
    expect(f).toContain('hinzugetreten ist');
    expect(f).toContain('ja oder nein');
  });
});

describe('Muster 62A, 70, 70A', () => {
  it('Muster 62A: Ergebnis mit Einrichtung/Termin; Schluckdiagnostik bei Dekanülierung; Intervall', () => {
    const r = run('muster-62a', 'Potenzialerhebung Beatmungsentwöhnung. Maßnahmen: Spontanatmungsversuch 2 h');
    const t = recheck('muster-62a', r, { vor_beatmung: true, nicht_beatmung: true, persp_dekanuelierung: true, datum_erhebung: '281026', datum_naechste: '300627' });
    expect(texts(t, 'unzulaessig')).toContain('nur ein Ergebnis');
    const f = texts(t, 'fehlt');
    expect(f).toContain('spezialisierte Einrichtung');
    expect(f).toContain('Schluckdiagnostik');
    expect(f).toContain('Therapieoptimierung');
  });
  it('Muster 70: eine Maßnahme je Plan, ICSI-Indikation, Personalfeld Ehemann „!“', () => {
    const r = run('muster-70', 'Behandlungsplan künstliche Befruchtung, ICSI. Indikation: Tubenverschluss');
    expect(field(r.p, 'icsi').value).toBe(true);
    expect(field(r.p, 'personalien_mann').state).toBe('unbekannt');
    expect(texts(r.issues, 'hinweis')).toContain('männlicher Fertilitätsstörung');
    expect(texts(recheck('muster-70', r, { ivf: true }), 'unzulaessig')).toContain('Nur eine geplante Behandlungsmaßnahme');
  });
  it('Muster 70A: Versuche ohne Schwangerschaft angeben', () => {
    const r = run('muster-70a', 'Folge-Behandlungsplan künstliche Befruchtung, IVF');
    expect(texts(recheck('muster-70a', r, { bisherige_behandlungen: '3 x 10.3' }), 'fehlt')).toContain('ohne Schwangerschaft');
  });
});
