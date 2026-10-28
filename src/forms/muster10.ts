import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { diagnose, icdIssues, labeled, personalien, stempel } from './common.js';
import { cue, dateAfter, timeAfter, labeledSegments, quarterQJJ, reasonPhrase, segment, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/** Muster 10 – Überweisungsschein für in-vitro-diagnostische Auftragsleistungen (Stand 4.2024). Erläuterungen 01/2026, S. 36–39. */
const form = getForm('muster-10');

/** Häufige Laboranforderungen der Hausarztpraxis → präzise Leistungsbezeichnung für das Auftragsfeld. */
const LAB: readonly [RegExp, string][] = [
  [/\b(?:großes|kleines)?\s*blutbild\b|\bdifferentialblutbild\b|\bbb\b/iu, 'Blutbild'],
  [/\bcrp\b/iu, 'CRP'],
  [/\bbsg\b|\bblutsenkung\w*/iu, 'BSG'],
  [/\btsh\b/iu, 'TSH'],
  [/\bft4\b/iu, 'fT4'],
  [/\bft3\b/iu, 'fT3'],
  [/\bhba1c\b/iu, 'HbA1c'],
  [/\b(?:nüchtern)?blutzucker\b|\bglukose\b|\bglucose\b/iu, 'Glukose'],
  [/\bkreatinin\b|\begfr\b|\bnierenwerte\b/iu, 'Kreatinin/eGFR'],
  [/\bharnstoff\b/iu, 'Harnstoff'],
  [/\belektrolyte\b|\bnatrium\b|\bkalium\b/iu, 'Elektrolyte (Na, K)'],
  [/\bleberwerte\b|\bgpt\b|\bgot\b|\bggt\b|\bgamma-?gt\b/iu, 'Leberwerte (GOT, GPT, GGT)'],
  [/\bbilirubin\b/iu, 'Bilirubin'],
  [/\blipid\w*|\bcholesterin\b|\bldl\b|\bhdl\b|\btriglycerid\w*|\btriglyzerid\w*/iu, 'Lipidprofil (Cholesterin, LDL, HDL, Triglyceride)'],
  [/\bferritin\b/iu, 'Ferritin'],
  [/\bvitamin\s*b12\b|\bb12\b/iu, 'Vitamin B12'],
  [/\bfolsäure\b/iu, 'Folsäure'],
  [/\bvitamin\s*d\b|\b25-?oh\b/iu, 'Vitamin D (25-OH)'],
  [/\binr\b|\bquick\b/iu, 'INR/Quick'],
  [/\bptt\b/iu, 'PTT'],
  [/\bd-?dimer\w*/iu, 'D-Dimere'],
  [/\btroponin\b/iu, 'Troponin'],
  [/\bnt-?probnp\b|\bbnp\b/iu, 'NT-proBNP'],
  [/\bpsa\b/iu, 'PSA'],
  [/\burinstatus\b|\burin-?stix\b|\burinuntersuchung\b/iu, 'Urinstatus'],
  [/\burinkultur\b/iu, 'Urinkultur mit Antibiogramm'],
  [/\blipase\b/iu, 'Lipase'],
  [/\bharnsäure\b/iu, 'Harnsäure'],
  [/\bck\b|\bkreatinkinase\b/iu, 'CK'],
  [/\balbumin\b/iu, 'Albumin'],
];

function labTests(text: string): string[] {
  const out: string[] = [];
  for (const [re, name] of LAB) if (uni(re).test(text) && !out.includes(name)) out.push(name);
  return out;
}

function art(text: string, reason: string | null, tests: string[]): FieldProposal[] {
  const empf = cue(/\b(empfängnisregelung|verhütung\w*|kontrazeption|sterilisation|schwangerschaftsabbruch)\b/iu, text);
  if (empf) return pickOne(form, 'art', 'empfaengnis', 'Empfängnisregelung, Sterilisation oder Schwangerschaftsabbruch.', empf);
  const prae = cue(/\b(check-?up|gesundheitsuntersuchung|präventiv\w*|vorsorge\w*|früherkennung\w*|mutterschaftsvorsorge|schwangerschaftsvorsorge|prep|mrsa-?screening)\b/iu, text);
  if (prae) return pickOne(form, 'art', 'praeventiv', 'Leistung nach einer Präventions-Richtlinie (z. B. Gesundheitsuntersuchung, Mutterschaftsvorsorge).', prae, 'm10.praeventiv');
  const beleg = cue(/\bbeleg(?:arzt|ärztlich)\w*/iu, text);
  if (beleg) return pickOne(form, 'art', 'belegaerztlich', 'Bei belegärztlicher Behandlung.', beleg);
  if (reason || tests.length) return pickOne(form, 'art', 'kurativ', 'Labordiagnostik zur Abklärung bzw. Behandlung einer Erkrankung ist kurativ.', reason ?? tests.join(', '));
  return pickOne(form, 'art', null, 'Aus der Beschreibung geht nicht hervor, ob kurativ oder präventiv.', null);
}

function auftrag(text: string, tests: string[]): FieldProposal {
  const seg = segment(labeledSegments(text), 'auftrag');
  if (seg) return prop(form, 'auftrag', 'vorgeschlagen', seg, 'Aus „Auftrag:“ in der Beschreibung übernommen.', seg);
  if (tests.length) return prop(form, 'auftrag', 'vorgeschlagen', tests.join(', '), 'Laborleistungen nach Art und Umfang; das Labor darf nur das Angegebene untersuchen.', tests.join(', '));
  return prop(form, 'auftrag', 'unbekannt', null, 'Welche Laboruntersuchungen? Bitte nach Art und Umfang angeben (z. B. „Blutbild, CRP, TSH“).');
}

export function proposeMuster10(text: string, facts: PatientFacts, today: Date): FormProposal {
  const reason = reasonPhrase(text);
  const tests = labTests(text);
  const abnahme = dateAfter(/\b(?:abnahme|abgenommen|entnahme|blutentnahme)\b/i, text);
  const todayTTMMJJ = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(2)}`;
  const zeit = timeAfter(/\b(?:abnahme|abgenommen|entnahme|blutentnahme)\w*/, text);
  const ssw = uni(/\b(\d{1,2})\s*\.?\s*ssw\b|\bssw\s*(\d{1,2})\b/iu).exec(text);
  const schwanger = cue(/\b(schwanger\w*|gravid\w*)\b/iu, text);
  const eilt = cue(/\b(eilt|eilig|cito|notfalllabor|sofort)\b/iu, text) ?? facts.dringend?.evidence ?? null;
  const tel = cue(/\b(telefon\w*|anrufen|per tel\.?)\b/iu, text);
  const fax = cue(/\b(fax|faxen|per fax)\b/iu, text);
  const kontrolle = cue(/\b(kontroll\w*[^.;]{0,30}\b(?:infektion|erreger|abstrich|helicobacter|hepatitis|hiv|chlamydi\w*|keim\w*)|bekannte\w*\s+infektion|verlaufskontrolle\s+(?:der\s+)?infektion)\b/iu, text);
  const fields: FieldProposal[] = [
    personalien(form),
    ...art(text, reason, tests),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Untersuchung wegen oder als Folge eines Unfalls.'),
    prop(form, 'knappschaft', 'leer', null, 'Nur Knappschaftsärzte bei Knappschaftsversicherten (87777).'),
    prop(form, 'quartal', 'vorgeschlagen', quarterQJJ(today), 'Quartal der Ausstellung (heute).'),
    prop(form, 'auftragsnummer', 'leer', null, 'Füllt das Labor aus.'),
    prop(form, 'geschlecht', 'duria', 'aus DURIA', 'Wird von der eGK gelesen.'),
    checkbox(form, 'kontrolle', kontrolle, 'Kontrolle einer bereits bekannten Infektion – Sachverhalt unter „Befund/Medikation“ erläutern.'),
    checkbox(form, 'ser', facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER/BVG).'),
    checkbox(form, 'par16', facts.eingeschraenkterAnspruch?.evidence ?? null, 'Eingeschränkter Leistungsanspruch (Muster 85 vorgelegt).'),
    prop(form, 'erst_bsnr', 'leer', null, 'Nur bei Weiterüberweisung durch das Labor.'),
    prop(form, 'erst_lanr', 'leer', null, 'Nur bei Weiterüberweisung durch das Labor.'),
    abnahme?.value && abnahme.value !== todayTTMMJJ
      ? prop(form, 'abnahmedatum', 'vorgeschlagen', abnahme.value, 'Entnahme an einem anderen Tag als die Ausstellung.', abnahme.evidence)
      : prop(form, 'abnahmedatum', 'leer', null, 'Nur wenn die Entnahme nicht am Ausstellungstag ist.'),
    zeit ? prop(form, 'abnahmezeit', 'vorgeschlagen', zeit.value, 'Abnahmezeit, falls für die Befundung nötig.', zeit.evidence)
      : prop(form, 'abnahmezeit', 'leer', null, 'Nur falls für die Befundung erforderlich (z. B. Cortisol-Tagesprofil).'),
    ...[['eilt', eilt, 'Befund eilt.'], ['telefon', tel, 'Übermittlung per Telefon.'], ['fax', fax, 'Übermittlung per Fax.']].map(([id, ev, why]) => checkbox(form, id!, ev ?? null, why!)),
    eilt && (tel || fax) ? prop(form, 'nr', 'unbekannt', null, 'Telefon- bzw. Faxnummer der Praxis für den eiligen Befund ergänzen.', null, 'm10.eilt')
      : prop(form, 'nr', 'leer', null, 'Nur bei eiliger Übermittlung.', null, 'm10.eilt'),
    ssw ? prop(form, 'ssw', 'vorgeschlagen', ssw[1] ?? ssw[2]!, 'Schwangerschaftswoche.', ssw[0])
      : schwanger ? prop(form, 'ssw', 'unbekannt', null, 'Schwangerschaft erwähnt – Schwangerschaftswoche eintragen.', schwanger)
        : prop(form, 'ssw', 'leer', null, 'Nur bei Schwangerschaft.'),
    diagnose(form, text),
    labeled(form, text, 'befund', ['befund', 'befunde', 'medikation', 'untersuchungsergebnis', 'untersuchungsergebnisse'], kontrolle ? 'Bei Kontrolluntersuchung den Sachverhalt erläutern.' : 'Befund bzw. Medikation (empfohlen).'),
    auftrag(text, tests),
    stempel(form),
  ];
  return { formId: 'muster-10', fields, generator: 'regelbasiert' };
}

export function checkMuster10(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall, Berufskrankheit oder Schülerunfall („${facts.arbeitsunfall.evidence}“): Muster 10 ist nicht zu verwenden.`, [], 'm10.arbeitsunfall'));
  add(exactlyOne(form, values, 'art', 'm10.art'));
  if (!textOf(values, 'quartal')) add(issue(form, 'fehlt', 'Quartal (QJJ) eintragen.', ['quartal'], 'm10.quartal'));
  if (!textOf(values, 'diagnose')) add(issue(form, 'fehlt', 'Diagnose bzw. Verdachtsdiagnose angeben, möglichst als ICD-Code.', ['diagnose'], 'm10.diagnose'));
  out.push(...icdIssues(form, values, ['diagnose']));
  if (!textOf(values, 'auftrag')) add(issue(form, 'fehlt', 'Auftrag: Laborleistungen nach Art und Umfang angeben (GOP oder präzise Bezeichnung).', ['auftrag'], 'm10.auftrag'));
  if (isChecked(values, 'kontrolle') && !textOf(values, 'befund')) add(issue(form, 'fehlt', 'Kontrolluntersuchung: Sachverhalt unter „Befund/Medikation“ erläutern.', ['befund'], 'm10.kontrolle'));
  const wege = ['telefon', 'fax'].filter((id) => isChecked(values, id));
  if (isChecked(values, 'eilt') && !wege.length) add(issue(form, 'fehlt', 'Befund eilt: angeben, ob per Telefon oder Fax übermittelt werden soll.', ['telefon', 'fax'], 'm10.eilt'));
  if (wege.length && !textOf(values, 'nr')) add(issue(form, 'fehlt', 'Telefon- bzw. Faxnummer für die Übermittlung angeben.', ['nr'], 'm10.eilt'));
  if (wege.length && !isChecked(values, 'eilt')) add(issue(form, 'hinweis', 'Telefon/Fax ist nur bei „Befund eilt“ vorgesehen.', ['eilt'], 'm10.eilt'));
  if (wege.length > 1) add(issue(form, 'hinweis', 'Nur eine Übermittlungsart (Telefon oder Fax) angeben.', wege, 'm10.eilt'));
  const k = textOf(values, 'knappschaft');
  if (k && k !== '87777') add(issue(form, 'unzulaessig', 'Knappschaftskennziffer ist 87777 (nur Knappschaftsärzte).', ['knappschaft'], 'm10.knappschaft'));
  const ssw = textOf(values, 'ssw');
  if (ssw && (Number(ssw) < 1 || Number(ssw) > 45)) add(issue(form, 'unzulaessig', 'SSW: Schwangerschaftswoche als Zahl (1–45).', ['ssw'], 'm10.ssw'));
  for (const id of ['erst_bsnr', 'erst_lanr']) if (textOf(values, id) && !/^\d+$/.test(textOf(values, id))) add(issue(form, 'unzulaessig', 'BSNR/LANR nur als Ziffern.', [id], 'm10.weiterueberweisung'));
  if (uni(/\b(zervix\w*|pap-?abstrich|gebärmutterhals\w*)\b/iu).test(textOf(values, 'auftrag'))) add(issue(form, 'hinweis', 'Früherkennung des Zervixkarzinoms (oKFE-RL) wird mit Muster 39 veranlasst, nicht mit Muster 10.', ['auftrag'], 'm10.zweck'));
  out.push(...formatIssues(form, values));
  return out;
}
