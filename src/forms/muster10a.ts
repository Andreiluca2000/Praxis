import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getField, getForm } from './catalog.js';
import { personalien } from './common.js';
import { cue, dateAfter, timeAfter, labeledSegments, segment, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 10A – Anforderungsschein für Laboratoriumsuntersuchungen bei Laborgemeinschaften (Stand 10.2020).
 * Erläuterungen 01/2026, S. 40–41. Die Untersuchungen werden im Auftragsfeld „durch Striche“ markiert.
 */
const form = getForm('muster-10a');

/** Stichwort in der Beschreibung → Untersuchung(en) im Auftragsfeld (Nummern wie auf dem Vordruck). */
const LAB: readonly [RegExp, number[]][] = [
  [/\b(?:großes|großem)\s+blutbild\b|\bdifferential-?blutbild\b|\bdiff-?bb\b/iu, [2]],
  [/\b(?:kleines|kleinem)\s+blutbild\b|\bblutbild\b|\bbb\b/iu, [3]],
  [/\bhba1c\b/iu, [4]],
  [/\bretikulozyten\b/iu, [5]],
  [/\bbsg\b|\bblutsenkung\w*/iu, [6]],
  [/\binr\b|\bquick\b/iu, [8]],
  [/\bthrombinzeit\b/iu, [10]],
  [/\bptt\b/iu, [11]],
  [/\balkalische\s+phosphatase\b/iu, [13]],
  [/\bamylase\b/iu, [14]],
  [/\basl\b|\bantistreptolysin\w*/iu, [15]],
  [/\bbilirubin\s+direkt\b|\bdirektes\s+bilirubin\b/iu, [16]],
  [/\bbilirubin\b/iu, [17]],
  [/\bcalcium\b|\bkalzium\b/iu, [18]],
  [/\bcholinesterase\b/iu, [20]],
  [/\bck\b|\bkreatinkinase\b/iu, [21]],
  [/\bcrp\b/iu, [23]],
  [/\beisen\b/iu, [24]],
  [/\b(?:eiweiß-?)?elektrophorese\b/iu, [25]],
  [/\b(?:gesamt-?eiweiß|eiweiß\s+gesamt|gesamteiweiß)\b/iu, [26]],
  [/\bleberwerte\b/iu, [27, 29, 30]],
  [/\bggt\b|\bgamma-?gt\b/iu, [27]],
  [/\bgot\b|\basat\b/iu, [29]],
  [/\bgpt\b|\balat\b/iu, [30]],
  [/\bharnsäure\b/iu, [31]],
  [/\bharnstoff\b/iu, [32]],
  [/\bimmunglobuline\b/iu, [35, 36, 37]],
  [/\biga\b/iu, [35]],
  [/\bigg\b/iu, [36]],
  [/\bigm\b/iu, [37]],
  [/\belektrolyte\b/iu, [38, 44]],
  [/\bkalium\b/iu, [38]],
  [/\bnatrium\b/iu, [44]],
  [/\bkreatinin-?clearance\b/iu, [40]],
  [/\bkreatinin\b(?!-?clearance)|\begfr\b|\bnierenwerte\b/iu, [39]],
  [/\bldh\b/iu, [41]],
  [/\blipase\b/iu, [43]],
  [/\bop-?vorbereitung\b|\bpräoperativ\w*|\bvor\s+(?:der\s+)?op\b/iu, [45]],
  [/\bphosphat\b/iu, [46]],
  [/\btransferrin\b/iu, [47]],
  [/\btsh\b/iu, [49]],
  [/\burinstatus\b|\burin-?stix\b|\burin-?status\b|\burinuntersuchung\b/iu, [55]],
  [/\bmikroalbumin\w*/iu, [56]],
  [/\burinzucker\b|\bglukose\s+im\s+urin\b/iu, [58]],
  [/\b(?:urin-?)?sediment\b/iu, [60]],
];

/** Lipide und Glukose: bei der Gesundheitsuntersuchung eigene Felder (62–64), sonst einzeln. */
const LIPIDE = /\blipid\w*|\bcholesterin\b|\bldl\b|\bhdl\b|\btriglycerid\w*|\btriglyzerid\w*/iu;
const GLUKOSE = /\b(?:nüchtern)?blutzucker\b|\bglukose\b|\bglucose\b|\bbz\b/iu;
const CHECKUP = /\b(check-?up|gesundheitsuntersuchung|gesundheits-?check)\b/iu;

/** Häufige Anforderungen ohne eigenes Feld – kommen unter „Sonstiges“ (61). */
const OTHER: readonly [RegExp, string][] = [
  [/\bferritin\b/iu, 'Ferritin'], [/\bvitamin\s*b12\b|\bb12\b/iu, 'Vitamin B12'], [/\bfolsäure\b/iu, 'Folsäure'],
  [/\bvitamin\s*d\b|\b25-?oh\b/iu, 'Vitamin D'], [/\bft4\b/iu, 'fT4'], [/\bft3\b/iu, 'fT3'], [/\bd-?dimer\w*/iu, 'D-Dimere'],
  [/\btroponin\b/iu, 'Troponin'], [/\bnt-?probnp\b|\bbnp\b/iu, 'NT-proBNP'], [/\bpsa\b/iu, 'PSA'], [/\bmagnesium\b/iu, 'Magnesium'],
  [/\balbumin\b/iu, 'Albumin'], [/\burinkultur\b/iu, 'Urinkultur'], [/\bfibrinogen\b/iu, 'Fibrinogen'],
];

const name = (nr: number) => getField(form, `lab${nr}`).label.replace(/\s*\(\d+\)$/u, '');

function wanted(text: string): { nrs: Map<number, string>; other: { name: string; evidence: string }[]; checkup: string | null } {
  const nrs = new Map<number, string>();
  const add = (nr: number, ev: string) => { if (!nrs.has(nr)) nrs.set(nr, ev); };
  for (const [re, ids] of LAB) {
    const ev = cue(re, text);
    if (ev) ids.forEach((nr) => add(nr, ev));
  }
  // „großes Blutbild“ enthält „Blutbild“ – dann nicht zusätzlich das kleine.
  if (nrs.has(2) && nrs.get(3) && !uni(/\bkleines\s+blutbild\b/iu).test(text)) nrs.delete(3);
  if (nrs.has(16) && nrs.get(17) && !uni(/\bbilirubin\s+gesamt\b|\bgesamt-?bilirubin\b/iu).test(text)) nrs.delete(17);
  const marcumar = cue(/\b(marcumar|phenprocoumon|cumarin\w*|vitamin-?k-?antagonist\w*)\b/iu, text);
  if (nrs.has(8) && marcumar) { nrs.delete(8); add(9, marcumar); }
  const checkup = cue(CHECKUP, text);
  const lip = cue(LIPIDE, text);
  const glu = cue(GLUKOSE, text);
  if (checkup) {
    add(62, checkup); add(63, checkup); add(64, checkup);
  } else {
    if (lip) {
      const which: [RegExp, number][] = [[/\bcholesterin\b/iu, 19], [/\bhdl\b/iu, 34], [/\bldl\b/iu, 42], [/\btriglycerid\w*|\btriglyzerid\w*/iu, 48]];
      const named = which.filter(([re]) => uni(re).test(text));
      (named.length ? named.map(([, nr]) => nr) : [19, 34, 42, 48]).forEach((nr) => add(nr, lip));
    }
    if (glu && !nrs.has(58)) add(28, glu);
  }
  const other = OTHER.flatMap(([re, n]) => { const ev = cue(re, text); return ev ? [{ name: n, evidence: ev }] : []; });
  return { nrs, other, checkup };
}

function art(text: string, checkup: string | null, any: boolean): FieldProposal[] {
  const prae = checkup ?? cue(/\b(präventiv\w*|vorsorge\w*|früherkennung\w*|mutterschaftsvorsorge|schwangerschaftsvorsorge)\b/iu, text);
  if (prae) return pickOne(form, 'art', 'praeventiv', 'Untersuchung im Rahmen der Prävention (z. B. Gesundheitsuntersuchung, Mutterschaftsvorsorge).', prae);
  const beleg = cue(/\bbeleg(?:arzt|ärztlich)\w*/iu, text);
  if (beleg) return pickOne(form, 'art', 'belegaerztlich', 'Bei belegärztlicher Behandlung.', beleg);
  if (any) return pickOne(form, 'art', 'kurativ', 'Labor zur Abklärung bzw. Behandlung einer Erkrankung ist kurativ.', null);
  return pickOne(form, 'art', null, 'Aus der Beschreibung geht nicht hervor, ob kurativ, präventiv oder belegärztlich.', null);
}

function labFields(text: string, nrs: Map<number, string>, other: { name: string; evidence: string }[], eilt: string | null): FieldProposal[] {
  return form.fields.filter((f) => f.group === 'untersuchungen').map((f) => {
    const nr = Number(f.id.slice(3));
    if (nr === 1) return checkbox(form, f.id, eilt, 'Befund eilt.');
    if (nr === 61) {
      return other.length
        ? prop(form, f.id, 'vorgeschlagen', true, `Nicht im Auftragsfeld benannt: ${other.map((o) => o.name).join(', ')}. Unter „Sonstiges“ nur Leistungen des Allgemeinlabors – sonst Muster 10.`, other.map((o) => o.evidence).join(', '))
        : prop(form, f.id, 'leer', false, 'Nur für Leistungen des Allgemeinlabors, die im Auftragsfeld nicht benannt sind.');
    }
    const ev = nrs.get(nr);
    return ev
      ? prop(form, f.id, 'vorgeschlagen', true, `Angefordert: ${name(nr)}.`, ev)
      : prop(form, f.id, 'leer', false, 'Nicht angefordert – die Laborgemeinschaft untersucht nur Markiertes.');
  });
}

function zusatz(text: string, other: { name: string }[], clearance: boolean): FieldProposal {
  const seg = segment(labeledSegments(text), 'befund', 'befunde', 'medikation', 'hinweis', 'hinweise');
  const sammel = uni(/\b(?:sammel(?:menge|zeit|urin)|\d+\s*-?\s*h(?:-|\s)?(?:sammel)?urin)\b[^.;]*/iu).exec(text)?.[0] ?? null;
  const parts = [other.length ? `Sonstiges: ${other.map((o) => o.name).join(', ')}` : null, sammel, seg].filter((p): p is string => Boolean(p));
  if (parts.length) return prop(form, 'zusatzangaben', 'vorgeschlagen', parts.join('; '), 'Für die Untersuchung wesentliche Angaben (z. B. Sammelmenge/-zeit, Befunde, Medikation) – bitte prüfen.', parts.join('; '));
  if (clearance) return prop(form, 'zusatzangaben', 'unbekannt', null, 'Kreatinin-Clearance: Urin-Sammelmenge und Sammelzeit angeben.');
  return prop(form, 'zusatzangaben', 'leer', null, 'Nur bei untersuchungsrelevanten Angaben (z. B. wichtige Befunde, Medikation).');
}

/** Untersuchungen aus der Beschreibung, die das Auftragsfeld von Muster 10A benennt (null = keine). */
export function labGemeinschaft(text: string): string | null {
  const { nrs } = wanted(text);
  return nrs.size ? [...nrs.keys()].sort((a, b) => a - b).map(name).join(', ') : null;
}

export function proposeMuster10A(text: string, facts: PatientFacts, today: Date): FormProposal {
  const { nrs, other, checkup } = wanted(text);
  const abnahme = dateAfter(/\b(?:abnahme|abgenommen|entnahme|blutentnahme)\b/i, text);
  const zeit = timeAfter(/\b(?:abnahme|abgenommen|entnahme|blutentnahme)\w*/, text);
  const ssw = uni(/\b(\d{1,2})\s*\.?\s*ssw\b|\bssw\s*(\d{1,2})\b/iu).exec(text);
  const schwanger = cue(/\b(schwanger\w*|gravid\w*)\b/iu, text);
  const eilt = cue(/\b(eilt|eilig|cito|sofort)\b/iu, text) ?? facts.dringend?.evidence ?? null;
  const heute = /\bheute\b/iu.test(text);
  const todayTTMMJJ = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(2)}`;
  const fields: FieldProposal[] = [
    personalien(form),
    ...art(text, checkup, nrs.size + other.length > 0),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Untersuchung wegen oder als Folge eines Unfalls.'),
    prop(form, 'knappschaft', 'leer', null, 'Nur Knappschaftsärzte bei Knappschaftsversicherten (87777).'),
    prop(form, 'geschlecht', 'duria', 'aus DURIA', 'Wird von der eGK gelesen.'),
    ssw ? prop(form, 'ssw', 'vorgeschlagen', ssw[1] ?? ssw[2]!, 'Schwangerschaftswoche.', ssw[0])
      : schwanger ? prop(form, 'ssw', 'unbekannt', null, 'Schwangerschaft erwähnt – Schwangerschaftswoche eintragen.', schwanger)
        : prop(form, 'ssw', 'leer', null, 'Nur bei Schwangerschaft.'),
    prop(form, 'auftragsnummer', 'leer', null, 'Barcode-Etikett der Laborgemeinschaft – wird eingeklebt.'),
    zusatz(text, other, nrs.has(40)),
    abnahme?.value ? prop(form, 'abnahmedatum', 'vorgeschlagen', abnahme.value, 'Tag der Materialentnahme.', abnahme.evidence)
      : heute ? prop(form, 'abnahmedatum', 'vorgeschlagen', todayTTMMJJ, 'Entnahme heute.', 'heute')
        : prop(form, 'abnahmedatum', 'unbekannt', null, 'Tag der Materialentnahme eintragen (TTMMJJ).'),
    zeit ? prop(form, 'abnahmezeit', 'vorgeschlagen', zeit.value, 'Uhrzeit der Entnahme.', zeit.evidence)
      : prop(form, 'abnahmezeit', 'unbekannt', null, 'Uhrzeit der Entnahme eintragen (hhmm).'),
    ...labFields(text, nrs, other, eilt),
  ];
  return { formId: 'muster-10a', fields, generator: 'regelbasiert' };
}

export function checkMuster10A(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall, Berufskrankheit oder Schülerunfall („${facts.arbeitsunfall.evidence}“): Muster 10A ist nicht zu verwenden.`, [], 'm10a.arbeitsunfall'));
  add(exactlyOne(form, values, 'art', 'm10a.leistungsart'));
  const labs = form.fields.filter((f) => f.group === 'untersuchungen' && f.id !== 'lab1');
  const on = labs.filter((f) => isChecked(values, f.id)).map((f) => f.id);
  if (!on.length) add(issue(form, 'fehlt', 'Auftragsfeld: mindestens eine Untersuchung markieren – die Laborgemeinschaft untersucht nur Markiertes.', ['lab2'], 'm10a.auftragsfeld'));
  if (isChecked(values, 'lab40') && !uni(/sammel|\d+\s*(?:ml|l)\b|\d+\s*h\b|stunden/iu).test(textOf(values, 'zusatzangaben'))) {
    add(issue(form, 'fehlt', 'Kreatinin-Clearance: Urin-Sammelmenge und Sammelzeit unter „Zusätzliche Angaben“ eintragen.', ['zusatzangaben'], 'm10a.zusatzangaben'));
  }
  if (isChecked(values, 'lab61') && !textOf(values, 'zusatzangaben')) add(issue(form, 'fehlt', '„Sonstiges“ markiert: angeben, welche Untersuchung gemeint ist.', ['zusatzangaben'], 'm10a.auftragsfeld'));
  const gu = ['lab62', 'lab63', 'lab64'].filter((id) => isChecked(values, id));
  if (gu.length && !isChecked(values, 'praeventiv')) add(issue(form, 'hinweis', 'Harnstreifentest, Nüchternplasmaglukose und Lipidprofil stehen auf dem Vordruck unter „Gesundheitsuntersuchungen“ – Leistungsart „Präventiv“ prüfen.', [...gu, 'praeventiv'], 'm10a.leistungsart'));
  if (isChecked(values, 'lab8') && isChecked(values, 'lab9')) add(issue(form, 'hinweis', 'Quick und „Quick unter Marcumar-Therapie“ – nur eines markieren.', ['lab8', 'lab9'], 'm10a.auftragsfeld'));
  if (!textOf(values, 'abnahmedatum')) add(issue(form, 'fehlt', 'Abnahmedatum eintragen (TTMMJJ).', ['abnahmedatum'], 'm10a.abnahme'));
  if (!textOf(values, 'abnahmezeit')) add(issue(form, 'fehlt', 'Abnahmezeit eintragen (hhmm).', ['abnahmezeit'], 'm10a.abnahme'));
  const k = textOf(values, 'knappschaft');
  if (k && k !== '87777') add(issue(form, 'unzulaessig', 'Knappschaftskennziffer ist 87777 (nur Knappschaftsärzte).', ['knappschaft'], 'm10a.knappschaft'));
  const ssw = textOf(values, 'ssw');
  if (ssw && (!/^\d{1,2}$/.test(ssw) || Number(ssw) < 1 || Number(ssw) > 45)) add(issue(form, 'unzulaessig', 'SSW: Schwangerschaftswoche als Zahl (1–45).', ['ssw'], 'm10a.ssw'));
  out.push(...formatIssues(form, values));
  return out;
}
