import { checkbox, formatIssues, isChecked, issue, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { personalien, stempel } from './common.js';
import { cue, fromTTMMJJ, periodIn } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 21 – Ärztliche Bescheinigung für den Bezug von Krankengeld bei Erkrankung eines Kindes (Stand 7.2024).
 * Erläuterungen 01/2026, S. 66–67. Eine Diagnose steht auf diesem Vordruck nicht.
 */
const form = getForm('muster-21');

export function proposeMuster21(text: string, facts: PatientFacts, today: Date): FormProposal {
  const zr = periodIn(text, today);
  const ev = zr.evidence.join(', ') || null;
  const kita = facts.kitaUnfall;
  const sonst = kita ? null : facts.unfall;
  const begleitung = cue(/\b(ambulante?n?\s+op\w*|vorstationär\w*|nachstationär\w*|begleitung zur behandlung)\b/iu, text);
  const fields: FieldProposal[] = [
    kita
      ? prop(form, 'personalien', 'duria', 'aus DURIA', `Kita- oder Schulunfall („${kita.evidence}“): im Personalienfeld den Unfallversicherungsträger angeben, nicht die Krankenkasse.`, kita.evidence, 'm21.kita_schulunfall')
      : prop(form, 'personalien', 'duria', 'aus DURIA', 'Personalien des Kindes (Krankenkasse des Kindes) über DURIA; Name und Anschrift sind in diesem Fenster nicht vorhanden.'),
    zr.vom ? prop(form, 'vom', 'vorgeschlagen', zr.vom, 'Beginn der Beaufsichtigung, Betreuung oder Pflege.', ev)
      : prop(form, 'vom', 'unbekannt', null, 'Ab wann braucht das Kind Betreuung? Datum nicht in der Beschreibung.'),
    zr.bis ? prop(form, 'bis', 'vorgeschlagen', zr.bis, 'Letzter Tag der Betreuung (einschließlich).', ev)
      : prop(form, 'bis', 'unbekannt', null, 'Bis wann (einschließlich)? Datum nicht in der Beschreibung.'),
    checkbox(form, 'kita_unfall', kita?.evidence ?? null, 'Unfall in Kita oder Schule bzw. auf dem Weg – zu Lasten des Unfallversicherungsträgers.'),
    checkbox(form, 'sonstiger_unfall', sonst?.evidence ?? null, 'Sonstiger Unfall bzw. Unfallfolge (kein Kita- oder Schulunfall).'),
    checkbox(form, 'ser', facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER).'),
    begleitung
      ? prop(form, 'stempel', 'arzt', null, `Begleitung zur Behandlung („${begleitung}“) kann Muster 21 begründen. Stempel und Unterschrift nach vollständigem Ausfüllen.`, begleitung, 'm21.begleitung_behandlung')
      : stempel(form),
    prop(form, 'antrag', 'leer', null, 'Füllt die betreuende Person aus und reicht ihn bei ihrer Krankenkasse ein.'),
  ];
  return { formId: 'muster-21', fields, generator: 'regelbasiert' };
}

export function checkMuster21(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.mitaufnahme) {
    add(issue(form, 'unzulaessig', `Mitaufnahme als Begleitperson bei stationärer Behandlung („${facts.mitaufnahme.evidence}“): kein Muster 21 – die Bescheinigung stellt das Krankenhaus aus.`, [], 'm21.mitaufnahme'));
  }
  const alter = facts.kindAlter;
  if (alter && alter.value >= 12 && !facts.kindBehindert) {
    add(issue(form, 'unzulaessig', `Kind ${alter.value} Jahre („${alter.evidence}“): Muster 21 nur für Kinder unter 12 Jahren oder für behinderte, auf Hilfe angewiesene Kinder.`, [], 'm21.voraussetzung'));
  } else if (!alter && !facts.kindBehindert) {
    add(issue(form, 'hinweis', 'Alter des Kindes prüfen: unter 12 Jahren (oder Kind mit Behinderung, auf Hilfe angewiesen).', [], 'm21.voraussetzung'));
  }
  const vom = textOf(values, 'vom');
  const bis = textOf(values, 'bis');
  if (!vom || !bis) add(issue(form, 'fehlt', 'Zeitraum „vom“ und „bis einschließlich“ eintragen.', ['vom', 'bis'].filter((id) => !textOf(values, id)), 'm21.zeitraum'));
  if (validTTMMJJ(vom) && validTTMMJJ(bis) && fromTTMMJJ(bis) < fromTTMMJJ(vom)) add(issue(form, 'unzulaessig', '„bis einschließlich“ liegt vor „vom“.', ['vom', 'bis'], 'm21.zeitraum'));
  if (isChecked(values, 'kita_unfall') && isChecked(values, 'sonstiger_unfall')) {
    add(issue(form, 'unzulaessig', 'Entweder Kita- oder Schulunfall oder sonstiger Unfall – nicht beides.', ['kita_unfall', 'sonstiger_unfall'], 'm21.sonstiger_unfall'));
  }
  if (isChecked(values, 'kita_unfall')) add(issue(form, 'hinweis', 'Kita- oder Schulunfall: im Personalienfeld den Unfallversicherungsträger angeben.', ['personalien'], 'm21.kita_schulunfall'));
  out.push(...formatIssues(form, values));
  return out;
}
