import { exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { icdIssues, personalien, stempel } from './common.js';
import { cue, fromTTMMJJ, icdCodes, toTTMMJJ, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 55 – Bescheinigung einer schwerwiegenden chronischen Erkrankung gem. § 62 SGB V (Stand 10.2016).
 * Erläuterungen 01/2026, S. 93–94. Dauerbehandlung = mindestens ein Jahr lang je Quartal mindestens ein Arztkontakt wegen derselben Erkrankung.
 */
const form = getForm('muster-55');
const ICD_FIELDS = ['icd1', 'icd2', 'icd3'] as const;

function seit(text: string): { value: string | null; evidence: string } | null {
  const m = uni(/\b(?:dauerbehandlung|behandlung|in behandlung|bekannt|diagnostiziert|erstdiagnose|ed)\b[^.;]{0,30}?\b(?:seit|am|vom)?\s*(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/iu).exec(text)
    ?? uni(/\bseit\s+(?:dem\s+)?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/iu).exec(text);
  if (m) return { value: toTTMMJJ(m[1]!, m[2]!, m[3]!), evidence: m[0].trim() };
  // „seit 2019“, „seit 03/2018“: ohne Tag kein TTMMJJ – der Arzt ergänzt das genaue Datum aus der Kartei.
  const ungefaehr = uni(/\bseit\s+(?:(\d{1,2})\s*\/\s*)?(\d{4})\b/iu).exec(text);
  return ungefaehr ? { value: null, evidence: ungefaehr[0] } : null;
}

function versorgung(text: string): FieldProposal[] {
  const bis = uni(/\bvoraussichtlich\s+bis\s+(\d{1,2})\s*[/.]\s*(\d{4}|\d{2})\b/iu).exec(text);
  if (bis) {
    const mmjj = `${bis[1]!.padStart(2, '0')}${bis[2]!.slice(-2)}`;
    return [...pickOne(form, 'versorgung', 'versorgung_bis', 'Kontinuierliche Versorgung voraussichtlich befristet.', bis[0]),
      prop(form, 'bis', 'vorgeschlagen', mmjj, 'Voraussichtliches Ende der Dauerbehandlung (MMJJ).', bis[0])];
  }
  const nein = cue(/\b(nicht mehr erforderlich|keine (?:weitere|kontinuierliche) (?:behandlung|versorgung)|behandlung abgeschlossen)\b/iu, text);
  if (nein) return [...pickOne(form, 'versorgung', 'versorgung_nein', 'Kontinuierliche Versorgung nicht mehr erforderlich.', nein), prop(form, 'bis', 'leer', null, 'Nur bei „ja, voraussichtlich bis“.')];
  const dauer = cue(/\b(lebenslang\w*|dauerhaft\w*|nicht absehbar|weiterhin erforderlich|unbefristet|chronisch\w*)\b/iu, text);
  if (dauer) return [...pickOne(form, 'versorgung', 'versorgung_unbefristet', 'Kontinuierliche Versorgung weiter nötig, Ende nicht absehbar.', dauer), prop(form, 'bis', 'leer', null, 'Nur bei „ja, voraussichtlich bis“.')];
  return [...pickOne(form, 'versorgung', null, 'Ob die kontinuierliche Versorgung weiter erforderlich ist, entscheidet der Arzt.', null), prop(form, 'bis', 'leer', null, 'Nur bei „ja, voraussichtlich bis“.')];
}

export function proposeMuster55(text: string, _facts: PatientFacts): FormProposal {
  const s = seit(text);
  const codes = icdCodes(text).filter((c) => c.certainty);
  const fields: FieldProposal[] = [
    personalien(form),
    s?.value ? prop(form, 'seit', 'vorgeschlagen', s.value, 'Beginn der Dauerbehandlung wegen derselben Erkrankung.', s.evidence)
      : prop(form, 'seit', 'unbekannt', null, s ? `„${s.evidence}“: genaues Datum (TTMMJJ) aus der Kartei ergänzen.` : 'Seit wann besteht Dauerbehandlung (mindestens 4 Quartale)? Datum aus der Kartei.', s?.evidence ?? null),
    ...ICD_FIELDS.map((id, i) => (codes[i]
      ? prop(form, id, 'arzt', `${codes[i]!.icd} ${codes[i]!.certainty}`, i === 0 ? 'Hauptdiagnose zuerst – der Arzt bestätigt.' : 'Weitere Dauerdiagnose – der Arzt bestätigt.', codes[i]!.evidence, 'm55.diagnosen')
      : prop(form, id, i === 0 ? 'unbekannt' : 'leer', null, i === 0 ? 'Behandlungsbedürftige Dauerdiagnose als ICD-10-Code (vom Arzt, mit Sicherheit).' : 'Weitere Dauerdiagnose nur bei Bedarf.', null, 'm55.diagnosen'))),
    ...versorgung(text),
    stempel(form),
  ];
  return { formId: 'muster-55', fields, generator: 'regelbasiert' };
}

export function checkMuster55(values: FormValues, _facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  const s = textOf(values, 'seit');
  if (!s) add(issue(form, 'fehlt', 'Seit wann besteht Dauerbehandlung? Datum (TTMMJJ) eintragen.', ['seit'], 'm55.dauerbehandlung'));
  if (validTTMMJJ(s)) {
    const einJahr = new Date();
    einJahr.setFullYear(einJahr.getFullYear() - 1);
    if (fromTTMMJJ(s) > einJahr) add(issue(form, 'unzulaessig', 'Dauerbehandlung setzt mindestens ein Jahr (4 Quartale) Behandlung wegen derselben Erkrankung voraus.', ['seit'], 'm55.dauerbehandlung'));
  }
  if (!ICD_FIELDS.some((id) => textOf(values, id))) add(issue(form, 'fehlt', 'Behandlungsbedürftige Dauerdiagnose(n) als ICD-10-Code angeben.', ['icd1'], 'm55.diagnosen'));
  out.push(...icdIssues(form, values, [...ICD_FIELDS]));
  add(exactlyOne(form, values, 'versorgung', 'm55.versorgung'));
  if (isChecked(values, 'versorgung_bis') && !textOf(values, 'bis')) add(issue(form, 'fehlt', '„voraussichtlich bis“: Monat und Jahr (MMJJ) eintragen.', ['bis'], 'm55.versorgung'));
  if (!isChecked(values, 'versorgung_bis') && textOf(values, 'bis')) add(issue(form, 'hinweis', 'Ein Enddatum gehört nur zu „ja, voraussichtlich bis“.', ['bis', 'versorgung_bis'], 'm55.versorgung'));
  add(issue(form, 'hinweis', 'Vorher erfragen, ob die Bescheinigung in diesem Kalenderjahr schon anderswo ausgestellt wurde.', [], 'm55.mehrfach'));
  out.push(...formatIssues(form, values));
  return out;
}
