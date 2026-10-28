import { isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, icdCodes, uni } from './text.js';
import type { FieldProposal, FormIssue, FormValues, PatientFacts } from './types.js';

/**
 * Muster 25 – Anregung einer ambulanten Vorsorgeleistung in anerkannten Kurorten (§ 23 Abs. 2 SGB V, Stand 7.2009).
 * Erläuterungen 01/2026, S. 70. Fachregeln: Vorsorgeart, Diagnosen in Klarschrift (nicht ICD), Ursache/Verlauf als Kennziffer,
 * Befundlage, Klartext zu „Sonstige“, besondere Kurort-Anforderungen benennen, Wartezeit von 3 Jahren nur mit Begründung.
 */
const form = () => getForm('muster-25');
const DX = [1, 2, 3] as const;
const URSACHE_MAX = 3;
const VERLAUF_MAX = 3;

export const SPEC_25: GenericSpec = {
  required: ['diagnose_1', 'vorsorgeziel', 'letzte_untersuchung'],
  text: { diagnose_1: ['diagnose'], vorsorgeziel: ['vorsorgeziele', 'vorsorgeziel', 'ziele', 'ziel'], befund: ['befund', 'befunde'], beschwerden: ['beschwerden'], kurort: ['kurort'], kurort_anf_text: ['anforderungen'], wartezeit_begruendung: ['begründung'] },
  check: {
    rf_blutdruck: /\b(hypertonie|bluthochdruck|erhöhte\w* blutdruck)\b/iu, rf_bewegungsmangel: /\b(bewegungsmangel|fehlhaltung)\b/iu,
    rf_uebergewicht: /\b(übergewicht\w*|adipositas|fehlernährung)\b/iu, rf_stress: /\bstress\w*/iu, rf_rauchen: /\b(raucher\w*|rauchen|nikotin\w*)\b/iu,
    m_krankengymnastik: /\b(krankengymnastik|physiotherapie)\b/iu, m_psychotherapie: /\bpsychotherap\w*/iu, m_physik: /\b(physikalische\w* therapie|fango|massage\w*)\b/iu,
    m_patientenschulung: /\b(patientenschulung|schulung)\b/iu, m_rehasport: /\b(rehasport|funktionstraining)\b/iu, m_ergotherapie: /\bergotherap\w*/iu, m_selbsthilfe: /\bselbsthilfe\w*/iu,
    kompaktkur_ja: /\bkompaktkur\b/iu,
  },
  oneOf: [{ ids: ['art_schwaechung', 'art_verschlimmerung', 'art_kinder'], text: 'Art der Vorsorge ankreuzen (Schwächung der Gesundheit, Vermeidung der Verschlimmerung oder Entwicklung von Kindern).' }],
  propose: (text: string, facts: PatientFacts) => {
    const f = form();
    const out: FieldProposal[] = [];
    const art = facts.kindAlter
      ? ['art_kinder', facts.kindAlter.evidence, 'Gefährdung der gesundheitlichen Entwicklung eines Kindes.'] as const
      : cue(/\b(verschlimmerung|chronisch\w*|rezidiv\w*)\b/iu, text) ? ['art_verschlimmerung', cue(/\b(verschlimmerung|chronisch\w*|rezidiv\w*)\b/iu, text), 'Zur Vermeidung der Verschlimmerung einer behandlungsbedürftigen Krankheit.'] as const
        : cue(/\b(erschöpf\w*|schwächung|krankheitsverhütung|prävention)\b/iu, text) ? ['art_schwaechung', cue(/\b(erschöpf\w*|schwächung|krankheitsverhütung|prävention)\b/iu, text), 'Bei Schwächung der Gesundheit bzw. zur Krankheitsverhütung.'] as const : null;
    if (art) out.push(prop(f, art[0], 'vorgeschlagen', true, art[2], art[1], 'm25.rueckseite'));
    const befunde = cue(/\b(befunde? liegen nicht vor|keine befunde)\b/iu, text);
    out.push(befunde ? prop(f, 'befunde_nicht_vorhanden', 'vorgeschlagen', true, 'Befunde liegen nicht vor.', befunde, 'm25.befunde') : prop(f, 'befunde_mdk', 'vorgeschlagen', true, 'Befunde können bei Bedarf durch den MD angefordert werden.', null, 'm25.befunde'));
    const anf = cue(/\b(allergenarm\w*|seeklima|hochgebirge|barrierefrei\w*|reizklima)\b/iu, text);
    out.push(anf ? prop(f, 'kurort_anf_ja', 'vorgeschlagen', true, 'Besondere Anforderungen an den Kurort.', anf, 'm25.kurort') : prop(f, 'kurort_anf_nein', 'vorgeschlagen', true, 'Keine besonderen Anforderungen an den Kurort genannt.', null, 'm25.kurort'));
    if (anf) out.push(prop(f, 'kurort_anf_nein', 'leer', false, 'Besondere Anforderungen genannt.', null, 'm25.kurort'), prop(f, 'kurort_anf_text', 'arzt', anf, 'Anforderung aus der Beschreibung – bitte ergänzen.', anf, 'm25.kurort'));
    const kompakt = cue(/\bkompaktkur\b/iu, text);
    out.push(prop(f, kompakt ? 'kompaktkur_ja' : 'kompaktkur_nein', 'vorgeschlagen', true, kompakt ? 'Kompaktkur angeregt.' : 'Keine Kompaktkur angeregt.', kompakt, 'm25.kompaktkur'));
    return out;
  },
  extra: (v: FormValues, facts: PatientFacts) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const on = (id: string) => isChecked(v, id);
    if (on('art_kinder') && !facts.kindAlter) add('hinweis', '„Gefährdung der gesundheitlichen Entwicklung von Kindern“ nur bei Kindern.', ['art_kinder'], 'm25.rueckseite');
    for (const i of DX) {
      const dx = textOf(v, `diagnose_${i}`);
      if (dx && icdCodes(dx).length) add('hinweis', `Diagnose ${i}: in Klarschrift angeben, nicht als ICD-Kode.`, [`diagnose_${i}`], 'm25.diagnose_klartext');
      const u = textOf(v, `ursache_${i}`);
      if (u && !(Number(u) >= 1 && Number(u) <= URSACHE_MAX)) add('unzulaessig', `Diagnose ${i}: Ursache als Kennziffer 1 (Unfallfolgen), 2 (Berufskrankheit) oder 3 (Schäden nach BVG/SER).`, [`ursache_${i}`], 'm25.ursache_ser');
      const vl = textOf(v, `verlauf_${i}`);
      if (vl && !(Number(vl) >= 1 && Number(vl) <= VERLAUF_MAX)) add('unzulaessig', `Diagnose ${i}: Verlauf als Kennziffer 1, 2 oder 3.`, [`verlauf_${i}`], 'm25.diagnose_klartext');
      if (!dx && (u || vl || textOf(v, `seit_${i}`))) add('fehlt', `Diagnose ${i}: Angaben zu Ursache/Verlauf ohne Diagnose.`, [`diagnose_${i}`], 'm25.diagnose_klartext');
    }
    const b = ['befunde_mdk', 'befunde_nicht_vorhanden'].filter(on);
    if (b.length !== 1) add(b.length ? 'unzulaessig' : 'fehlt', 'Befunde: entweder „können durch den MD angefordert werden“ oder „liegen nicht vor“.', ['befunde_mdk', 'befunde_nicht_vorhanden'], 'm25.befunde');
    if (on('rf_sonstige') && !textOf(v, 'rf_sonstige_text')) add('fehlt', 'Sonstige Risikofaktoren im Klartext angeben.', ['rf_sonstige_text'], 'm25.risikofaktoren');
    if (on('beschwerden_cb') && !textOf(v, 'beschwerden')) add('fehlt', 'Aktuelle Beschwerden im Klartext angeben.', ['beschwerden'], 'm25.risikofaktoren');
    if (on('m_sonstige') && !textOf(v, 'm_sonstige_text')) add('fehlt', 'Sonstige Maßnahmen im Klartext angeben.', ['m_sonstige_text'], 'm25.massnahmen');
    if (on('kurort_anf_ja') && !textOf(v, 'kurort_anf_text')) add('fehlt', 'Besondere Anforderungen an den Kurort benennen.', ['kurort_anf_text'], 'm25.kurort');
    if (textOf(v, 'kurort')) add('hinweis', 'Der vorgeschlagene Kurort bindet die Krankenkasse nicht.', ['kurort'], 'm25.kurort');
    if (textOf(v, 'wartezeit_begruendung') && !uni(/\b(schub|verschlimmer\w*|akut\w*|dringend\w*|andere krankheit)\b/iu).test(textOf(v, 'wartezeit_begruendung'))) add('hinweis', 'Vorsorge vor Ablauf von 3 Jahren nur bei medizinisch dringender Erforderlichkeit (z. B. akuter Schub) – Begründung prüfen.', ['wartezeit_begruendung'], 'm25.wartezeit');
    return out;
  },
};
