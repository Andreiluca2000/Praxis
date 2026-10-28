import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { diagnose, icdIssues, labeled, personalien, stempel } from './common.js';
import { cue, fromTTMMJJ, periodIn } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 63 – Verordnung spezialisierter ambulanter Palliativversorgung (SAPV, Stand 10.2014).
 * Erläuterungen 01/2026, S. 131–132; SAPV-Richtlinie des G-BA (§ 4 komplexes Symptomgeschehen).
 */
const form = getForm('muster-63');

/** Komplexes Symptomgeschehen: Feld → Stichwörter in der Beschreibung. */
const SYMPTOME: readonly [string, RegExp][] = [
  ['schmerz', /\b(\w*schmerz\w*|tumorschmerz\w*|durchbruchschmerz\w*)/iu],
  ['urogenital', /\b(harnverhalt\w*|urogenital\w*|hämaturie|blasentamponade|harnaufstau\w*)\b/iu],
  ['respiratorisch', /\b(ruhedyspnoe|dyspnoe|atemnot|luftnot|erstickung\w*|rasselatmung|kardial\w*|herzinsuffizienz)\b/iu],
  ['gastro', /\b(erbrechen|übelkeit|ileus|durchf[aä]ll\w*|diarrh\w*|obstipation|gastrointestinal\w*)\b/iu],
  ['ulzerierend', /\b(exulzer\w*|ulzer\w*|tumorwunde\w*|fistel\w*|wunde\w*)\b/iu],
  ['neuro', /\b(delir\w*|terminale\w* unruhe|unruhe|angst\w*|krampfanf\w*|epilep\w*|neurologisch\w*|psychiatrisch\w*|psychisch\w*|verwirrt\w*)\b/iu],
];

function symptome(text: string): FieldProposal[] {
  const found = SYMPTOME.map(([id, re]) => [id, cue(re, text)] as const);
  const any = found.some(([, ev]) => ev);
  return [
    ...found.map(([id, ev]) => (ev
      ? prop(form, id, 'vorgeschlagen', true, 'Komplexes Symptomgeschehen aus der Beschreibung – der Arzt bestätigt.', ev)
      : prop(form, id, any ? 'leer' : 'unbekannt', any ? false : null, any ? 'Nicht genannt.' : 'Welches komplexe Symptomgeschehen liegt vor? Mindestens eines ankreuzen.'))),
    prop(form, 'sonstiges', 'leer', false, 'Nur bei sonstigem komplexem Symptomgeschehen – dann näher beschreiben.'),
  ];
}

function massnahmen(text: string): FieldProposal[] {
  const beratung = cue(/\b(beratung\w*|anleitung\w*)\b/iu, text);
  const wer: [string, RegExp, string][] = [
    ['beratung_arzt', /\b(hausarzt\w*|behandelnde\w* arzt\w*|ärztin)\b/iu, 'Beratung des behandelnden Arztes.'],
    ['beratung_pflege', /\b(pflegedienst\w*|pflegefachkraft\w*|pflegekr[aä]ft\w*)\b/iu, 'Beratung der behandelnden Pflegefachkraft.'],
    ['beratung_patient', /\b(angehörig\w*|familie|ehefrau|ehemann|tochter|sohn|patient\w*)\b/iu, 'Beratung des Patienten bzw. der Angehörigen.'],
  ];
  const teil = cue(/\b(teilversorgung|additiv\w*)\b/iu, text);
  const voll = cue(/\b(vollversorgung|vollständige\w* versorgung)\b/iu, text);
  return [
    checkbox(form, 'beratung', beratung, 'Beratung als SAPV-Leistung.'),
    ...wer.map(([id, re, why]) => (beratung ? checkbox(form, id, cue(re, text), why) : prop(form, id, 'leer', false, 'Nur zusammen mit „Beratung“.'))),
    checkbox(form, 'koordination', cue(/\b(koordination\w*|koordinier\w*)\b/iu, text), 'Koordination der Palliativversorgung.'),
    checkbox(form, 'teilversorgung', voll ? null : teil, 'Additiv unterstützende Teilversorgung.'),
    checkbox(form, 'vollversorgung', voll, 'Vollständige Versorgung.'),
  ];
}

export function proposeMuster63(text: string, facts: PatientFacts, today: Date): FormProposal {
  const zr = periodIn(text, today);
  const ev = zr.evidence.join(', ') || null;
  const folge = cue(/\b(folgeverordnung|weiterverordnung|verlängerung)\b/iu, text);
  const erst = cue(/\b(erstverordnung|erstmals|neu)\b/iu, text);
  const fields: FieldProposal[] = [
    personalien(form),
    ...(folge ? pickOne(form, 'verordnung', 'folge', 'Folgeverordnung.', folge)
      : erst ? pickOne(form, 'verordnung', 'erst', 'Erstverordnung.', erst)
        : pickOne(form, 'verordnung', null, 'Erst- oder Folgeverordnung? Nicht aus der Beschreibung erkennbar.', null)),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Versorgung wegen oder als Folge eines Unfalls.'),
    zr.vom ? prop(form, 'vom', 'vorgeschlagen', zr.vom, 'Beginn des Verordnungszeitraums.', ev) : prop(form, 'vom', 'unbekannt', null, 'Verordnungszeitraum: Beginn angeben.'),
    zr.bis ? prop(form, 'bis', 'vorgeschlagen', zr.bis, 'Ende des Verordnungszeitraums.', ev) : prop(form, 'bis', 'unbekannt', null, 'Verordnungszeitraum: Ende angeben.'),
    diagnose(form, text, 'diagnosen'),
    ...symptome(text),
    labeled(form, text, 'beschreibung', ['beschreibung', 'begründung', 'symptome', 'versorgungsbedarf'], 'Krankheitsbild und besonderen Versorgungsbedarf beschreiben (z. B. therapierefraktäre Schmerzen, Ruhedyspnoe).'),
    labeled(form, text, 'medikation', ['medikation', 'medikamente'], 'Aktuelle Medikation einschließlich Betäubungsmitteln eintragen.'),
    ...massnahmen(text),
    labeled(form, text, 'ausrichtung', ['ausrichtung', 'inhalt'], 'Inhaltliche Ausrichtung (Gegenstand, Häufigkeit) – bei Bedarf.'),
    labeled(form, text, 'naehere_angaben', ['maßnahmen', 'sapv'], 'Nähere Angaben zu den notwendigen SAPV-Maßnahmen – bei Bedarf.'),
    stempel(form),
  ];
  return { formId: 'muster-63', fields, generator: 'regelbasiert' };
}

export function checkMuster63(values: FormValues, _facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  add(exactlyOne(form, values, 'verordnung', 'm63.erst_folge'));
  const vom = textOf(values, 'vom');
  const bis = textOf(values, 'bis');
  if (!vom || !bis) add(issue(form, 'fehlt', 'Verordnungszeitraum (vom – bis) angeben.', ['vom', 'bis'].filter((id) => !textOf(values, id)), 'm63.angaben'));
  if (validTTMMJJ(vom) && validTTMMJJ(bis) && fromTTMMJJ(bis) < fromTTMMJJ(vom)) add(issue(form, 'unzulaessig', '„bis“ liegt vor „vom“.', ['vom', 'bis'], 'm63.angaben'));
  if (!textOf(values, 'diagnosen')) add(issue(form, 'fehlt', 'Verordnungsrelevante Diagnose(n) angeben (ICD-10; ggf. Organmanifestationen).', ['diagnosen'], 'm63.angaben'));
  out.push(...icdIssues(form, values, ['diagnosen']));
  const symptomIds = form.fields.filter((f) => f.group === 'symptome').map((f) => f.id);
  if (!symptomIds.some((id) => isChecked(values, id))) add(issue(form, 'fehlt', 'Mindestens ein komplexes Symptomgeschehen ankreuzen (§ 4 SAPV-RL).', symptomIds, 'm63.voraussetzung'));
  if (!textOf(values, 'beschreibung')) add(issue(form, 'fehlt', 'Komplexes Symptomgeschehen und besonderen Versorgungsbedarf näher beschreiben.', ['beschreibung'], 'm63.voraussetzung'));
  if (isChecked(values, 'sonstiges') && !textOf(values, 'beschreibung')) add(issue(form, 'fehlt', '„sonstiges komplexes Symptomgeschehen“: in der Beschreibung erläutern.', ['beschreibung'], 'm63.voraussetzung'));
  if (!textOf(values, 'medikation')) add(issue(form, 'fehlt', 'Aktuelle Medikation (einschließlich BtM) angeben.', ['medikation'], 'm63.angaben'));
  const mass = ['beratung', 'koordination', 'teilversorgung', 'vollversorgung'];
  if (!mass.some((id) => isChecked(values, id))) add(issue(form, 'fehlt', 'Notwendige Maßnahmen ankreuzen: Beratung, Koordination, additive Teilversorgung oder vollständige Versorgung.', mass, 'm63.angaben'));
  if (isChecked(values, 'teilversorgung') && isChecked(values, 'vollversorgung')) add(issue(form, 'unzulaessig', 'Entweder additiv unterstützende Teilversorgung oder vollständige Versorgung.', ['teilversorgung', 'vollversorgung'], 'm63.angaben'));
  const wer = ['beratung_arzt', 'beratung_pflege', 'beratung_patient'];
  if (isChecked(values, 'beratung') && !wer.some((id) => isChecked(values, id))) add(issue(form, 'fehlt', 'Beratung: angeben, wer beraten wird (a., b. oder c.).', wer, 'm63.angaben'));
  if (!isChecked(values, 'beratung') && wer.some((id) => isChecked(values, id))) add(issue(form, 'hinweis', 'a.–c. gehören zu „Beratung“ – dort ankreuzen.', ['beratung'], 'm63.angaben'));
  add(issue(form, 'hinweis', 'Die Kasse übernimmt die Kosten bis zur Entscheidung, wenn die Verordnung spätestens am dritten folgenden Arbeitstag vorliegt.', [], 'm63.kostenuebernahme_frist'));
  out.push(...formatIssues(form, values));
  return out;
}
