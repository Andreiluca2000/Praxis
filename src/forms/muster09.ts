import { checkbox, formatIssues, isChecked, issue, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { personalien, stempel } from './common.js';
import { cue, fromTTMMJJ, toTTMMJJ, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 9 – Bescheinigung einer Fehlgeburt, Frühgeburt oder Behinderung des Kindes (Stand 1.2026).
 * Erläuterungen 01/2026, S. 33–35. Grundlage für das Mutterschaftsgeld; die Rückseite füllt die Versicherte aus.
 */
const form = getForm('muster-09');
const SSW_MIN = 13;
const GRENZE_GRAMM = 2500;
const FRIST_TAGE = 56;
const SSW_FELDER: readonly [number, string][] = [[20, 'ssw_20'], [17, 'ssw_17'], [13, 'ssw_13']];
const RUECKSEITE = ['v_name', 'v_vorname', 'v_geburtsdatum', 'v_versichertennummer', 'v_iban', 'v_bic', 'v_kontoinhaber', 'beschaeftigt', 'v_arbeitgeber',
  'v_gekuendigt_befristet', 'v_arbeitgeber_anschrift', 'arbeitslos', 'selbstaendig', 'kuenstlerin', 'v_datum', 'v_unterschrift'] as const;

/** Erstes Datum direkt hinter einem der Stichwörter („Frühgeburt, geboren am 15.10.2026“ → 151026). */
function dateNear(keyword: RegExp, text: string): { value: string | null; evidence: string } | null {
  const m = uni(new RegExp(String.raw`${keyword.source}[,:]?\s*(?:am|vom)?\s*(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b`, 'iu')).exec(text);
  return m ? { value: toTTMMJJ(m[1]!, m[2]!, m[3]!), evidence: m[0] } : null;
}

function gramm(text: string): { value: number; evidence: string } | null {
  const m = uni(/\b(\d{3,4}|\d[.,]\d{1,3})\s*(g|gramm|kg)\b/iu).exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(',', '.'));
  return { value: /kg/iu.test(m[2]!) || n < 10 ? Math.round(n * 1000) : n, evidence: m[0] };
}

function fehlgeburt(text: string, facts: PatientFacts): FieldProposal[] {
  const ev = cue(/\b(fehlgeburt\w*|abort\w*|missed abortion|totgeburt\w*)\b/iu, text);
  const am = dateNear(/\b(?:fehlgeburt|abort|ausräumung|kürettage|abrasio)\w*/iu, text);
  const ssw = facts.ssw;
  const box = ssw && ev ? SSW_FELDER.find(([n]) => ssw.value >= n)?.[1] ?? null : null;
  const missed = cue(/\b(missed abortion|verhaltene\w* fehlgeburt)\b/iu, text);
  return [
    !ev ? prop(form, 'fehlgeburt_am', 'leer', null, 'Nur bei Fehlgeburt ab der 13. SSW.')
      : am?.value ? prop(form, 'fehlgeburt_am', 'vorgeschlagen', am.value, missed ? 'Missed Abortion: maßgeblich ist der Tag der tatsächlichen Trennung vom Uterus, nicht das Diagnosedatum – bitte prüfen.' : 'Tag der Fehlgeburt.', am.evidence)
        : prop(form, 'fehlgeburt_am', 'unbekannt', null, missed ? 'Tag der tatsächlichen Trennung vom Uterus eintragen (nicht das Diagnosedatum).' : 'Datum der Fehlgeburt eintragen (TTMMJJ).', ev),
    ...SSW_FELDER.map(([n, id]) => (box === id
      ? prop(form, id, 'vorgeschlagen', true, `Mindestens ${n}. SSW (post menstruationem).`, ssw!.evidence)
      : prop(form, id, ev && !ssw ? 'unbekannt' : 'leer', ev && !ssw ? null : false, ev && !ssw ? 'In welcher SSW befand sich die Versicherte mindestens? Nur eines ankreuzen.' : 'Nicht zutreffend.', null, 'm09.ssw'))),
  ];
}

function fruehgeburt(text: string): FieldProposal[] {
  const ev = cue(/\b(frühgeburt\w*|frühgeboren\w*|frühchen)\b/iu, text);
  const am = dateNear(/\b(?:frühgeburt|frühgeboren|geboren|entbindung|entbunden|geburt)\w*/iu, text);
  const g = gramm(text);
  const pflege = cue(/\b(erweiterte\w* pflegebedarf|wesentlich erweiterte\w* pflege\w*|unreif\w*|reifezeichen)\b/iu, text);
  return [
    !ev ? prop(form, 'fruehgeburt_am', 'leer', null, 'Nur bei Frühgeburt.')
      : am?.value ? prop(form, 'fruehgeburt_am', 'vorgeschlagen', am.value, 'Geburtsdatum des Kindes.', am.evidence)
        : prop(form, 'fruehgeburt_am', 'unbekannt', null, 'Geburtsdatum des Kindes eintragen (TTMMJJ).', ev),
    ev && g && g.value < GRENZE_GRAMM ? prop(form, 'gewicht_unter', 'vorgeschlagen', true, `Geburtsgewicht ${g.value} g – unter 2.500 Gramm.`, g.evidence)
      : prop(form, 'gewicht_unter', ev && !g ? 'unbekannt' : 'leer', ev && !g ? null : false, ev && !g ? 'Geburtsgewicht unter 2.500 g? Gewicht nicht genannt.' : 'Nicht zutreffend.', null, 'm09.gewicht_unter'),
    ev && g && g.value >= GRENZE_GRAMM && pflege ? prop(form, 'pflegebedarf', 'vorgeschlagen', true, 'Ab 2.500 g, aber wesentlich erweiterter Pflegebedarf.', pflege)
      : prop(form, 'pflegebedarf', ev && g && g.value >= GRENZE_GRAMM ? 'unbekannt' : 'leer', ev && g && g.value >= GRENZE_GRAMM ? null : false,
        ev && g && g.value >= GRENZE_GRAMM ? 'Ab 2.500 g nur Frühgeburt bei wesentlich erweitertem Pflegebedarf – der Arzt entscheidet.' : 'Nicht zutreffend.', null, 'm09.pflegebedarf'),
  ];
}

export function proposeMuster09(text: string, facts: PatientFacts): FormProposal {
  const behinderung = cue(/\b(behinderung des kindes|kind (?:mit|hat eine) behinderung|trisomie\s*21|down-?syndrom|spina bifida)\b/iu, text);
  const fields: FieldProposal[] = [
    personalien(form),
    ...fehlgeburt(text, facts),
    ...fruehgeburt(text),
    checkbox(form, 'behinderung', behinderung, 'Ärztlich festgestellte Behinderung des Kindes (§ 2 Abs. 1 Satz 1 SGB IX) – innerhalb von acht Wochen nach der Entbindung.'),
    stempel(form),
    ...RUECKSEITE.map((id) => prop(form, id, 'leer', id.startsWith('v_') ? null : false, 'Rückseite: füllt die Versicherte aus.')),
  ];
  return { formId: 'muster-09', fields, generator: 'regelbasiert' };
}

export function checkMuster09(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.mehrlinge) add(issue(form, 'unzulaessig', `Mehrlingsgeburt („${facts.mehrlinge.evidence}“): Muster 9 ist nicht auszustellen – die Kasse erhält die Information über die Geburtsurkunden.`, [], 'm09.mehrlinge'));
  const fehl = textOf(values, 'fehlgeburt_am');
  const frueh = textOf(values, 'fruehgeburt_am');
  const ssw = SSW_FELDER.filter(([, id]) => isChecked(values, id)).map(([, id]) => id);
  const behinderung = isChecked(values, 'behinderung');
  if (!fehl && !frueh && !behinderung) add(issue(form, 'fehlt', 'Fehlgeburt, Frühgeburt oder Behinderung des Kindes bescheinigen.', ['fehlgeburt_am', 'fruehgeburt_am', 'behinderung'], 'm09.zweck'));
  if (fehl && frueh) add(issue(form, 'unzulaessig', 'Entweder Fehlgeburt (1.) oder Frühgeburt (2.) bescheinigen.', ['fehlgeburt_am', 'fruehgeburt_am'], 'm09.zweck'));
  if (fehl && !ssw.length) add(issue(form, 'fehlt', `Fehlgeburt: Schwangerschaftswoche ankreuzen (ab der ${SSW_MIN}. SSW).`, SSW_FELDER.map(([, id]) => id), 'm09.ssw'));
  if (ssw.length > 1) add(issue(form, 'unzulaessig', 'Nur die höchste zutreffende Schwangerschaftswoche ankreuzen.', ssw, 'm09.ssw'));
  if (ssw.length && !fehl) add(issue(form, 'fehlt', 'Schwangerschaftswoche angekreuzt: Datum der Fehlgeburt eintragen.', ['fehlgeburt_am'], 'm09.fehlgeburt_datum'));
  if (facts.ssw && facts.ssw.value < SSW_MIN && fehl) add(issue(form, 'unzulaessig', `Fehlgeburt in der ${facts.ssw.value}. SSW: bescheinigt wird erst ab der ${SSW_MIN}. SSW.`, ['fehlgeburt_am'], 'm09.fehlgeburt_datum'));
  const art = ['gewicht_unter', 'pflegebedarf'].filter((id) => isChecked(values, id));
  if (frueh && !art.length) add(issue(form, 'fehlt', 'Frühgeburt: a) unter 2.500 g oder b) erweiterter Pflegebedarf ankreuzen.', ['gewicht_unter', 'pflegebedarf'], 'm09.fruehgeburt'));
  if (art.length > 1) add(issue(form, 'unzulaessig', 'Frühgeburt: entweder a) unter 2.500 g oder b) ab 2.500 g mit erweitertem Pflegebedarf.', art, 'm09.fruehgeburt'));
  if (art.length && !frueh) add(issue(form, 'fehlt', 'Frühgeburt: Geburtsdatum des Kindes eintragen.', ['fruehgeburt_am'], 'm09.fruehgeburt'));
  if (behinderung && validTTMMJJ(frueh)) {
    const tage = Math.floor((Date.now() - fromTTMMJJ(frueh).getTime()) / 86_400_000);
    if (tage > FRIST_TAGE) add(issue(form, 'unzulaessig', `Behinderung festgestellt ${tage} Tage nach der Entbindung: nur innerhalb von acht Wochen bescheinigen.`, ['behinderung'], 'm09.frist_8_wochen'));
  } else if (behinderung) add(issue(form, 'hinweis', 'Die Behinderung muss innerhalb von acht Wochen nach der Entbindung festgestellt sein.', ['behinderung'], 'm09.frist_8_wochen'));
  out.push(...formatIssues(form, values).filter((i) => !i.fieldIds.some((id) => (RUECKSEITE as readonly string[]).includes(id))));
  return out;
}
