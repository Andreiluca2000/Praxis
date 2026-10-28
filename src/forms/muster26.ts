import { exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { icdIssues, personalien, stempel } from './common.js';
import { cue, icdCodes, labeledSegments, segment, toTTMMJJ, ttmmjj, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 26 – Verordnung Soziotherapie gemäß § 37a SGB V (Stand 10.2017). Erläuterungen 01/2026, S. 71–74;
 * Soziotherapie-Richtlinie (ST-RL) des G-BA. Maßgeblich ist die Fähigkeitsstörung (GAF-Skala).
 */
const form = getForm('muster-26');
const MAX_EINHEITEN = 30;
const GAF_MAX = 50;
const GAF_SCHWER = 40;

function gafIn(text: string): { value: string; evidence: string } | null {
  const m = uni(/\bGAF\b(?:-?(?:wert|skala))?\s*(?:von|=|:)?\s*(\d{1,3})\b/iu).exec(text);
  return m ? { value: m[1]!, evidence: m[0] } : null;
}

function einheiten(text: string, re: RegExp): { value: string; evidence: string } | null {
  const m = uni(re).exec(text);
  return m ? { value: m[1]!, evidence: m[0] } : null;
}

function krankenhaus(text: string): FieldProposal[] {
  const verkuerzt = cue(/\b(verkürz\w*|frühere\w* entlassung|nach (?:der )?entlassung)\b/iu, text);
  if (verkuerzt) return pickOne(form, 'krankenhaus', 'kh_verkuerzt', 'Krankenhausbehandlung wird verkürzt.', verkuerzt);
  const nicht = cue(/\b(nicht ausführbar|lehnt (?:eine\w* )?(?:stationäre\w* )?(?:behandlung|aufnahme) ab|stationär nicht möglich)\b/iu, text);
  if (nicht) return pickOne(form, 'krankenhaus', 'kh_nicht_ausfuehrbar', 'Krankenhausbehandlung geboten, aber nicht ausführbar.', nicht);
  const vermieden = cue(/\b(vermeid\w*|vermieden|statt (?:einer\w* )?(?:stationären|klinik)\w*)\b/iu, text);
  if (vermieden) return pickOne(form, 'krankenhaus', 'kh_vermieden', 'Krankenhausbehandlung wird vermieden.', vermieden);
  return pickOne(form, 'krankenhaus', null, 'Soziotherapie nur, wenn Krankenhausbehandlung vermieden oder verkürzt wird bzw. nicht ausführbar ist – der Arzt kreuzt an.', null);
}

function betreuer(text: string): FieldProposal[] {
  const nein = cue(/\b(kein\w* (?:gesetzliche\w* )?betreuer\w*|keine betreuung)\b/iu, text);
  if (nein) return [...pickOne(form, 'betreuer', 'betreuer_nein', 'Kein gesetzlicher Betreuer bestellt.', nein), prop(form, 'betreuer_angelegenheiten', 'leer', null, 'Nur bei bestelltem Betreuer.'), prop(form, 'betreuer_kontakt', 'leer', null, 'Nur bei bestelltem Betreuer.')];
  const ja = cue(/\b(gesetzliche\w* betreuer\w*|betreuung (?:ist )?eingerichtet|betreuerin|betreuer)\b/iu, text);
  if (ja) {
    const was = segment(labeledSegments(text), 'betreuer');
    return [...pickOne(form, 'betreuer', 'betreuer_ja', 'Gesetzlicher Betreuer bestellt.', ja),
      was ? prop(form, 'betreuer_angelegenheiten', 'vorgeschlagen', was, 'Betreuungsangelegenheiten aus der Beschreibung.', was) : prop(form, 'betreuer_angelegenheiten', 'unbekannt', null, 'Für welche Angelegenheiten ist der Betreuer bestellt (soweit bekannt)?'),
      prop(form, 'betreuer_kontakt', 'unbekannt', null, 'Kontaktdaten des Betreuers eintragen (nicht in diesem Fenster).')];
  }
  return [...pickOne(form, 'betreuer', null, 'Ist ein gesetzlicher Betreuer bestellt? Nicht in der Beschreibung.', null), prop(form, 'betreuer_angelegenheiten', 'leer', null, 'Nur bei bestelltem Betreuer.'), prop(form, 'betreuer_kontakt', 'leer', null, 'Nur bei bestelltem Betreuer.')];
}

export function proposeMuster26(text: string, _facts: PatientFacts, today: Date): FormProposal {
  const seg = labeledSegments(text);
  const code = icdCodes(text).find((c) => c.certainty);
  const gaf = gafIn(text);
  const seit = uni(/\b(?:erkrankt|erkrankung|bekannt|erstdiagnose|ed)\b[^.;]{0,20}?\bseit\s+(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/iu).exec(text);
  const seitVal = seit ? toTTMMJJ(seit[1]!, seit[2]!, seit[3]!) : null;
  const beantragt = einheiten(text, /\b(\d{1,3})\s*(?:therapie)?einheiten\b|\b(?:beantragt|beantragte\w*)\D{0,20}(\d{1,3})\b/iu) ?? null;
  const gesamt = einheiten(text, /\binsgesamt\s*(\d{1,3})\s*(?:therapie)?einheiten\b/iu);
  const dauer = uni(/\b(?:für|über|dauer:?)\s*(\d{1,2}\s*(?:wochen|monate))\b/iu).exec(text);
  const bereits = cue(/\b(bereits soziotherapie|soziotherapie (?:bereits|schon) (?:erhalten|durchgeführt)|früher\w* soziotherapie)\b/iu, text);
  const keineVorher = cue(/\b(erstmals|noch keine soziotherapie|erste soziotherapie)\b/iu, text);
  const faehigkeit = segment(seg, 'fähigkeitsstörungen', 'fähigkeitsstörung');
  const comorb = segment(seg, 'co-morbiditäten', 'comorbiditäten');
  const wohnform = segment(seg, 'wohnform') ?? uni(/\b(alleinstehend in eigener wohnung|lebt allein|lebt bei (?:den )?eltern|betreutes wohnen|wohnheim|in einer einrichtung)\b/iu).exec(text)?.[0] ?? null;
  const prognose = segment(seg, 'prognose');
  const begruendung = segment(seg, 'begründung');
  const fields: FieldProposal[] = [
    personalien(form),
    code ? prop(form, 'diagnose', 'arzt', `${code.icd} ${code.certainty}`, 'Therapierelevante Diagnose – der Arzt bestätigt.', code.evidence)
      : prop(form, 'diagnose', 'unbekannt', null, 'Therapierelevante Diagnose als ICD-10-Code (vom Arzt, mit Sicherheit).'),
    gaf ? prop(form, 'gaf', 'arzt', gaf.value, 'Schweregrad laut GAF-Skala – der Arzt bestätigt.', gaf.evidence)
      : prop(form, 'gaf', 'unbekannt', null, 'GAF-Wert angeben (Soziotherapie nur bei GAF höchstens 50 bzw. 40).'),
    seitVal ? prop(form, 'seit', 'vorgeschlagen', seitVal, 'Erkrankung besteht seit.', seit![0]) : prop(form, 'seit', 'leer', null, 'Nur falls bekannt (TTMMJJ).'),
    faehigkeit ? prop(form, 'faehigkeit', 'arzt', faehigkeit, 'Fähigkeitsstörungen aus der Beschreibung – müssen zum GAF-Wert passen.', faehigkeit)
      : prop(form, 'faehigkeit', 'unbekannt', null, 'Art und Ausprägung der Fähigkeitsstörungen in Stichworten (passend zum GAF-Wert).'),
    comorb ? prop(form, 'comorbiditaeten', 'arzt', comorb, 'Co-Morbiditäten bzw. sonstige Einschränkungen aus der Beschreibung.', comorb)
      : prop(form, 'comorbiditaeten', 'leer', null, 'Nur bei F00–F99 außerhalb § 2 Abs. 2–4 ST-RL und GAF höchstens 40.'),
    prop(form, 'versicherter', 'duria', 'aus DURIA', 'Anschrift und Telefon kommen aus DURIA; in diesem Fenster nicht vorhanden.'),
    wohnform ? prop(form, 'wohnform', 'vorgeschlagen', wohnform, 'Wohnform – die Kasse prüft, ob die Einrichtung schon soziotherapeutische Inhalte bietet.', wohnform)
      : prop(form, 'wohnform', 'unbekannt', null, 'Wohnform angeben (z. B. allein in eigener Wohnung, bei Eltern, in Einrichtung).'),
    prop(form, 'angehoeriger', 'unbekannt', null, 'Kontaktdaten eines nächsten Angehörigen eintragen (nicht in diesem Fenster).'),
    ...betreuer(text),
    gesamt ? prop(form, 'einheiten_gesamt', 'arzt', gesamt.value, 'Voraussichtliche Gesamtzahl der Therapieeinheiten.', gesamt.evidence) : prop(form, 'einheiten_gesamt', 'leer', null, 'Nur wenn eine Einschätzung möglich ist.'),
    dauer ? prop(form, 'dauer', 'arzt', dauer[1]!, 'Voraussichtliche Dauer der Therapie.', dauer[0]) : prop(form, 'dauer', 'leer', null, 'Nur wenn eine Einschätzung möglich ist.'),
    beantragt ? prop(form, 'einheiten_beantragt', 'arzt', beantragt.value, 'Beantragte Therapieeinheiten (höchstens 30 je Verordnung).', beantragt.evidence)
      : prop(form, 'einheiten_beantragt', 'unbekannt', null, 'Beantragte Zahl der Therapieeinheiten (höchstens 30).'),
    bereits ? prop(form, 'bereits', 'vorgeschlagen', 'ja', 'In den letzten 3 Jahren bereits Soziotherapie – angeben.', bereits)
      : keineVorher ? prop(form, 'bereits', 'vorgeschlagen', 'keine', 'Bisher keine Soziotherapie.', keineVorher)
        : prop(form, 'bereits', 'leer', null, 'Angeben, falls bekannt ist, dass in den letzten 3 Jahren bereits Soziotherapie erfolgte.'),
    prognose ? prop(form, 'prognose', 'arzt', prognose, 'Prognose aus der Beschreibung.', prognose)
      : prop(form, 'prognose', 'unbekannt', null, 'Prognose: Kann der Versicherte mit diesen Einheiten befähigt werden, fachärztliche/psychotherapeutische Leistungen selbst in Anspruch zu nehmen?'),
    ...krankenhaus(text),
    begruendung ? prop(form, 'begruendung', 'arzt', begruendung, 'Begründung aus der Beschreibung.', begruendung) : prop(form, 'begruendung', 'unbekannt', null, 'Begründen, warum Krankenhausbehandlung vermieden/verkürzt wird bzw. nicht ausführbar ist.'),
    prop(form, 'datum', 'vorgeschlagen', ttmmjj(today), 'Ausstellungsdatum (heute) – mit Muster 27 spätestens am 3. Arbeitstag der Kasse vorlegen.'),
    stempel(form),
  ];
  return { formId: 'muster-26', fields, generator: 'regelbasiert' };
}

export function checkMuster26(values: FormValues, _facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  add(issue(form, 'hinweis', 'Verordnen dürfen nur Fachärzte für Neurologie, Nervenheilkunde, Psychosomatik, Psychiatrie bzw. Kinder- und Jugendpsychiatrie sowie Psychotherapeuten – Hausärzte nicht.', [], 'm26.berechtigte'));
  const dx = textOf(values, 'diagnose');
  if (!dx) add(issue(form, 'fehlt', 'Therapierelevante Diagnose als ICD-10-Code angeben.', ['diagnose'], 'm26.diagnose'));
  out.push(...icdIssues(form, values, ['diagnose']));
  const codes = icdCodes(dx);
  if (codes.length && !codes.some((c) => c.icd.startsWith('F'))) add(issue(form, 'unzulaessig', 'Soziotherapie nur bei schweren psychischen Erkrankungen (F00–F99).', ['diagnose'], 'm26.gaf_unter_40'));
  const gafText = textOf(values, 'gaf');
  const gaf = Number(gafText);
  if (!gafText) add(issue(form, 'fehlt', 'Schweregrad (GAF-Wert) angeben.', ['gaf'], 'm26.gaf_40_50'));
  else if (!/^\d{1,3}$/.test(gafText) || gaf > 100) add(issue(form, 'unzulaessig', 'GAF-Wert als Zahl von 0 bis 100.', ['gaf'], 'm26.gaf_40_50'));
  else if (gaf > GAF_MAX) add(issue(form, 'unzulaessig', `GAF ${gaf}: Soziotherapie nur bei GAF höchstens ${GAF_MAX}.`, ['gaf'], 'm26.gaf_40_50'));
  else if (gaf > GAF_SCHWER) add(issue(form, 'hinweis', `GAF ${gaf} (41–50): nur bei den in § 2 Abs. 2–4 ST-RL genannten Erkrankungen (v. a. schizophrener Formenkreis).`, ['gaf', 'diagnose'], 'm26.gaf_40_50'));
  else if (!textOf(values, 'comorbiditaeten')) add(issue(form, 'hinweis', `GAF ${gaf}: bei Diagnosen außerhalb § 2 Abs. 2–4 ST-RL Co-Morbiditäten bzw. sonstige Einschränkungen angeben.`, ['comorbiditaeten'], 'm26.comorbiditaeten'));
  if (!textOf(values, 'faehigkeit')) add(issue(form, 'fehlt', 'Art und Ausprägung der Fähigkeitsstörungen angeben.', ['faehigkeit'], 'm26.faehigkeitsstoerung'));
  if (!textOf(values, 'wohnform')) add(issue(form, 'fehlt', 'Wohnform angeben.', ['wohnform'], 'm26.versicherter'));
  if (!textOf(values, 'angehoeriger')) add(issue(form, 'fehlt', 'Kontaktdaten eines nächsten Angehörigen eintragen.', ['angehoeriger'], 'm26.angehoeriger'));
  add(exactlyOne(form, values, 'betreuer', 'm26.betreuer'));
  if (isChecked(values, 'betreuer_ja') && !textOf(values, 'betreuer_kontakt')) add(issue(form, 'fehlt', 'Gesetzlicher Betreuer: Kontaktdaten aufnehmen.', ['betreuer_kontakt'], 'm26.betreuer'));
  const beantragt = textOf(values, 'einheiten_beantragt');
  if (!beantragt) add(issue(form, 'fehlt', 'Beantragte Zahl der Therapieeinheiten angeben.', ['einheiten_beantragt'], 'm26.max_30'));
  else if (!/^\d{1,3}$/.test(beantragt) || Number(beantragt) < 1) add(issue(form, 'unzulaessig', 'Therapieeinheiten als Zahl angeben.', ['einheiten_beantragt'], 'm26.max_30'));
  else if (Number(beantragt) > MAX_EINHEITEN) add(issue(form, 'unzulaessig', `Höchstens ${MAX_EINHEITEN} Therapieeinheiten je Verordnung (beantragt: ${beantragt}).`, ['einheiten_beantragt'], 'm26.max_30'));
  if (!textOf(values, 'prognose')) add(issue(form, 'fehlt', 'Prognose angeben.', ['prognose'], 'm26.prognose'));
  add(exactlyOne(form, values, 'krankenhaus', 'm26.krankenhaus'));
  if (!textOf(values, 'begruendung')) add(issue(form, 'fehlt', 'Begründung angeben.', ['begruendung'], 'm26.krankenhaus'));
  if (validTTMMJJ(textOf(values, 'datum'))) add(issue(form, 'hinweis', 'Zusammen mit dem Betreuungsplan (Muster 27) spätestens am 3. Arbeitstag nach Ausstellung der Kasse vorlegen.', [], 'm26.vorlage_frist'));
  out.push(...formatIssues(form, values));
  return out;
}
