import { checkbox, formatIssues, isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { diagnose, icdIssues, labeled, personalien, stempel } from './common.js';
import { cue, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/** Muster 2 – Verordnung von Krankenhausbehandlung (Stand 10.2014). Regeln: Erläuterungen Januar 2026, S. 12–15. */
const form = getForm('muster-02');

function krankenhaeuser(text: string): FieldProposal {
  const m = uni(/\b(?:einweisung|aufnahme|verlegung)\s+(?:ins|in das|in die|in den)\s+(\p{Lu}.{2,60}?)(?=\s+(?:wegen|bei|zur|zum|nach|mit|aufgrund)\b|[,;:]|\.\s|$)/iu).exec(text);
  return m
    ? prop(form, 'krankenhaeuser', 'arzt', m[1]!.trim(), 'Aus der Beschreibung – in geeigneten Fällen die zwei nächsterreichbaren geeigneten Häuser angeben.', m[0])
    : prop(form, 'krankenhaeuser', 'arzt', null, 'In geeigneten Fällen die zwei nächsterreichbaren, geeigneten Krankenhäuser angeben.');
}

export function proposeMuster02(text: string, facts: PatientFacts): FormProposal {
  const fields: FieldProposal[] = [
    personalien(form),
    checkbox(form, 'belegarzt', cue(/\bbeleg(?:arzt|ärztlich)\w*/iu, text), 'Behandlung durch einen Belegarzt.'),
    checkbox(form, 'notfall', facts.notfall?.evidence ?? null, 'Notfall – die Genehmigungspflicht der Krankenkasse entfällt.', 'm02.kennzeichen'),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Unfall bzw. Unfallfolgen (kein Arbeitsunfall) – Kasse kann Kosten bei Dritten geltend machen.', 'm02.kennzeichen'),
    checkbox(form, 'versorgungsleiden', facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER/BVG) – Nachweis des Patienten nötig.', 'm02.ser'),
    krankenhaeuser(text),
    diagnose(form, text),
    labeled(form, text, 'untersuchungsergebnisse', ['befund', 'befunde', 'untersuchungsergebnis', 'untersuchungsergebnisse', 'ekg', 'labor'], 'Relevante Untersuchungsergebnisse, soweit vorhanden.'),
    labeled(form, text, 'massnahmen', ['medikation', 'bisherige therapie', 'bisherige maßnahmen', 'therapie', 'maßnahmen'], 'Bisher erbrachte Maßnahmen, z. B. Medikation.'),
    labeled(form, text, 'fragestellung', ['fragestellung', 'allergie', 'allergien', 'hinweis', 'hinweise'], 'Fragestellung oder besondere Hinweise (z. B. Allergie, Begleitperson nach KHB-RL).'),
    labeled(form, text, 'befunde_mit', ['mitgegeben', 'mitgegebene befunde', 'anlage', 'anlagen'], 'Mitgegebene Befunde auflisten.'),
    stempel(form),
  ];
  return { formId: 'muster-02', fields, generator: 'regelbasiert' };
}

export function checkMuster02(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue) => out.push(i);
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall/Berufskrankheit („${facts.arbeitsunfall.evidence}“): stationäre Behandlung nicht zu Lasten der GKV – Durchgangsarzt koordiniert.`, [], 'm02.arbeitsunfall'));
  if (facts.reha) add(issue(form, 'unzulaessig', `„${facts.reha.evidence}“: Muster 2 gilt nicht für Vorsorge- und Rehabilitationseinrichtungen (dafür Muster 61).`, [], 'm02.reha'));
  if (facts.kosmetisch) add(issue(form, 'unzulaessig', `„${facts.kosmetisch.evidence}“: kein Anspruch bei Maßnahmen, die keine Krankheit behandeln (z. B. Schönheitsoperation).`, [], 'm02.voraussetzung'));
  if (facts.nurPflege) add(issue(form, 'unzulaessig', `„${facts.nurPflege.evidence}“: kein Anspruch bei ausschließlichem Pflegebedarf oder sozialer Indikation.`, [], 'm02.voraussetzung'));
  if (isChecked(values, 'unfall') && facts.arbeitsunfall) add(issue(form, 'unzulaessig', '„Unfall“ nur bei sonstigen Unfällen, nicht bei Arbeitsunfall oder Berufskrankheit.', ['unfall'], 'm02.kennzeichen'));
  if (isChecked(values, 'versorgungsleiden')) add(issue(form, 'hinweis', 'Versorgungsleiden nur mit vorgelegtem Nachweis der anerkannten Schädigungsfolge.', ['versorgungsleiden'], 'm02.ser'));
  if (!textOf(values, 'diagnose')) add(issue(form, 'fehlt', 'Diagnose fehlt – die Notwendigkeit der stationären Behandlung soll sich aus ihr ergeben.', ['diagnose'], 'm02.diagnose'));
  out.push(...icdIssues(form, values, ['diagnose']));
  if (!textOf(values, 'krankenhaeuser')) add(issue(form, 'hinweis', 'In geeigneten Fällen die zwei nächsterreichbaren, geeigneten Krankenhäuser angeben.', ['krankenhaeuser'], 'm02.krankenhaeuser'));
  const frage = textOf(values, 'fragestellung');
  if (uni(/\bbegleit\w*/iu).test(frage) && !uni(/\b(fallgruppe|kriterium|bescheinigung)\b/iu).test(frage)) {
    add(issue(form, 'fehlt', 'Begleitperson: mindestens ein medizinisches Kriterium der KHB-RL (Fallgruppe 1–3) oder Hinweis auf eine gültige Bescheinigung angeben.', ['fragestellung'], 'm02.khb'));
  }
  add(issue(form, 'hinweis', 'Vorher prüfen: reicht ambulante Behandlung einschließlich häuslicher Krankenpflege? Krankenhauseinweisungs-Richtlinie beachten.', [], 'm02.ambulant_vorrang'));
  if (!isChecked(values, 'notfall')) add(issue(form, 'hinweis', 'Ausfertigung 2a legt der Patient vor Aufsuchen des Krankenhauses der Krankenkasse vor; 2b geht ins Krankenhaus, 2c bleibt in der Praxis.', [], 'm02.ausfertigungen'));
  out.push(...formatIssues(form, values));
  return out;
}
