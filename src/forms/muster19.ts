import { checkbox, exactlyOne, formatIssues, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { diagnose, icdIssues, labeled, personalien, stempel } from './common.js';
import { cue, quarterQJJ } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 19 – Notfall-/Vertretungsschein (Stand 10.2014). Erläuterungen 01/2026, S. 63; Aufdrucke der Mustersammlung.
 * Die Abrechnung (Tag, Monat, Gebührenordnungspositionen) schlägt die Formularhilfe nicht vor.
 */
const form = getForm('muster-19');

function art(text: string, facts: PatientFacts): FieldProposal[] {
  const dienst = cue(/\b(notfalldienst\w*|bereitschaftsdienst\w*|notdienst\w*|116\s*117)\b/iu, text);
  if (dienst) return pickOne(form, 'art', 'notfalldienst', 'Behandlung im ärztlichen Notfall- bzw. Bereitschaftsdienst.', dienst);
  const vertretung = cue(/\b(urlaubsvertretung|krankheitsvertretung|vertretung\w*|vertretungsweise)\b/iu, text);
  if (vertretung) return pickOne(form, 'art', 'vertretung', 'Behandlung als Urlaubs- bzw. Krankheitsvertretung.', vertretung);
  if (facts.notfall) return pickOne(form, 'art', 'notfall', 'Notfallbehandlung.', facts.notfall.evidence);
  return pickOne(form, 'art', null, 'Notfalldienst, Vertretung oder Notfall? Nicht aus der Beschreibung erkennbar.', null);
}

export function proposeMuster19(text: string, facts: PatientFacts, today: Date): FormProposal {
  const weiter = cue(/\b(hausarzt|hausärztin|weiterbehandelnde\w*\s+(?:arzt|ärztin|praxis)|mitteilung an)\b/iu, text);
  const fields: FieldProposal[] = [
    personalien(form),
    ...art(text, facts),
    prop(form, 'quartal', 'vorgeschlagen', quarterQJJ(today), 'Quartal der Behandlung (heute).'),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Behandlung wegen oder als Folge eines Unfalls.'),
    prop(form, 'geschlecht', 'duria', 'aus DURIA', 'Wird von der eGK gelesen.'),
    diagnose(form, text, 'diagnosen'),
    facts.auBis?.value ? prop(form, 'au_bis', 'vorgeschlagen', facts.auBis.value, 'Arbeitsunfähigkeit wurde bis zu diesem Tag bescheinigt.', facts.auBis.evidence)
      : facts.auBis ? prop(form, 'au_bis', 'unbekannt', null, 'AU erwähnt – Enddatum eintragen.', facts.auBis.evidence)
        : prop(form, 'au_bis', 'leer', null, 'Nur wenn Arbeitsunfähigkeit bescheinigt wurde.'),
    labeled(form, text, 'befunde', ['befund', 'befunde', 'therapie', 'medikation', 'maßnahmen'], 'Befunde und Therapie für den weiterbehandelnden Arzt (auf Teil b).'),
    weiter ? prop(form, 'weiterbehandelnder_arzt', 'unbekannt', null, 'Teil b geht an den weiterbehandelnden Arzt – Name bzw. Praxis eintragen.', weiter)
      : prop(form, 'weiterbehandelnder_arzt', 'leer', null, 'Nur wenn Teil b an einen weiterbehandelnden Arzt geht; sonst (oder bei Arztbrief) kann 19b entfallen.', null, 'm19.teil_b_entfaellt'),
    prop(form, 'leistungen', 'leer', null, 'Tag, Monat und Gebührenordnungspositionen trägt die Praxis über das PVS ein – die Formularhilfe schlägt keine Abrechnungsziffern vor.'),
    prop(form, 'versichert', 'leer', null, 'Bestätigt die/der Versicherte mit Datum und Unterschrift.'),
    stempel(form),
  ];
  return { formId: 'muster-19', fields, generator: 'regelbasiert' };
}

export function checkMuster19(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall, Berufskrankheit oder Schülerunfall („${facts.arbeitsunfall.evidence}“): Muster 19 ist nicht zu verwenden.`, [], 'm19.arbeitsunfall'));
  add(exactlyOne(form, values, 'art', 'm19.art'));
  if (!textOf(values, 'quartal')) add(issue(form, 'fehlt', 'Quartal (QJJ) eintragen.', ['quartal'], 'm19.quartal'));
  if (!textOf(values, 'diagnosen')) add(issue(form, 'fehlt', 'Diagnose(n) bzw. Abrechnungsbegründung eintragen.', ['diagnosen'], 'm19.diagnosen'));
  out.push(...icdIssues(form, values, ['diagnosen']));
  if (textOf(values, 'weiterbehandelnder_arzt') && !textOf(values, 'befunde')) add(issue(form, 'fehlt', 'Teil b geht an den weiterbehandelnden Arzt: Befunde/Therapie eintragen.', ['befunde'], 'm19.befunde'));
  out.push(...formatIssues(form, values));
  return out;
}
